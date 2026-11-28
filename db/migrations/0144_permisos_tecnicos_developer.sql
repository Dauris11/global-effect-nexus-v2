-- ================================================================
-- 0144 · Permisos técnicos exclusivos del developer y protección del último owner
-- ================================================================
-- · `owner` manda en el NEGOCIO; la plataforma (IA, conocimiento, actividad y auditoría técnicas, parámetros
--   técnicos y el panel /dev) es del `developer`. Seis permisos nuevos `tecnico.*`: solo `developer` los trae en
--   `rol_permiso` y `usuarioTienePermiso` (src/lib/rbac.ts) además los niega a cualquier otro rol aunque alguien
--   los conceda por excepción personal.
-- · `ia.administrar` queda sin uso (sus pantallas pasan a `tecnico.ia` y `tecnico.conocimiento`): se le retira al
--   owner para que la base diga lo mismo que el menú. La fila del permiso se conserva por compatibilidad.
-- · Defensa en la base: nadie puede quitarle el rol, desactivar ni borrar al ÚLTIMO owner activo, entre en la
--   aplicación o por SQL. La acción del servidor lo valida antes con un mensaje claro; este trigger es el respaldo.
--
-- RLS: se revisaron `pg_policies` y `pg_proc`. Hay 8 políticas (contabilidad.centro_costo, fondo_liberacion,
-- presupuesto y presupuesto_linea) y todas son `USING (true)`: el acceso real se decide en la aplicación, ninguna
-- nombra un rol. Ninguna función SQL compara nombres de rol (la bitácora solo COPIA el nombre del rol). Por eso
-- no se cambió ninguna política.
--
-- Idempotente: se puede correr dos veces.
-- ================================================================

INSERT INTO public.permiso (codigo, descripcion) VALUES
  ('tecnico.ia',           'Configuración → IA: proveedores, modelos, cuotas y agentes (solo developer).'),
  ('tecnico.conocimiento', 'Base de conocimiento de TODOS los agentes de IA (solo developer).'),
  ('tecnico.actividad',    'Actividad técnica del sistema (solo developer).'),
  ('tecnico.auditoria',    'Auditoría técnica: audit_log y bitácoras (solo developer).'),
  ('tecnico.parametros',   'Parámetros técnicos, p. ej. escritura al «Ver como usuario» (solo developer).'),
  ('tecnico.dev_panel',    'Panel de desarrollo /dev (solo developer).')
ON CONFLICT (codigo) DO NOTHING;

-- Solo el developer los trae.
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
 CROSS JOIN public.permiso p
 WHERE r.nombre = 'developer'
   AND p.codigo LIKE 'tecnico.%'
ON CONFLICT DO NOTHING;

-- Ningún otro rol ni excepción personal puede quedarse con uno (defensivo: al crearse no había ninguno).
DELETE FROM public.rol_permiso rp
 USING public.rol r, public.permiso p
 WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
   AND p.codigo LIKE 'tecnico.%' AND r.nombre <> 'developer';

DELETE FROM public.usuario_permiso up
 USING public.permiso p
 WHERE up.permiso_id = p.id AND p.codigo LIKE 'tecnico.%';

-- El owner deja de administrar la IA (ahora es `tecnico.ia`).
DELETE FROM public.rol_permiso rp
 USING public.rol r, public.permiso p
 WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
   AND r.nombre = 'owner' AND p.codigo = 'ia.administrar';

UPDATE public.rol
   SET descripcion = 'Dueños de la Fundación: ven y hacen todo el negocio en todos los portales (no lo técnico).',
       updated_at = now()
 WHERE nombre = 'owner';

UPDATE public.rol
   SET descripcion = 'Equipo de desarrollo: acceso total más las herramientas técnicas (tecnico.*). No cuenta como personal de la Fundación.',
       updated_at = now()
 WHERE nombre = 'developer';

-- ----------------------------------------------------------------
-- Siempre queda al menos un owner ACTIVO.
-- Solo actúa si el que sale era un owner activo y no queda otro: si hoy no hay ninguno activo no bloquea nada
-- (no se puede «quitar al último» de quien no existe).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_ultimo_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_owner uuid;
  v_quedan integer;
BEGIN
  SELECT id INTO v_owner FROM public.rol WHERE nombre = 'owner';

  IF v_owner IS NULL OR OLD.rol_id IS DISTINCT FROM v_owner OR NOT OLD.activo THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Sigue siendo owner activo: no hay nada que proteger.
  IF TG_OP = 'UPDATE' AND NEW.rol_id = v_owner AND NEW.activo THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_quedan
    FROM public.usuario u
   WHERE u.rol_id = v_owner AND u.activo AND u.id <> OLD.id;

  IF v_quedan = 0 THEN
    RAISE EXCEPTION 'ultimo_owner: debe quedar al menos un owner activo'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_ultimo_owner ON public.usuario;
CREATE TRIGGER trg_proteger_ultimo_owner
  BEFORE UPDATE OF rol_id, activo OR DELETE ON public.usuario
  FOR EACH ROW EXECUTE FUNCTION public.proteger_ultimo_owner();
