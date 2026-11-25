-- Audiencia de los eventos del calendario.
--
-- El «Cierre contable de noviembre» (un evento que nace de una tarea
-- administrativa) salía como «Próximo evento» en el portal del estudiante,
-- en la landing pública y en la agenda de todos: `evento` no decía para quién
-- era. `personal` = solo el equipo; `estudiantes` = estudiantes y personal;
-- `todos` = también el público.
ALTER TABLE evento
  ADD COLUMN IF NOT EXISTS audiencia TEXT NOT NULL DEFAULT 'todos'
  CHECK (audiencia IN ('todos', 'estudiantes', 'personal'));

-- Lo ya existente que es interno por su origen: nació de una tarea o es administrativo.
UPDATE evento
   SET audiencia = 'personal'
 WHERE audiencia = 'todos'
   AND (tarea_id IS NOT NULL OR tipo = 'administrativo');

CREATE INDEX IF NOT EXISTS idx_evento_audiencia ON evento (audiencia);
