-- ================================================================
-- GLOBAL EFFECT NEXUS — 0029 · Foto del estudiante en el expediente
-- ================================================================
-- Mismo patrón que `usuario.foto_url` (migración 0026): se guarda la
-- RUTA dentro del bucket `avatares`, no la URL completa, porque el host
-- cambia si el proyecto de Supabase se recrea.
--
-- No reutiliza `foto_id` (FK a `documento`): esa columna apunta al
-- escaneo OCR de la ficha en papel, un objeto distinto de la foto de
-- perfil que se sube desde el formulario y que se ve en la lista y en
-- la ficha del expediente.
-- ================================================================

ALTER TABLE estudiante ADD COLUMN foto_url TEXT;

COMMENT ON COLUMN estudiante.foto_url IS
  'Ruta dentro del bucket avatares (no la URL completa). NULL si el estudiante no tiene foto: la pantalla dibuja la inicial del nombre.';
