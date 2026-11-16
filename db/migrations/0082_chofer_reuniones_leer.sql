-- 0082 · Permiso `reuniones.leer` para el rol `chofer`.
--
-- Cuando se convoca al chofer a una reunión operativa en `/reuniones`, la
-- consulta `listarReuniones` ya devuelve sus convocatorias, pero la página
-- exige `reuniones.leer`. Sin este permiso en `rol_permiso`, el enlace de la
-- campana de avisos lo rebotaba a su portal.

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  CROSS JOIN public.permiso p
 WHERE r.nombre = 'chofer'
   AND p.codigo = 'reuniones.leer'
ON CONFLICT DO NOTHING;

