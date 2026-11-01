-- ================================================================
-- GLOBAL EFFECT NEXUS — 0069 · Notas de 360 por período, con peso y decisión
-- ================================================================
-- Hasta ahora las tareas de una clase de 360 colgaban de la materia, no del
-- cuatrimestre: quien repetía la materia en otro período heredaba las tareas,
-- las entregas y el promedio del intento anterior.
--
--   1. `asignacion.periodo_id`: el cuatrimestre al que pertenece la tarea.
--      NULL = datos anteriores a esta migración; siguen siendo visibles para
--      todos los inscritos de la materia para no romper nada.
--   2. `asignacion.peso`: lo que pesa la tarea en la nota final propuesta.
--   3. `inscripcion_360.decidida_por` / `decidida_en`: quién dio la materia por
--      aprobada o reprobada y cuándo. La nota decide la beca; tiene que quedar
--      anotado.
--   4. La escala de las notas por tarea: `asignacion.puntaje_maximo` permite de
--      1 a 1000, así que `entrega_estudiante.calificacion` tiene que admitir
--      hasta 1000 y ambas columnas necesitan NUMERIC(6,2): con (5,2) el
--      máximo guardable es 999.99.
-- ================================================================

ALTER TABLE public.asignacion
  ADD COLUMN IF NOT EXISTS periodo_id UUID REFERENCES public.periodo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS peso NUMERIC(5,2) NOT NULL DEFAULT 1;

ALTER TABLE public.asignacion
  DROP CONSTRAINT IF EXISTS asignacion_peso_check;
ALTER TABLE public.asignacion
  ADD CONSTRAINT asignacion_peso_check CHECK (peso > 0);

CREATE INDEX IF NOT EXISTS idx_asignacion_materia_360_periodo
  ON public.asignacion (materia_360_id, periodo_id)
  WHERE materia_360_id IS NOT NULL;

ALTER TABLE public.inscripcion_360
  ADD COLUMN IF NOT EXISTS decidida_por UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decidida_en TIMESTAMPTZ;

-- Escala por tarea
ALTER TABLE public.asignacion
  ALTER COLUMN puntaje_maximo TYPE NUMERIC(6,2);

ALTER TABLE public.entrega_estudiante
  ALTER COLUMN calificacion TYPE NUMERIC(6,2);

-- El CHECK de la 0023 era inline, así que Postgres lo nombró así.
ALTER TABLE public.entrega_estudiante
  DROP CONSTRAINT IF EXISTS entrega_estudiante_calificacion_check;
ALTER TABLE public.entrega_estudiante
  ADD CONSTRAINT entrega_estudiante_calificacion_check
  CHECK (calificacion >= 0.00 AND calificacion <= 1000.00);
