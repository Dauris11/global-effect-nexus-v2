-- ================================================================
-- 0135 · «Tarde» en la asistencia (360 y materias de la carrera)
-- ================================================================
-- Hasta aquí la marca era solo presente/ausente. «Tarde» es una presencia con
-- llegada tardía, así que `presente` queda en TRUE y se agrega `tarde` aparte:
-- todo lo que ya cuenta presentes (porcentajes, expediente, portal del
-- estudiante) sigue contando igual sin tocarse, y quien quiera distinguirlas
-- mira `tarde`. El CHECK impide la combinación absurda «ausente y tarde».
--
-- Aditiva e idempotente: filas existentes quedan con tarde = false.
-- ================================================================

ALTER TABLE public.asistencia_360
  ADD COLUMN IF NOT EXISTS tarde BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.asistencia_360
  DROP CONSTRAINT IF EXISTS asistencia_360_tarde_presente;
ALTER TABLE public.asistencia_360
  ADD CONSTRAINT asistencia_360_tarde_presente CHECK (NOT tarde OR presente);

ALTER TABLE public.asistencia_materia
  ADD COLUMN IF NOT EXISTS tarde BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.asistencia_materia
  DROP CONSTRAINT IF EXISTS asistencia_materia_tarde_presente;
ALTER TABLE public.asistencia_materia
  ADD CONSTRAINT asistencia_materia_tarde_presente CHECK (NOT tarde OR presente);

COMMENT ON COLUMN public.asistencia_360.tarde IS
  'Llegó tarde. Implica presente = true; la marca de ausente nunca es tarde.';
COMMENT ON COLUMN public.asistencia_materia.tarde IS
  'Llegó tarde. Implica presente = true; la marca de ausente nunca es tarde.';
