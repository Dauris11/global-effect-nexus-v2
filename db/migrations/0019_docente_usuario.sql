-- ================================================================
-- GLOBAL EFFECT NEXUS — 0019 · Vínculo docente ↔ usuario
-- ================================================================
-- El Portal Profesor (ClickUp S6 · #400) tiene que responder a una
-- pregunta que hoy la base de datos no puede contestar: "¿cuáles de
-- estos cursos son MÍOS?".
--
-- `curso.docente` y `materia.profesor_nombre` son TEXT libres (0006).
-- Sirven para imprimir un nombre en una tarjeta, pero no para filtrar
-- por identidad: "Juan Pérez" y "Juan A. Pérez" son la misma persona y
-- dos cadenas distintas, y dos homónimos son dos personas y una sola
-- cadena. Un portal que decide qué ve cada docente comparando texto
-- acaba enseñándole a alguien los cursos de otro, o ninguno.
--
-- Esta migración añade la relación real —una FK a `usuario`— **sin
-- quitar** las columnas de texto. Se conservan a propósito:
--
--   • No todo docente es usuario del sistema. Un curso técnico puede
--     impartirlo un tallerista externo que nunca va a iniciar sesión;
--     su nombre debe seguir apareciendo en la tarjeta del curso.
--   • Es un dato histórico. Si el usuario se borra, la FK cae a NULL
--     (ON DELETE SET NULL) y el nombre de quien dio el curso el año
--     pasado no desaparece del registro.
--
-- Regla de lectura: la FK manda para "de quién es"; el texto manda
-- para "qué nombre se muestra".
--
-- El backfill enlaza solo las coincidencias exactas de nombre
-- (normalizando espacios y mayúsculas). Es deliberadamente
-- conservador: prefiere dejar filas sin enlazar —que la coordinación
-- corrige eligiendo el docente en el formulario— antes que atribuirle
-- un curso a la persona equivocada.
--
-- Idempotente. Aplicar como rol `postgres` (npm run db:migrate).
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Columnas de relación
-- ----------------------------------------------------------------
ALTER TABLE curso
  ADD COLUMN IF NOT EXISTS docente_usuario_id UUID
    REFERENCES usuario(id) ON DELETE SET NULL;

ALTER TABLE materia
  ADD COLUMN IF NOT EXISTS profesor_usuario_id UUID
    REFERENCES usuario(id) ON DELETE SET NULL;

COMMENT ON COLUMN curso.docente_usuario_id IS
  'Docente como usuario del sistema. NULL si es externo o no está enlazado; el nombre visible sigue en curso.docente.';
COMMENT ON COLUMN materia.profesor_usuario_id IS
  'Profesor como usuario del sistema. NULL si es externo o no está enlazado; el nombre visible sigue en materia.profesor_nombre.';

-- El Portal Profesor filtra por estas columnas en cada carga.
CREATE INDEX IF NOT EXISTS idx_curso_docente_usuario   ON curso(docente_usuario_id);
CREATE INDEX IF NOT EXISTS idx_materia_profesor_usuario ON materia(profesor_usuario_id);

-- ----------------------------------------------------------------
-- 2. Backfill por nombre exacto
-- ----------------------------------------------------------------
-- Solo enlaza cuando hay UNA sola coincidencia: si dos usuarios se
-- llaman igual, la subconsulta devuelve dos filas, el `=` falla y la
-- fila se queda sin enlazar. Eso es lo correcto — ante la duda, nadie.
UPDATE curso c
   SET docente_usuario_id = (
         SELECT u.id FROM usuario u
          WHERE lower(regexp_replace(trim(u.nombre), '\s+', ' ', 'g'))
              = lower(regexp_replace(trim(c.docente), '\s+', ' ', 'g'))
       )
 WHERE c.docente IS NOT NULL
   AND c.docente <> ''
   AND c.docente_usuario_id IS NULL
   AND (SELECT COUNT(*) FROM usuario u
         WHERE lower(regexp_replace(trim(u.nombre), '\s+', ' ', 'g'))
             = lower(regexp_replace(trim(c.docente), '\s+', ' ', 'g'))) = 1;

UPDATE materia m
   SET profesor_usuario_id = (
         SELECT u.id FROM usuario u
          WHERE lower(regexp_replace(trim(u.nombre), '\s+', ' ', 'g'))
              = lower(regexp_replace(trim(m.profesor_nombre), '\s+', ' ', 'g'))
       )
 WHERE m.profesor_nombre IS NOT NULL
   AND m.profesor_nombre <> ''
   AND m.profesor_usuario_id IS NULL
   AND (SELECT COUNT(*) FROM usuario u
         WHERE lower(regexp_replace(trim(u.nombre), '\s+', ' ', 'g'))
             = lower(regexp_replace(trim(m.profesor_nombre), '\s+', ' ', 'g'))) = 1;
