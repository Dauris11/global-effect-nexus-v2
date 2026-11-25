-- El estudiante ya no agenda reuniones (decisión de Dirección, 25 nov 2026).
--
-- Tenía `reuniones.agendar` de fábrica y veía el directorio completo de la
-- directiva, administración y profesores: en una fundación el estudiante pide
-- una cita con su tutor o coordinador (por una solicitud), no convoca a la
-- Dirección Ejecutiva. Conserva `reuniones.leer`: sigue viendo las reuniones a
-- las que lo convocan. `rol_permiso` es la fuente de verdad; idempotente.
DELETE FROM public.rol_permiso rp
 USING public.rol r, public.permiso p
 WHERE rp.rol_id = r.id
   AND rp.permiso_id = p.id
   AND r.nombre = 'estudiante'
   AND p.codigo = 'reuniones.agendar';
