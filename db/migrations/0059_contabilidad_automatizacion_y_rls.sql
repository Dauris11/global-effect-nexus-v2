-- ================================================================
-- GLOBAL EFFECT NEXUS — 0059 · Automatización de Contabilidad y RLS
-- ================================================================
-- Fases 5 a 7 de docs/estado/plan-nexus-ai.md.
--
--   • comprobante_recibido guarda la clasificación sugerida y si la
--     contadora la aceptó sin tocarla: de ahí salen las métricas de
--     «Mi día» (% sin corrección, tiempo por comprobante).
--   • regla_automatica: el nivel de autonomía POR REGLA, que fija la
--     contadora. 0 sugiere · 1 prepara y ella aprueba en lote ·
--     2 contabiliza solo, con umbral de confianza y de monto.
--     Por defecto, 1.
--   • RLS en las tablas de 0055 y 0056, que 0046 no alcanzó a cubrir
--     (se creó antes que ellas). Sin políticas, igual que 0046: la app
--     entra como postgres y la API pública queda cerrada.
-- ================================================================

ALTER TABLE contabilidad.comprobante_recibido
  ADD COLUMN IF NOT EXISTS clasificacion_sugerida JSONB,
  ADD COLUMN IF NOT EXISTS sugerencia_aceptada    BOOLEAN,
  ADD COLUMN IF NOT EXISTS validacion_automatica  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comp_recibido_rnc_ncf
  ON contabilidad.comprobante_recibido (proveedor_rnc, ncf);

CREATE TABLE IF NOT EXISTS contabilidad.regla_automatica (
  clave             TEXT PRIMARY KEY,
  nivel             SMALLINT NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 0 AND 2),
  umbral_confianza  SMALLINT NOT NULL DEFAULT 90 CHECK (umbral_confianza BETWEEN 1 AND 100),
  umbral_monto      NUMERIC(14,2) NOT NULL DEFAULT 5000 CHECK (umbral_monto >= 0),
  actualizada_por   UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  actualizada_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO contabilidad.regla_automatica (clave, nivel)
VALUES ('clasificar_comprobante', 1)
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE contabilidad.regla_automatica ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chat_canal', 'chat_participante', 'chat_mensaje',
    'departamento', 'departamento_colaborador',
    'usuario_push_subscription', 'correo_cola'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;

  IF to_regclass('contabilidad.comprobante_recibido') IS NOT NULL THEN
    ALTER TABLE contabilidad.comprobante_recibido ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
