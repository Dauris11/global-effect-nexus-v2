-- ================================================================
-- PORTAL GLOBALEFFECT — 0124 · Tipo de gasto directo desde cuentas
--                              contables en facturas de proveedor
-- ================================================================
-- 1. Añade `agregar_a_facturas boolean NOT NULL DEFAULT false` a
--    `contabilidad.cuenta_contable`. Cuando una cuenta recibe movimiento y
--    tiene `agregar_a_facturas = true`, aparece en la lista «Tipo de gasto»
--    al registrar una factura (mostrando solo su nombre) y el asiento de la
--    factura debita directamente esa cuenta.
-- 2. Siembra `agregar_a_facturas = true` en las cuentas de movimiento de
--    gastos administrativos/operativos (5.2.%) para que la lista arranque
--    lista para usar (editable en Configuración contable > Catálogo).
-- 3. Añade `cuenta_gasto_id` a `contabilidad.factura_proveedor` y hace
--    `categoria_id` opcional en `factura_proveedor`, `cuenta_por_pagar` y
--    `recibo` (un pago de factura usa `PROV_PAGO_CXP`, no `categoria_id`).
-- 4. Actualiza `contabilidad.lineas_aprobar_factura` para debitar
--    `coalesce(f.cuenta_gasto_id, categoria.cuenta_id)`.
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0124_tipo_gasto_facturas.sql', true);

-- 1) Bandera en el catálogo de cuentas
ALTER TABLE contabilidad.cuenta_contable
  ADD COLUMN IF NOT EXISTS agregar_a_facturas boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN contabilidad.cuenta_contable.agregar_a_facturas IS
  'Si es true (solo en cuentas de movimiento), la cuenta aparece en la lista «Tipo de gasto» al registrar facturas de proveedor.';

-- 2) Siembra inicial en gastos operativos/administrativos (5.2.%) si aún ninguna está marcada
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE agregar_a_facturas) THEN
    UPDATE contabilidad.cuenta_contable
       SET agregar_a_facturas = true
     WHERE tipo = 'gasto'
       AND codigo LIKE '5.2.%'
       AND admite_movimiento = true
       AND activa = true;
  END IF;
END
$$;

-- 3) Facturas con cuenta de gasto directa y categoria_id opcional en el flujo CxP
ALTER TABLE contabilidad.factura_proveedor
  ADD COLUMN IF NOT EXISTS cuenta_gasto_id uuid REFERENCES contabilidad.cuenta_contable(id);

ALTER TABLE contabilidad.factura_proveedor
  ALTER COLUMN categoria_id DROP NOT NULL;

ALTER TABLE contabilidad.cuenta_por_pagar
  ALTER COLUMN categoria_id DROP NOT NULL;

ALTER TABLE contabilidad.recibo
  ALTER COLUMN categoria_id DROP NOT NULL;

COMMENT ON COLUMN contabilidad.factura_proveedor.cuenta_gasto_id IS
  'Cuenta contable de gasto elegida directamente como «Tipo de gasto» al registrar la factura.';

-- Backfill de facturas existentes que ya tenían categoría con cuenta contable
UPDATE contabilidad.factura_proveedor f
   SET cuenta_gasto_id = c.cuenta_id
  FROM contabilidad.categoria c
 WHERE f.cuenta_gasto_id IS NULL
   AND f.categoria_id = c.id
   AND c.cuenta_id IS NOT NULL;

-- 4) `lineas_aprobar_factura` usa `cuenta_gasto_id` directamente (con respaldo en categoría)
CREATE OR REPLACE FUNCTION contabilidad.lineas_aprobar_factura(
  p_factura uuid,
  p_previa  boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  f       contabilidad.factura_proveedor%ROWTYPE;
  v_prov  contabilidad.proveedor%ROWTYPE;
  v_gasto uuid;
  v_t     numeric := 1;
  v_total numeric(14,2);
  v_isr   numeric(14,2);
  v_itbis numeric(14,2);
  v_lin   jsonb;
BEGIN
  SELECT * INTO f FROM contabilidad.factura_proveedor WHERE id = p_factura;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contabilidad: la factura no existe';
  END IF;
  SELECT * INTO v_prov FROM contabilidad.proveedor WHERE id = f.proveedor_id;

  v_gasto := coalesce(
    f.cuenta_gasto_id,
    (SELECT cuenta_id FROM contabilidad.categoria WHERE id = f.categoria_id)
  );
  IF v_gasto IS NULL AND NOT p_previa THEN
    RAISE EXCEPTION 'contabilidad: el tipo de gasto de la factura no tiene cuenta contable asignada';
  END IF;

  IF f.moneda = 'USD' THEN v_t := f.tasa; END IF;
  v_total := round(f.total * v_t, 2);
  v_isr   := round(f.retencion_isr * v_t, 2);
  v_itbis := round(f.retencion_itbis * v_t, 2);

  v_lin := jsonb_build_array(
    jsonb_build_object('cuenta_id', v_gasto, 'debe', v_total, 'haber', 0,
                       'problema', CASE WHEN v_gasto IS NULL THEN 'categoria_sin_cuenta' END));
  v_lin := contabilidad._agregar_linea_codigo(v_lin, 'PROV_CXP_FACTURA', 'credito',
             v_total - v_isr - v_itbis, v_prov.nombre, p_previa);
  v_lin := contabilidad._agregar_linea_codigo(v_lin, 'PROV_ISR_RETENIDO_X_PAGAR', 'credito',
             v_isr, 'Retención ISR', p_previa);
  v_lin := contabilidad._agregar_linea_codigo(v_lin, 'PROV_ITBIS_RETENIDO_X_PAGAR', 'credito',
             v_itbis, 'Retención ITBIS', p_previa);
  RETURN v_lin;
END;
$$;
