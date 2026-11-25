-- Ajustes de permisos que salieron de la auditoría de coherencia (25 nov 2026).
--
-- 1. El chofer es quien más gasta efectivo en la calle (gasoil, pinchazos,
--    peajes) y no podía rendir una factura: `rendicion.enviar` le daba 403.
-- 2. `admin` ya no elimina expedientes: borrar a un becado de la base es
--    irreversible. Queda solo para `super_admin`; lo demás es archivar.
--
-- `rol_permiso` es la fuente de verdad (`rbac.ts` es el reparto de fábrica).
-- Idempotente.
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo = 'rendicion.enviar'
 WHERE r.nombre = 'chofer'
ON CONFLICT DO NOTHING;

DELETE FROM public.rol_permiso rp
 USING public.rol r, public.permiso p
 WHERE rp.rol_id = r.id
   AND rp.permiso_id = p.id
   AND r.nombre = 'admin'
   AND p.codigo = 'expedientes.eliminar';
