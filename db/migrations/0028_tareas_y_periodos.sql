-- ================================================================
-- GLOBAL EFFECT NEXUS — 0028 · Tareas de las tres unidades,
--                              semestre o cuatrimestre, y docente de 360
-- ================================================================
-- Tres cambios que van juntos porque los pide el mismo trabajo: que el
-- profesor de curso técnico gestione sus materias, que Global Effect 360
-- se administre aparte, y que el estudiante entregue un PDF.
--
-- 1) UNA TAREA, TRES UNIDADES POSIBLES.
--    `asignacion` colgaba solo de `materia`, que es la asignatura
--    universitaria del becado. Pero hay tres cosas distintas que ponen
--    tareas y no se pueden confundir:
--
--      · `materia`     — carrera universitaria del becado
--      · `curso`       — curso técnico del estudiante `regular`
--      · `materia_360` — programa Global Effect 360
--
--    Se resuelve con tres columnas anulables y un CHECK que exige
--    EXACTAMENTE una. La alternativa —una columna `tipo` y un id suelto—
--    renuncia a las claves ajenas, y entonces nada impide que una tarea
--    apunte a un curso que ya no existe.
--
-- 2) SEMESTRE O CUATRIMESTRE.
--    El tipo va en `periodo` y no en `materia`: un período ES un semestre
--    o un cuatrimestre, y todas las materias que cuelgan de él comparten
--    su duración. Ponerlo en la materia permitiría que dos materias del
--    mismo período dijeran cosas distintas.
--
-- 3) QUIÉN DA CADA CLASE DE 360.
--    El catálogo de 360 lo administran admin y super admin, y eso no
--    cambia. Pero el profesor necesita ver SUS clases de 360, sus
--    inscritos y sus tareas, así que la materia tiene que saber de quién
--    es.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Tareas de cualquiera de las tres unidades
-- ----------------------------------------------------------------
ALTER TABLE asignacion
  ALTER COLUMN materia_id DROP NOT NULL;

ALTER TABLE asignacion
  ADD COLUMN IF NOT EXISTS curso_id       UUID REFERENCES curso(id)       ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS materia_360_id UUID REFERENCES materia_360(id) ON DELETE CASCADE,
  -- Quién la puso. Hace falta para que el profesor vea las suyas y para
  -- saber a quién preguntar cuando algo no cuadra.
  ADD COLUMN IF NOT EXISTS creada_por_id  UUID REFERENCES usuario(id)     ON DELETE SET NULL;

ALTER TABLE asignacion
  DROP CONSTRAINT IF EXISTS asignacion_una_sola_unidad;

ALTER TABLE asignacion
  ADD CONSTRAINT asignacion_una_sola_unidad CHECK (
    (materia_id     IS NOT NULL)::int +
    (curso_id       IS NOT NULL)::int +
    (materia_360_id IS NOT NULL)::int = 1
  );

CREATE INDEX IF NOT EXISTS idx_asignacion_curso   ON asignacion(curso_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_360     ON asignacion(materia_360_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_autor   ON asignacion(creada_por_id);

COMMENT ON CONSTRAINT asignacion_una_sola_unidad ON asignacion IS
  'Una tarea pertenece a UNA unidad: materia universitaria, curso técnico o materia de Global Effect 360. Ni a ninguna ni a dos.';

-- ----------------------------------------------------------------
-- 2) Quién revisó cada entrega
-- ----------------------------------------------------------------
-- `entrega_estudiante` ya guardaba la calificación y el comentario, pero
-- no quién los puso ni cuándo. En un sistema donde la nota decide la beca,
-- eso tiene que quedar anotado.
ALTER TABLE entrega_estudiante
  ADD COLUMN IF NOT EXISTS revisada_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisada_en     TIMESTAMPTZ;

-- ----------------------------------------------------------------
-- 3) Semestre o cuatrimestre
-- ----------------------------------------------------------------
ALTER TABLE periodo
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'cuatrimestre';

ALTER TABLE periodo DROP CONSTRAINT IF EXISTS periodo_tipo_check;
ALTER TABLE periodo
  ADD CONSTRAINT periodo_tipo_check CHECK (tipo IN ('semestre', 'cuatrimestre'));

COMMENT ON COLUMN periodo.tipo IS
  'Si el período es un semestre o un cuatrimestre. Va aquí y no en `materia` porque todas las materias de un período comparten su duración; en la materia, dos podrían decir cosas distintas del mismo período.';

-- ----------------------------------------------------------------
-- 4) Docente de una materia de Global Effect 360
-- ----------------------------------------------------------------
ALTER TABLE materia_360
  ADD COLUMN IF NOT EXISTS docente_id UUID REFERENCES usuario(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_materia_360_docente ON materia_360(docente_id);

COMMENT ON COLUMN materia_360.docente_id IS
  'Quién da esta clase. El CATÁLOGO de 360 lo administran admin y super admin y eso no cambia: esta columna solo permite que el profesor vea sus clases, sus inscritos y sus tareas desde su portal.';
