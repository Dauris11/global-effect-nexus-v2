-- ================================================================
-- PORTAL GLOBALEFFECT — 0123 · Cuentas por pagar: retenciones (2.3.6/2.3.7)
--                              y datos DGII en proveedores
-- ================================================================
-- 1. Agrega al catálogo contable las dos cuentas de retenciones a terceros
--    añadidas en `Catalogo Contable.xlsx`:
--      · 2.3.6  ITBIS Retenido a Terceros por Pagar (pasivo, acreedora, SI)
--      · 2.3.7  ISR Retenido a Terceros por Pagar   (pasivo, acreedora, SI)
-- 2. Asigna los códigos de transacción de retenciones de proveedores y
--    calculadora a 2.3.6 y 2.3.7 (crédito, efecto = aumenta).
-- 3. Añade `actividad_economica` y `administracion_local` a
--    `contabilidad.proveedor` (para almacenar la consulta oficial DGII).
-- 4. Añade `tipo_retencion_isr` y `tipo_retencion_itbis` a
--    `contabilidad.factura_proveedor` (para guardar el tipo de retención
--    aplicado según el catálogo DGII).
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0123_cxp_proveedores_retenciones.sql', true);

-- 1) Nuevas cuentas bajo 2.3 Retenciones por Pagar
INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, naturaleza, padre_id, admite_movimiento)
SELECT v.codigo, v.nombre, 'pasivo', 'acreedora', p.id, true
  FROM (VALUES
    ('2.3.6', 'ITBIS Retenido a Terceros por Pagar'),
    ('2.3.7', 'ISR Retenido a Terceros por Pagar')
  ) AS v(codigo, nombre)
  JOIN contabilidad.cuenta_contable p ON p.codigo = '2.3'
ON CONFLICT (codigo) DO UPDATE
   SET nombre = EXCLUDED.nombre,
       tipo = 'pasivo',
       naturaleza = 'acreedora',
       padre_id = EXCLUDED.padre_id,
       admite_movimiento = true,
       activa = true;

-- 2) Enlazar códigos de transacción de retenciones a terceros
INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, efecto, cuenta_id)
SELECT s.codigo, 'credito', 'aumenta', c.id
  FROM (VALUES
    ('PROV_ITBIS_RETENIDO_X_PAGAR', '2.3.6'),
    ('PROV_ISR_RETENIDO_X_PAGAR',   '2.3.7'),
    ('CALC_FACTURA_ITBIS_RETENIDO', '2.3.6'),
    ('CALC_FACTURA_ISR_RETENIDO',   '2.3.7')
  ) AS s(codigo, cuenta)
  JOIN contabilidad.cuenta_contable c
    ON c.codigo = s.cuenta AND c.admite_movimiento AND c.activa
ON CONFLICT (codigo) DO UPDATE
   SET cuenta_id = EXCLUDED.cuenta_id,
       efecto = COALESCE(contabilidad.codigo_transaccion.efecto, EXCLUDED.efecto),
       actualizado_en = now();

-- 3) Datos fiscales adicionales del proveedor (consulta RNC/Cédula DGII)
ALTER TABLE contabilidad.proveedor
  ADD COLUMN IF NOT EXISTS actividad_economica  text,
  ADD COLUMN IF NOT EXISTS administracion_local text;

COMMENT ON COLUMN contabilidad.proveedor.actividad_economica IS
  'Actividad económica principal reportada por la DGII al consultar el RNC/Cédula.';
COMMENT ON COLUMN contabilidad.proveedor.administracion_local IS
  'Administración local de la DGII correspondiente al contribuyente.';

-- 4) Registro del tipo de retención seleccionado en facturas de proveedor
ALTER TABLE contabilidad.factura_proveedor
  ADD COLUMN IF NOT EXISTS tipo_retencion_isr   text,
  ADD COLUMN IF NOT EXISTS tipo_retencion_itbis text;

COMMENT ON COLUMN contabilidad.factura_proveedor.tipo_retencion_isr IS
  'Código de la retención de ISR aplicada (src/lib/contabilidad/retenciones-dgii.ts).';
COMMENT ON COLUMN contabilidad.factura_proveedor.tipo_retencion_itbis IS
  'Código de la retención de ITBIS aplicada (src/lib/contabilidad/retenciones-dgii.ts).';
