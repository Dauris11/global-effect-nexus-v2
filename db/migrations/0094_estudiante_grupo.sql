-- ================================================================
-- PORTAL GLOBALEFFECT — 0094 · Grupo (cohorte) del estudiante
-- ================================================================
-- Cada estudiante pertenece a un grupo, numerado en orden de ingreso (hoy se va
-- por el 10, y seguirá creciendo: por eso no se topa). Es un número simple y
-- nullable: los expedientes existentes quedan «sin grupo» hasta que
-- administración los asigne; no se adivina por la fecha de ingreso.
-- ================================================================

ALTER TABLE public.estudiante
  ADD COLUMN IF NOT EXISTS grupo smallint CHECK (grupo IS NULL OR grupo > 0);

CREATE INDEX IF NOT EXISTS idx_estudiante_grupo ON public.estudiante (grupo);

COMMENT ON COLUMN public.estudiante.grupo IS
  'Número del grupo (cohorte) de la Fundación al que pertenece. NULL = sin asignar.';
