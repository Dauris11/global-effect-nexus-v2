-- ================================================================
-- PORTAL GLOBALEFFECT — 0133 · Integración TasaReal (código institución + bitácora)
-- ================================================================
-- 1. Agrega `codigo_institucion` (código de TasaReal, p. ej. `santa_cruz`,
--    `reservas`, `bhd`) a `contabilidad.cuenta_bancaria` y
--    `contabilidad.solicitud_cambio_cuenta_bancaria` para cuentas en USD.
-- 2. Crea `contabilidad.tasareal_actualizacion` para auditar cada
--    actualización desde la API de TasaReal y soportar la regla de
--    una ejecución diaria a partir de las 8:00 AM (America/Santo_Domingo).
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0133_codigo_institucion_tasareal.sql', true);

ALTER TABLE contabilidad.cuenta_bancaria
  ADD COLUMN IF NOT EXISTS codigo_institucion text;

ALTER TABLE contabilidad.solicitud_cambio_cuenta_bancaria
  ADD COLUMN IF NOT EXISTS codigo_institucion text;

COMMENT ON COLUMN contabilidad.cuenta_bancaria.codigo_institucion IS
  'Código de institución en TasaReal (instituciones.txt) usado para actualizar automáticamente tasas de compra/venta en cuentas USD.';

CREATE TABLE IF NOT EXISTS contabilidad.tasareal_actualizacion (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_rd             date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo')::date,
  ejecutado_en         timestamptz NOT NULL DEFAULT now(),
  ejecutado_por        uuid NOT NULL REFERENCES public.usuario(id),
  bcrd_actualizado     boolean NOT NULL DEFAULT false,
  bancos_actualizados  integer NOT NULL DEFAULT 0,
  detalle              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tasareal_actualizacion_fecha
  ON contabilidad.tasareal_actualizacion (fecha_rd DESC, ejecutado_en DESC);

COMMENT ON TABLE contabilidad.tasareal_actualizacion IS
  'Registro de sincronizaciones de tasas de cambio desde la API de TasaReal.';

ALTER TABLE contabilidad.tasareal_actualizacion ENABLE ROW LEVEL SECURITY;

SELECT contabilidad.auditar_tabla('contabilidad.tasareal_actualizacion'::regclass);
