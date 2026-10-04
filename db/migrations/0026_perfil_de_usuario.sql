-- ================================================================
-- GLOBAL EFFECT NEXUS — 0026 · Perfil editable por su dueño
-- ================================================================
-- Cada cuenta puede personalizar su perfil, sea del rol que sea: la
-- foto, el nombre con el que quiere que la llamen y una descripción
-- corta. La descripción existe sobre todo para las psicólogas: es lo
-- que un estudiante lee antes de pedirle una cita, y ayuda a que pida
-- la cita con alguien y no con un correo institucional.
--
-- Lo que NO se toca desde el perfil es el rol ni el correo: el rol lo
-- asigna el super admin en `/administrativo/personal` y el correo es la
-- identidad con la que se entra. Poder cambiarse el rol a uno mismo
-- desde su propio perfil sería una escalada de privilegios en un
-- formulario.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS foto_url    TEXT;

COMMENT ON COLUMN usuario.descripcion IS
  'Presentación breve que escribe la propia persona. En el caso de psicología, es lo que ve el estudiante al pedir cita. Máximo 280 caracteres, lo impone el servidor.';

COMMENT ON COLUMN usuario.foto_url IS
  'Ruta dentro del bucket público `avatares`, no una URL completa: el host de Supabase cambia si el proyecto se recrea, y una URL guardada quedaría muerta.';
