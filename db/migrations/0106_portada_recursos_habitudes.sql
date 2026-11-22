-- ================================================================
-- PORTAL GLOBALEFFECT — 0106 · Portada y vistazo de los recursos de Habitudes
-- ================================================================
-- Cada material del Hub guarda una portada (imagen en el bucket privado) y un vistazo de su
-- contenido (páginas o diapositivas, títulos y primeras líneas), para identificarlo sin
-- abrirlo. Se generan al subir el archivo; si no se pueden, la tarjeta dibuja una portada
-- con el título y la descripción.
-- ================================================================

ALTER TABLE public.habitudes_recurso
  ADD COLUMN IF NOT EXISTS portada_ruta TEXT,
  ADD COLUMN IF NOT EXISTS vistazo JSONB;
