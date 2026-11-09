-- 0073 · Permisos que el código esperaba y la base nunca dio.
--
-- La sesión se arma con `rol_permiso`, no con `PERMISOS_POR_ROL` de
-- `src/lib/rbac.ts`. Las migraciones que crearon `dir_habitudes` (0065) y
-- `chofer` (0064) olvidaron estos permisos, así que el director de Habitudes
-- no podía agendar ni gestionar reuniones ni usar la IA, y el chofer tampoco
-- veía el asistente, aunque el reparto de fábrica dijera lo contrario.

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  CROSS JOIN public.permiso p
 WHERE r.nombre = 'dir_habitudes'
   AND p.codigo IN ('ia.usar', 'reuniones.agendar', 'reuniones.gestionar')
ON CONFLICT DO NOTHING;

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  CROSS JOIN public.permiso p
 WHERE r.nombre = 'chofer'
   AND p.codigo = 'ia.usar'
ON CONFLICT DO NOTHING;
