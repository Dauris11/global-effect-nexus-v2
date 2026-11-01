-- ================================================================
-- GLOBAL EFFECT NEXUS — 0065 · Roles definitivos y permisos de capacidad
-- ================================================================
-- La Fundación opera con estos roles y solo estos:
--
--   super_admin     acceso total (dueño del sistema)
--   admin           administrativo: casi todo, salvo lo que es de dirección
--   docente         da clases de Global Effect 360
--   estudiante      portal del estudiante
--   contabilidad    jefe de contabilidad, contables locales y contable
--                   externa: un solo rol, diferenciado con permisos por persona
--   habitudes       profesores del programa Habitudes
--   dir_habitudes   director del programa Habitudes
--   chofer          operador de la guagua
--
-- Cambios:
--   1. Se retira `colaborador` (0055). Sus cuentas pasan a `admin`:
--      revísalas en /configuracion/permisos y bájalas de permisos si hace falta.
--   2. Permiso de capacidad `docencia.impartir`: habilita las funciones de
--      docencia de Global Effect 360. Es nativo de `docente`; el super_admin
--      se lo puede dar a una persona de otro rol (p. ej. un profesor de
--      Habitudes que además da una clase de 360) desde `usuario_permiso`.
--
-- Los permisos por rol dejan de estar fijos en código: la sesión los lee de
-- `rol_permiso`, que el super_admin edita desde la configuración.
-- ================================================================

-- 1. Permiso de capacidad
INSERT INTO public.permiso (codigo, descripcion) VALUES
  ('docencia.impartir',
   'Dar clases de Global Effect 360: portal del profesor, tareas, calificaciones y asistencia de sus clases.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo = 'docencia.impartir'
 WHERE r.nombre = 'docente'
ON CONFLICT DO NOTHING;

-- 2. Retiro del rol `colaborador`
DO $$
DECLARE
  v_colaborador UUID;
  v_admin       UUID;
  v_movidos     INT := 0;
BEGIN
  SELECT id INTO v_colaborador FROM public.rol WHERE nombre = 'colaborador';
  SELECT id INTO v_admin       FROM public.rol WHERE nombre = 'admin';

  IF v_colaborador IS NULL THEN
    RETURN; -- ya retirado: la migración es idempotente
  END IF;

  UPDATE public.usuario SET rol_id = v_admin WHERE rol_id = v_colaborador;
  GET DIAGNOSTICS v_movidos = ROW_COUNT;

  DELETE FROM public.rol_permiso     WHERE rol_id = v_colaborador;
  DELETE FROM public.visibilidad_menu WHERE rol = 'colaborador';
  DELETE FROM public.rol              WHERE id = v_colaborador;

  RAISE NOTICE '0065: % cuenta(s) de colaborador pasaron a admin', v_movidos;
END $$;
