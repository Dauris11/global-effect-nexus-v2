-- ================================================================
-- GLOBAL EFFECT NEXUS — 0018 · Hero de la landing sin relleno
-- ================================================================
-- La migración 0015 sembró tres "diapositivas por defecto" en
-- `landing_slide`. La intención era buena —que el panel tuviera algo
-- que editar— pero el efecto es que la página de inicio arranca con un
-- carrusel de tres mensajes genéricos que rotan solos, y ninguna
-- fundación se presenta así: el visitante no lee ninguno de los tres.
--
-- Ahora la landing tiene un hero propio, escrito, que es lo que se
-- muestra cuando no hay diapositivas activas. Estas tres se
-- **desactivan**, no se borran: siguen en la tabla y visibles en
-- /configuracion/landing, así que la coordinación puede editarlas y
-- reactivarlas cuando tenga un mensaje real que anunciar (una
-- convocatoria de becas abierta, por ejemplo) y una foto propia.
--
-- Solo afecta a las tres filas de 0015, identificadas por su título:
-- cualquier diapositiva creada después desde el panel queda intacta.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

UPDATE landing_slide
   SET activo = FALSE
 WHERE titulo IN ('Becas universitarias', 'Cursos técnicos', 'Programa Habitudes');
