-- 0074 · Un solo vocabulario para el estado de una tarea.
--
-- La 0041 (torre de control) introdujo `por_hacer` y `en_revision`, pero dejó
-- `pendiente` como DEFAULT de `tarea.estado`. Resultado: lo que se creaba desde
-- el tablero nacía `pendiente` y lo que asignaba la torre nacía `por_hacer`; el
-- tablero solo pintaba `pendiente`, así que las tareas asignadas por la torre
-- (y todas las que estaban en revisión) no aparecían en ninguna columna para
-- quien debía hacerlas. Se normaliza y se cierra la puerta con un CHECK.

UPDATE public.tarea SET estado = 'por_hacer' WHERE estado = 'pendiente';

ALTER TABLE public.tarea ALTER COLUMN estado SET DEFAULT 'por_hacer';

ALTER TABLE public.tarea DROP CONSTRAINT IF EXISTS tarea_estado_valido;
ALTER TABLE public.tarea
  ADD CONSTRAINT tarea_estado_valido
  CHECK (estado IN ('por_hacer', 'en_progreso', 'en_revision', 'completada', 'cancelada'));
