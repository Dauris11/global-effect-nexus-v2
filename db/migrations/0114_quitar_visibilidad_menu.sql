-- ================================================================
-- PORTAL GLOBALEFFECT — 0114 · Se quita la visibilidad de menús
-- ================================================================
-- La visibilidad (0060) era una segunda lista, aparte de los permisos, que
-- decía qué módulos ve cada rol: dos sitios para configurar lo mismo y, a
-- veces, dos respuestas distintas. Desde ahora el menú se DERIVA del permiso
-- que declara cada entrada de `src/lib/nav.ts`: lo que una persona no puede
-- abrir, no lo ve. Se configura solo en `/configuracion/permisos`.
--
-- La tabla solo tenía una fila (el administrador con
-- `/portal/profesor/materias` oculto), sin efecto real: esa pantalla ya
-- rebotaba a quien no da clases.
-- ================================================================

DROP TABLE IF EXISTS public.visibilidad_menu;
