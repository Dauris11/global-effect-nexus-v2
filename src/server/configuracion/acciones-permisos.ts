"use server";

import { revalidatePath } from "next/cache";

import { requerirRol } from "@/lib/auth";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { PERMISOS, PERMISOS_POR_ROL, type Permiso, type Rol } from "@/lib/rbac";

export interface UsuarioPermisoItem {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  rolNombre: string;
  activo: boolean;
  excepciones: Array<{
    permisoCodigo: Permiso;
    concedido: boolean;
    motivo: string | null;
  }>;
}

export interface PermisoCatalogoItem {
  id: string;
  codigo: Permiso;
  descripcion: string;
  modulo: string;
}

/**
 * Obtiene la lista completa de usuarios con sus excepciones individuales de permisos.
 * Restringido estrictamente a super_admin.
 */
export async function listarUsuariosConPermisos(): Promise<{
  usuarios: UsuarioPermisoItem[];
  permisos: PermisoCatalogoItem[];
}> {
  await requerirRol(["super_admin"]);

  // 1. Obtener usuarios con su rol
  const usuariosRows = await consultar<{
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
    rol_nombre: string;
    activo: boolean;
  }>(
    `SELECT u.id, u.nombre, u.email, r.nombre AS rol, r.descripcion AS rol_nombre, u.activo
       FROM public.usuario u
       JOIN public.rol r ON r.id = u.rol_id
      ORDER BY u.nombre ASC`,
  );

  // 2. Obtener todas las excepciones de usuario_permiso
  const excepcionesRows = await consultar<{
    usuario_id: string;
    codigo: Permiso;
    concedido: boolean;
    motivo: string | null;
  }>(
    `SELECT up.usuario_id, p.codigo, up.concedido, up.motivo
       FROM public.usuario_permiso up
       JOIN public.permiso p ON p.id = up.permiso_id`,
  );

  // Agrupar excepciones por usuario
  const mapaExcepciones = new Map<string, Array<{ permisoCodigo: Permiso; concedido: boolean; motivo: string | null }>>();
  for (const exc of excepcionesRows) {
    const list = mapaExcepciones.get(exc.usuario_id) ?? [];
    list.push({
      permisoCodigo: exc.codigo,
      concedido: exc.concedido,
      motivo: exc.motivo,
    });
    mapaExcepciones.set(exc.usuario_id, list);
  }

  // 3. Catálogo de permisos
  const permisosRows = await consultar<{
    id: string;
    codigo: Permiso;
    descripcion: string;
  }>(
    `SELECT id, codigo, descripcion
       FROM public.permiso
      ORDER BY codigo ASC`,
  );

  const permisosCatalogo: PermisoCatalogoItem[] = permisosRows.map((p) => {
    const prefijo = p.codigo.split(".")[0];
    let modulo = "General";
    if (prefijo === "academico" || prefijo === "calificaciones") modulo = "Académico";
    else if (prefijo === "contabilidad" || prefijo === "finanzas" || prefijo === "rendicion") modulo = "Contabilidad & Finanzas";
    else if (prefijo === "habitudes") modulo = "Programa Habitudes";
    else if (prefijo === "expedientes" || prefijo === "solicitudes") modulo = "Expedientes & Solicitudes";
    else if (prefijo === "inventario" || prefijo === "operaciones" || prefijo === "proyectos" || prefijo === "reuniones") modulo = "Operaciones & Logística";
    else if (prefijo === "ia" || prefijo === "landing" || prefijo === "usuarios") modulo = "Administración";

    return {
      id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      modulo,
    };
  });

  const usuarios: UsuarioPermisoItem[] = usuariosRows.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    rolNombre: u.rol_nombre,
    activo: u.activo,
    excepciones: mapaExcepciones.get(u.id) ?? [],
  }));

  return { usuarios, permisos: permisosCatalogo };
}

/**
 * Guarda o revierte una excepción individual de permiso para un usuario.
 * `concedido === null` revierte a la configuración por defecto del rol (borra la excepción).
 */
export async function guardarExcepcionPermiso({
  usuarioId,
  permisoCodigo,
  concedido,
  motivo,
}: {
  usuarioId: string;
  permisoCodigo: Permiso;
  concedido: boolean | null;
  motivo?: string;
}): Promise<{ ok: boolean; mensaje: string }> {
  const superAdmin = await requerirRol(["super_admin"]);

  // Verificar que el permiso exista
  const permiso = await consultarUna<{ id: string }>(
    `SELECT id FROM public.permiso WHERE codigo = $1`,
    [permisoCodigo],
  );
  if (!permiso) {
    return { ok: false, mensaje: "Permiso no encontrado" };
  }

  await enTransaccion(async (client) => {
    if (concedido === null) {
      // Revertir excepción: volver a herencia por rol
      await client.query(
        `DELETE FROM public.usuario_permiso
          WHERE usuario_id = $1 AND permiso_id = $2`,
        [usuarioId, permiso.id],
      );

      await client.query(
        `INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, datos)
         VALUES ($1, 'permiso.revertir_excepcion', 'usuario_permiso', $2, $3::jsonb)`,
        [
          superAdmin.id,
          usuarioId,
          JSON.stringify({ permiso: permisoCodigo, accion: "revertido_a_rol" }),
        ],
      );
    } else {
      // Conceder o revocar explícitamente
      await client.query(
        `INSERT INTO public.usuario_permiso (usuario_id, permiso_id, concedido, motivo, otorgado_por)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (usuario_id, permiso_id)
         DO UPDATE SET concedido = EXCLUDED.concedido,
                       motivo = EXCLUDED.motivo,
                       otorgado_por = EXCLUDED.otorgado_por,
                       creado_en = now()`,
        [usuarioId, permiso.id, concedido, motivo ?? null, superAdmin.id],
      );

      await client.query(
        `INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, datos)
         VALUES ($1, 'permiso.cambiar_excepcion', 'usuario_permiso', $2, $3::jsonb)`,
        [
          superAdmin.id,
          usuarioId,
          JSON.stringify({
            permiso: permisoCodigo,
            concedido,
            motivo: motivo ?? null,
          }),
        ],
      );
    }
  });

  revalidatePath("/configuracion/permisos");
  return { ok: true, mensaje: "Permiso actualizado correctamente" };
}
