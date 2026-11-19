-- ================================================================
-- GLOBAL EFFECT NEXUS — 0088 · Nota final y actualización en inscripción
-- ================================================================
-- Agrega `nota_final` y `updated_at` a `public.inscripcion` para que el
-- docente pueda cerrar la calificación final de las materias asignadas y
-- reflejarla en el historial académico del estudiante.
-- ================================================================

ALTER TABLE public.inscripcion
  ADD COLUMN IF NOT EXISTS nota_final NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.inscripcion.nota_final IS
  'Nota final (0–100) registrada por el docente de la materia asignada.';
