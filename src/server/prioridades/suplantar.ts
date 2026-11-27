import type { UsuarioSesion } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { esPermiso, esRol, permisosEfectivos } from "@/lib/rbac";

/**
 * La sesión de OTRA persona, armada igual que `obtenerUsuarioActual` pero desde su id. Es de LECTURA:
 * sirve para que dirección vea las prioridades de alguien del equipo (pestaña «Equipo») y para el
 * endpoint de depuración. Quien la llama comprueba que la sesión real sea super_admin; nunca se usa
 * para ejecutar acciones en nombre de otra persona.
 */
export async function usuarioSesionDe(userId: string): Promise<UsuarioSesion | null> {
  const f = await consultarUna<{
    id: string; email: string; nombre: string; idioma: string; activo: boolean; foto_url: string | null;
    rol_nombre: string; auth_user_id: string | null;
    excepciones: { permiso: string; concedido: boolean }[]; permisos_rol: string[];
  }>(
    `SELECT u.id, u.email::text AS email, u.nombre, u.idioma, u.activo, u.foto_url, r.nombre AS rol_nombre, u.auth_user_id,
            coalesce((SELECT json_agg(json_build_object('permiso', p.codigo, 'concedido', up.concedido))
                        FROM usuario_permiso up JOIN permiso p ON p.id = up.permiso_id WHERE up.usuario_id = u.id), '[]'::json) AS excepciones,
            coalesce((SELECT json_agg(p.codigo) FROM rol_permiso rp JOIN permiso p ON p.id = rp.permiso_id WHERE rp.rol_id = u.rol_id), '[]'::json) AS permisos_rol
       FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1`,
    [userId],
  );

  if (!f || !esRol(f.rol_nombre)) return null;

  const excepciones = f.excepciones.flatMap((e) => (esPermiso(e.permiso) ? [{ permiso: e.permiso, concedido: e.concedido }] : []));
  const permisosRol = f.permisos_rol.filter(esPermiso);

  return {
    id: f.id, email: f.email, nombre: f.nombre, idioma: f.idioma === "en" ? "en" : "es",
    rol: f.rol_nombre, rolReal: f.rol_nombre, authUserId: f.auth_user_id ?? "", fotoUrl: f.foto_url,
    excepciones, permisosRol,
    permisos: permisosEfectivos({ rol: f.rol_nombre, excepciones, permisosRol }),
  };
}
