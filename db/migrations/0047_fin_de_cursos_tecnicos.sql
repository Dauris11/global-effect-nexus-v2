-- ================================================================
-- GLOBAL EFFECT NEXUS — 0047 · Fin de los cursos técnicos
-- ================================================================
-- En octubre de 2026 la Fundación dejó de impartir cursos técnicos.
-- Lo único que queda de formación propia es Global Effect 360, que
-- pasa a ocupar el lugar que tenían los cursos: docente, tareas,
-- entregas y nota final.
--
-- Igual que la 0030 con Psicología, las migraciones que crearon lo
-- que aquí se retira (0006, 0013, 0019, 0027, 0028) se quedan en el
-- repositorio: una migración aplicada no se reescribe, se anula con
-- otra posterior.
--
-- Siete cambios, en este orden:
--
--   1. Un solo tipo de estudiante. El `regular` existía para el
--      alumno de curso técnico; sin cursos, todo estudiante es
--      `becado`, y el valor se retira del ENUM para que no vuelva a
--      entrar un estudiante que nadie sabría a qué programa mandar.
--   2. Las tareas de curso se borran y `asignacion.curso_id` se va.
--      Una tarea cuelga ahora de una materia universitaria o de una
--      materia de 360: exactamente de una.
--   3. Se borran `calificacion` y `curso`. DROP sin copia, decidido
--      por la Fundación: notas por evaluación de un programa que ya
--      no existe, sin pantalla que las lea, no sirven a nadie.
--   4. Global Effect 360 deja de ser "solo para becados": con un
--      único tipo de estudiante, el trigger ya no protege nada.
--   5. Todo el catálogo de 360 es obligatorio. `obligatoria` se
--      retira en vez de ponerse a TRUE: una columna que siempre vale
--      lo mismo invita a que alguien vuelva a desmarcarla.
--   6. Una materia por tanda. El cuatrimestre tiene dos tandas de dos
--      meses y en cada una el estudiante cursa UNA materia de 360: dos
--      por cuatrimestre. Lo sostiene un índice único parcial, porque
--      dos clics a la vez en dos materias pasarían cualquier
--      comprobación hecha solo en el servidor.
--   7. Las descripciones del rol `docente` y de los permisos
--      académicos dejan de hablar de cursos técnicos.
--
-- `audit_log` NO se toca: sus filas sobre `curso` o `calificacion`
-- son historia de quién hizo qué y siguen valiendo sin la tabla.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0047_fin_de_cursos_tecnicos.sql', true);

-- ----------------------------------------------------------------
-- 1) Un solo tipo de estudiante
-- ----------------------------------------------------------------
UPDATE public.estudiante SET tipo = 'becado' WHERE tipo = 'regular';

-- Postgres no deja quitar un valor de un ENUM: se crea el tipo nuevo,
-- se pasa la columna y se borra el viejo.
ALTER TABLE public.estudiante ALTER COLUMN tipo DROP DEFAULT;
ALTER TYPE public.tipo_estudiante RENAME TO tipo_estudiante_0005;
CREATE TYPE public.tipo_estudiante AS ENUM ('becado');
ALTER TABLE public.estudiante
  ALTER COLUMN tipo TYPE public.tipo_estudiante USING tipo::text::public.tipo_estudiante;
ALTER TABLE public.estudiante ALTER COLUMN tipo SET DEFAULT 'becado';
DROP TYPE public.tipo_estudiante_0005;

COMMENT ON COLUMN public.estudiante.programa IS
  'Carrera universitaria del becado.';

-- ----------------------------------------------------------------
-- 2) Tareas: materia universitaria o materia de 360
-- ----------------------------------------------------------------
-- Las entregas cuelgan de `asignacion` con ON DELETE CASCADE y se van
-- con su tarea.
DELETE FROM public.asignacion WHERE curso_id IS NOT NULL;

ALTER TABLE public.asignacion DROP CONSTRAINT IF EXISTS asignacion_una_sola_unidad;
DROP INDEX IF EXISTS public.idx_asignacion_curso;
ALTER TABLE public.asignacion DROP COLUMN IF EXISTS curso_id;

