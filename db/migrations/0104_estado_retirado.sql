-- ================================================================
-- PORTAL GLOBALEFFECT — 0104 · Estado «retirado» y motivo de cada cambio de estado
-- ================================================================
-- Un estudiante puede retirarse (por decisión propia o de la Fundación) y eso no es lo
-- mismo que estar inactivo ni suspendido. Cada cambio de estado guarda además por qué
-- y desde qué fecha rige, para que el historial se explique solo.
-- ================================================================

ALTER TYPE public.estado_estudiante ADD VALUE IF NOT EXISTS 'retirado';

ALTER TABLE public.estudiante_etapa
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS fecha_efectiva DATE;
