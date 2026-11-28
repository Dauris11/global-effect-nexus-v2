-- ================================================================
-- 0138 · Roles `owner` y `developer`
-- ================================================================
-- · `super_admin` pasa a llamarse `owner`: son los dueños de la Fundación y ven y hacen TODO en todos los portales
--   (todos los permisos; antes no operaba contabilidad ni daba el segundo visto bueno de solicitudes).
-- · Nuevo rol `developer`: el equipo de desarrollo, con los mismos permisos que `owner` y «Ver como» para probar
--   cada portal. No es dueño de nada.
--
-- Las migraciones anteriores siguen diciendo `super_admin`: esta renombra la fila, así que una base nueva llega al
-- mismo estado. Idempotente: se puede correr dos veces.
-- ================================================================

UPDATE public.rol
   SET nombre = 'owner',
       descripcion = 'Dueños de la Fundación: ven y hacen todo en todos los portales.',
       updated_at = now()
 WHERE nombre = 'super_admin'
   AND NOT EXISTS (SELECT 1 FROM public.rol WHERE nombre = 'owner');

INSERT INTO public.rol (nombre, descripcion)
SELECT 'developer', 'Equipo de desarrollo: ve y prueba todo (mismos permisos que owner).'
 WHERE NOT EXISTS (SELECT 1 FROM public.rol WHERE nombre = 'developer');

-- Todos los permisos para los dos.
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
 CROSS JOIN public.permiso p
 WHERE r.nombre IN ('owner', 'developer')
ON CONFLICT DO NOTHING;
