-- ============================================================================
-- PORTAL GLOBALEFFECT — 0145 · Solicitudes (Etapa 2) y conexión con Cuentas por Pagar
-- ============================================================================
-- 1. Amplía el CHECK de `public.solicitud.estado` para soportar el ciclo:
--      `solicitado` → `aceptada` → `pagada` (junto con los estados previos).
-- 2. Actualiza solicitudes dinámicas (`MATERIALES`, `PASAJE`, `OTRO`) en estado
--    inicial `enviada` a `solicitado`.
-- 3. Vincula `contabilidad.factura_proveedor.solicitud_id` → `public.solicitud(id)`
--    (índice único parcial para facturas no anuladas) para soportar el flujo
--    Materiales → Factura (borrador / Pendiente de llenado) → CxP (Pendiente) → Pagada.
-- 4. Refuerza `contabilidad.aprobar_factura` exigiendo NCF / e-CF al aprobar.
-- ============================================================================

-- 1. Ampliar CHECK de estado en public.solicitud
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT c.conname INTO v_constraint
    FROM pg_constraint c
   WHERE c.conrelid = 'public.solicitud'::regclass
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%pendiente_direccion%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.solicitud DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.solicitud
  ADD CONSTRAINT solicitud_estado_check CHECK (
    estado IN (
      'solicitado',
      'enviada',
      'en_revision',
      'pendiente_direccion',
      'aprobada',
      'aceptada',
      'pagada',
      'rechazada',
      'completada',
      'cancelada'
    )
  );

-- 2. Normalizar solicitudes dinámicas abiertas recién creadas a 'solicitado'
UPDATE public.solicitud
   SET estado = 'solicitado'
 WHERE tipo IN ('MATERIALES', 'PASAJE', 'OTRO')
   AND estado = 'enviada';

-- 3. Vincular factura_proveedor con solicitud
ALTER TABLE contabilidad.factura_proveedor
  ADD COLUMN IF NOT EXISTS solicitud_id UUID
    REFERENCES public.solicitud(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_proveedor_solicitud_activa
  ON contabilidad.factura_proveedor (solicitud_id)
  WHERE solicitud_id IS NOT NULL AND estado <> 'anulada';

COMMENT ON COLUMN contabilidad.factura_proveedor.solicitud_id IS
  'Solicitud de Materiales que originó esta factura desde Cuentas por Pagar > Solicitudes (Etapa 2).';

-- 4. Exigir NCF o e-CF al aprobar la factura (el borrador desde Solicitudes permite NCF vacío)
CREATE OR REPLACE FUNCTION contabilidad.aprobar_factura(p_factura uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  f         contabilidad.factura_proveedor%ROWTYPE;
  v_asiento uuid;
  v_cxp     uuid;
BEGIN
  SELECT * INTO f FROM contabilidad.factura_proveedor WHERE id = p_factura FOR UPDATE;
  IF NOT FOUND OR f.estado <> 'borrador' THEN
    RAISE EXCEPTION 'contabilidad: solo se aprueba una factura en borrador';
  END IF;

  IF f.ncf IS NULL OR length(trim(f.ncf)) = 0 THEN
    RAISE EXCEPTION 'contabilidad: falta el NCF o e-CF para aprobar la factura';
  END IF;

  v_asiento := contabilidad.crear_asiento(
    f.fecha_emision,
    contabilidad.concepto_asiento_factura(f.id),
    'automatico', 'factura_proveedor', f.id,
    contabilidad.lineas_aprobar_factura(f.id));

  INSERT INTO contabilidad.cuenta_por_pagar
         (origen, factura_id, proveedor_id, concepto, moneda, monto, fecha_emision,
          fecha_vencimiento, categoria_id, fondo_id, proyecto_id, creado_por)
  VALUES ('factura', f.id, f.proveedor_id, f.concepto, f.moneda, f.neto, f.fecha_emision,
          f.fecha_vencimiento, f.categoria_id, f.fondo_id, f.proyecto_id, contabilidad._usuario_actual())
  RETURNING id INTO v_cxp;

  PERFORM set_config('app.accion', 'aprobar', true);
  UPDATE contabilidad.factura_proveedor
     SET estado = 'aprobada', asiento_id = v_asiento, cuenta_por_pagar_id = v_cxp,
         aprobado_por = contabilidad._usuario_actual(), aprobado_en = now()
   WHERE id = f.id;
  PERFORM set_config('app.accion', '', true);

  RETURN v_cxp;
END;
$$;
