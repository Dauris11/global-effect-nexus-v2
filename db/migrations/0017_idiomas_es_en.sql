-- ================================================================
-- GLOBAL EFFECT NEXUS — 0017 · Idiomas soportados: solo es/en
-- ================================================================
-- Revierte la ampliación que hizo 0014 (es/en/fr/it) y deja los dos
-- idiomas que la Fundación realmente usa: español para la operación
-- diaria en La Vega e inglés para los patrocinadores en Estados Unidos.
--
-- Francés e italiano se habían añadido por si acaso; mantenerlos exigía
-- traducir y revisar cada pantalla en cuatro idiomas sin que nadie los
-- leyera. El diccionario de datos nunca reflejó esa ampliación
-- (docs/04-modelo-de-datos/diccionario-de-datos.md ya decía `es | en`),
-- así que esta migración también devuelve la coherencia entre la base y
-- su documentación.
--
-- Antes de estrechar la restricción, cualquier fila en fr/it pasa a `es`:
-- si no, el ALTER fallaría al validar los datos existentes.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

UPDATE usuario SET idioma = 'es' WHERE idioma NOT IN ('es', 'en');

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_idioma_check;
ALTER TABLE usuario
  ADD CONSTRAINT usuario_idioma_check
  CHECK (idioma IN ('es', 'en'));
