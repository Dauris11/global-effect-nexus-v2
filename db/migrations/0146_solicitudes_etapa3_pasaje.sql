-- ============================================================================
-- PORTAL GLOBALEFFECT — 0146 · Solicitudes Etapa 3 y Módulo Pasaje en Contabilidad
-- ============================================================================
-- 1. Agrega configuración `multiplicar_por_dias` (default TRUE) en
--    `public.lugar_pasaje` para controlar si el período «Personalizado»
--    multiplica el monto base por la cantidad de días seleccionados.
-- 2. Amplía `public.solicitud.estado` para incluir `'entregado'`.
-- 3. Agrega columnas de entrega de pasaje en `public.solicitud`:
--      · `monto_entregado` (valor editable confirmado al entregar)
--      · `entregado_por`   (usuario de contabilidad que entrega)
--      · `entregado_en`    (fecha/hora de entrega)
--      · `en_historial_pasaje` (permite conservar entregas en «Solicitudes»
--         hasta que pasen a «Historial» en una etapa posterior)
-- ============================================================================

-- 1. Configuración de multiplicador por días en Lugares de Pasaje
ALTER TABLE public.lugar_pasaje
  ADD COLUMN IF NOT EXISTS multiplicar_por_dias BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.lugar_pasaje.multiplicar_por_dias IS
  'Si es TRUE, el período Personalizado multiplica el monto por la cantidad de días seleccionados; si es FALSE, aplica el monto base una sola vez.';

-- 2. Ampliar CHECK de estado en public.solicitud con 'entregado'
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
      'entregado',
      'rechazada',
      'completada',
      'cancelada'
    )
  );

-- 3. Columnas de entrega de pasaje
ALTER TABLE public.solicitud
  ADD COLUMN IF NOT EXISTS monto_entregado NUMERIC(12,2)
    CHECK (monto_entregado IS NULL OR monto_entregado > 0),
  ADD COLUMN IF NOT EXISTS entregado_por UUID
    REFERENCES public.usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entregado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS en_historial_pasaje BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_solicitud_pasaje_modulo
  ON public.solicitud (en_historial_pasaje, created_at DESC)
  WHERE tipo = 'PASAJE';
