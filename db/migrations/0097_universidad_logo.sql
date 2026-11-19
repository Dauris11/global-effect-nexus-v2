-- Logo de cada universidad: ruta dentro del bucket público `avatares`
-- (universidades/<id>.<ext>), igual que las fotos de perfil. Se guarda la ruta y
-- no la URL, porque el host cambia si el proyecto de Supabase se recrea.
ALTER TABLE universidad ADD COLUMN logo_ruta TEXT;