ALTER TABLE public.asignacion
  ADD CONSTRAINT asignacion_una_sola_unidad CHECK (
    (materia_id     IS NOT NULL)::int +
    (materia_360_id IS NOT NULL)::int = 1
  );

COMMENT ON CONSTRAINT asignacion_una_sola_unidad ON public.asignacion IS
  'Una tarea pertenece a UNA unidad: materia universitaria o materia de Global Effect 360. Ni a ninguna ni a dos.';

-- ----------------------------------------------------------------
-- 3) Fuera `calificacion` y `curso`
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS public.calificacion;
DROP TABLE IF EXISTS public.curso;
-- Solo lo usaba `calificacion`.
DROP TYPE IF EXISTS public.tipo_evaluacion;

-- Fragmentos de conocimiento de la IA que describían un curso: su
-- fuente ya no existe y responderían con datos de un programa cerrado.
DELETE FROM public.fragmento_conocimiento WHERE fuente_tipo = 'curso';

-- Los avisos que llevan a las dos pantallas retiradas pasan a la que
-- las sustituye, para que la campana no abra un 404.
UPDATE public.notificacion
   SET enlace = '/academico/clases-360'
 WHERE enlace IN ('/academico/cursos', '/academico/calificaciones');

-- ----------------------------------------------------------------
-- 4) Global Effect 360, para todos
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_inscripcion_360_becado ON public.inscripcion_360;
DROP FUNCTION IF EXISTS public.solo_becado_en_360();

-- ----------------------------------------------------------------
-- 5) Todo el catálogo es obligatorio
-- ----------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_materia_360_activa;
ALTER TABLE public.materia_360 DROP COLUMN IF EXISTS obligatoria;
CREATE INDEX IF NOT EXISTS idx_materia_360_activa
  ON public.materia_360(activa, orden);

COMMENT ON TABLE public.materia_360 IS
  'Catálogo de Global Effect 360: materias de la Fundación, todas obligatorias. El estudiante cursa una por tanda, dos por cuatrimestre.';

-- ----------------------------------------------------------------
-- 6) Una materia por tanda
-- ----------------------------------------------------------------
UPDATE public.inscripcion_360      SET ronda = 1 WHERE ronda IS NULL;
UPDATE public.ventana_prematricula SET ronda = 1 WHERE ronda IS NULL;
ALTER TABLE public.inscripcion_360      ALTER COLUMN ronda SET NOT NULL;
ALTER TABLE public.ventana_prematricula ALTER COLUMN ronda SET NOT NULL;

-- Retirarse libera la tanda: la fila `retirada` se queda como rastro y
-- no cuenta.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inscripcion_360_una_por_tanda
  ON public.inscripcion_360(estudiante_id, periodo_id, ronda)
  WHERE estado <> 'retirada';

COMMENT ON COLUMN public.inscripcion_360.ronda IS
  'Tanda del cuatrimestre: 1 (primeros dos meses) o 2 (últimos dos). Una materia por tanda y estudiante.';
COMMENT ON COLUMN public.ventana_prematricula.ronda IS
  'Tanda que abre la ventana: 1 o 2. Cada cuatrimestre tiene las dos.';

-- ----------------------------------------------------------------
-- 7) Descripciones de rol y permisos
-- ----------------------------------------------------------------
-- Las lee la pantalla de Configuración; con el texto viejo seguiría
-- prometiendo cursos técnicos que ya no existen.
UPDATE public.rol
   SET descripcion = 'Portal docente: da clases de Global Effect 360, pone tareas y la nota final.'
 WHERE nombre = 'docente';
UPDATE public.permiso
   SET descripcion = 'Visualizar materias, clases de 360 y períodos académicos.'
 WHERE codigo = 'academico.leer';
UPDATE public.permiso
   SET descripcion = 'Crear y modificar materias, períodos y el catálogo de 360.'
 WHERE codigo = 'academico.escribir';
UPDATE public.permiso
   SET descripcion = 'Poner la nota final de las clases de Global Effect 360.'
 WHERE codigo = 'calificaciones.registrar';
