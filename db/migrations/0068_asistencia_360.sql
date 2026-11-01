-- ================================================================
-- GLOBAL EFFECT NEXUS — 0068 · Asistencia por clase de Global Effect 360
-- ================================================================
-- Las clases tienen SESIONES que programa el personal administrativo
-- (`academico.escribir`); el profesor de la clase marca presente o ausente a
-- cada inscrito en cada sesión (`docencia.impartir`).
--
--   sesion_360      una fecha de clase de una materia en un período
--   asistencia_360  la marca de un inscrito en una sesión
--
-- Idempotente: se puede correr dos veces.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.sesion_360 (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_360_id UUID NOT NULL REFERENCES public.materia_360(id) ON DELETE CASCADE,
  periodo_id     UUID NOT NULL REFERENCES public.periodo(id) ON DELETE CASCADE,
  fecha          DATE NOT NULL,
  hora_inicio    TIME,
  hora_fin       TIME,
  creado_por     UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Una clase no se da dos veces el mismo día en el mismo período: la segunda
  -- sería un duplicado que partiría la asistencia en dos listas.
  UNIQUE (materia_360_id, periodo_id, fecha),
  CHECK (hora_fin IS NULL OR hora_inicio IS NULL OR hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_sesion_360_materia
  ON public.sesion_360 (materia_360_id, periodo_id, fecha);

CREATE TABLE IF NOT EXISTS public.asistencia_360 (
  sesion_id      UUID NOT NULL REFERENCES public.sesion_360(id) ON DELETE CASCADE,
  inscripcion_id UUID NOT NULL REFERENCES public.inscripcion_360(id) ON DELETE CASCADE,
  presente       BOOLEAN NOT NULL,
  marcado_por    UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  marcado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sesion_id, inscripcion_id)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_360_inscripcion
  ON public.asistencia_360 (inscripcion_id);

COMMENT ON TABLE public.sesion_360 IS
  'Fechas de clase de una materia de 360 en un período, programadas por administración. Ahí el profesor marca asistencia.';
COMMENT ON TABLE public.asistencia_360 IS
  'Presente o ausente de una inscripción en una sesión. Una sesión sin fila para un inscrito es "sin marcar", distinto de ausente.';
