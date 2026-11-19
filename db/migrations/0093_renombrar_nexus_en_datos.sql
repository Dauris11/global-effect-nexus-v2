-- ================================================================
-- PORTAL GLOBALEFFECT — 0093 · Retirar el nombre anterior de los datos
-- ================================================================
-- El producto pasó a llamarse «Portal GlobalEffect» y su asistente «Elly AI».
-- Esto corrige los textos guardados en la base: el código QR de los activos
-- (que apuntaba al subdominio anterior) y la nota de alta del inventario.
--
-- NO se toca `contabilidad.bitacora.agente`: la bitácora es una cadena de
-- hashes que cubre la fila entera, y reescribir una fila rompería la
-- verificación de las 572 filas posteriores. Es evidencia de auditoría, no
-- texto de interfaz; las filas nuevas ya no llevan ese nombre.
-- ================================================================

UPDATE public.inventario_activo
   SET codigo_qr = replace(codigo_qr, 'nexus.globaleffect.org', 'portal.globaleffect.org')
 WHERE codigo_qr ILIKE '%nexus%';

UPDATE public.inventario_historial
   SET notas = replace(notas, 'Global Effect Nexus', 'Portal GlobalEffect')
 WHERE notas ILIKE '%nexus%';
