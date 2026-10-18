-- ================================================================
-- GLOBAL EFFECT NEXUS — 0042 · Aula Virtual Estilo Moodle y
-- Matrícula Cuatrimestral Obligatoria Global Effect 360
-- ================================================================
-- Requerimientos de la Fundación Global Effect y Tesis de Grado:
--   1. Matrícula y selección cuatrimestral obligatoria (dos veces por cuatrimestre:
--      Ronda Regular de Inicio y Ronda de Ajustes / Segundo Bloque)
--      con horarios semanales, aulas y docentes asignados.
--   2. Tareas estilo Moodle con restricciones estrictas de formato
--      (pdf, docx, zip, etc.), tamaño máximo en megabytes (MB),
--      buzón de entregas con fecha límite, entregas tardías y feedback docente.
--   3. Soporte para previsualización "Vista de Estudiante" para docentes.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0042_aula_virtual_moodle_y_matricula_360.sql', true);

-- ----------------------------------------------------------------
-- 1. Ampliación de asignaciones tipo Moodle
-- ----------------------------------------------------------------

ALTER TABLE public.asignacion
  ADD COLUMN IF NOT EXISTS limite_mb               integer NOT NULL DEFAULT 10 CHECK (limite_mb > 0 AND limite_mb <= 100),
  ADD COLUMN IF NOT EXISTS formatos_permitidos    text[] NOT NULL DEFAULT ARRAY['pdf', 'docx', 'zip'],
  ADD COLUMN IF NOT EXISTS puntaje_maximo          numeric(5,2) NOT NULL DEFAULT 100.00 CHECK (puntaje_maximo > 0),
  ADD COLUMN IF NOT EXISTS permite_entregas_tardias boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS instrucciones_entrega  text;

-- ----------------------------------------------------------------
-- 2. Metadatos de entrega del estudiante en buzón
-- ----------------------------------------------------------------

ALTER TABLE public.entrega_estudiante
  ADD COLUMN IF NOT EXISTS archivo_nombre       text,
  ADD COLUMN IF NOT EXISTS archivo_tamano_mb    numeric(5,2),
  ADD COLUMN IF NOT EXISTS archivo_formato      text,
  ADD COLUMN IF NOT EXISTS comentario_estudiante text,
  ADD COLUMN IF NOT EXISTS revisada_en          timestamptz;

-- ----------------------------------------------------------------
-- 3. Horarios, Aulas y Cupos en Materias de Global Effect 360
-- ----------------------------------------------------------------

ALTER TABLE public.materia_360
  ADD COLUMN IF NOT EXISTS horario     text,
  ADD COLUMN IF NOT EXISTS aula        text,
  ADD COLUMN IF NOT EXISTS cupo_maximo integer DEFAULT 30 CHECK (cupo_maximo > 0);

-- ----------------------------------------------------------------
-- 4. Soporte para dos rondas de matrícula cuatrimestral
-- ----------------------------------------------------------------

ALTER TABLE public.ventana_prematricula
  ADD COLUMN IF NOT EXISTS ronda integer DEFAULT 1 CHECK (ronda IN (1, 2));

ALTER TABLE public.inscripcion_360
  ADD COLUMN IF NOT EXISTS ronda integer DEFAULT 1 CHECK (ronda IN (1, 2));

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_asignacion_limite_mb ON public.asignacion (limite_mb);
CREATE INDEX IF NOT EXISTS idx_entrega_revisada_en ON public.entrega_estudiante (revisada_en);
