"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirRol } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { esPermiso, esRol } from "@/lib/rbac";

export type ResultadoPermiso = { ok: true } | { ok: false; error: "invalido" | "bloqueado" };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El menú y las pantallas se arman en el layout: hay que invalidarlo entero. */
function refrescarPermisos() {
  revalidatePath("/", "layout");
}

/**
 * Concede o quita un permiso a TODO un rol. Solo `super_admin`, y nunca sobre
 * `super_admin`: su acceso total no se edita, para que nadie (ni un descuido)
 * deje al dueño del sistema fuera de su propia configuración.
 */
export async function guardarPermisoRol(datos: {
  rol: string;
  permiso: string;
  concedido: boolean;
}): Promise<ResultadoPermiso> {
  const autor = await requerirRol(["super_admin"]);

  if (!esRol(datos.rol) || !esPermiso(datos.permiso)) {
    return { ok: false, error: "invalido" };
  }
  if (datos.rol === "super_admin") return { ok: false, error: "bloqueado" };

  const { rol, permiso, concedido } = datos;

  await enTransaccion(async (cliente) => {
    if (concedido) {
      await cliente.query(
        `INSERT INTO rol_permiso (rol_id, permiso_id)
         SELECT r.id, p.id FROM rol r, permiso p
          WHERE r.nombre = $1 AND p.codigo = $2
         ON CONFLICT DO NOTHING`,
        [rol, permiso],
      );
    } else {
      await cliente.query(
        `DELETE FROM rol_permiso
          WHERE rol_id = (SELECT id FROM rol WHERE nombre = $1)
            AND permiso_id = (SELECT id FROM permiso WHERE codigo = $2)`,
        [rol, permiso],
      );
    }
  });

  await registrar({
    usuarioId: autor.id,
    accion: concedido ? "permiso.rol_concedido" : "permiso.rol_retirado",
    entidad: "rol_permiso",
    datos: { rol, permiso },
  });

  refrescarPermisos();
  return { ok: true };
}

/**
 * Cambio personal sobre lo que trae el rol de una persona. `concedido: null`
 * lo borra y la persona vuelve a lo que diga su rol. Sirve para habilitar una
 * función fuera de lo nativo del rol (un profesor de Habitudes que da una
 * clase de 360) o para retirar una a una sola persona.
 */
export async function guardarExcepcionPermiso(datos: {
  usuarioId: string;
  permiso: string;
  concedido: boolean | null;
  motivo?: string;
}): Promise<ResultadoPermiso> {
  const autor = await requerirRol(["super_admin"]);

  if (!UUID.test(datos.usuarioId) || !esPermiso(datos.permiso)) {
    return { ok: false, error: "invalido" };
  }

  const persona = await consultarUna<{ id: string }>(
    `SELECT id FROM usuario WHERE id = $1`,
    [datos.usuarioId],
  );
  if (!persona) return { ok: false, error: "invalido" };

  const motivo = datos.motivo?.trim().slice(0, 300) || null;

  await enTransaccion(async (cliente) => {
    if (datos.concedido === null) {
      await cliente.query(
        `DELETE FROM usuario_permiso
          WHERE usuario_id = $1
            AND permiso_id = (SELECT id FROM permiso WHERE codigo = $2)`,
        [datos.usuarioId, datos.permiso],
      );
    } else {
      await cliente.query(
        `INSERT INTO usuario_permiso (usuario_id, permiso_id, concedido, motivo, otorgado_por)
         SELECT $1, p.id, $3, $4, $5 FROM permiso p WHERE p.codigo = $2
         ON CONFLICT (usuario_id, permiso_id)
         DO UPDATE SET concedido = EXCLUDED.concedido,
                       motivo = EXCLUDED.motivo,
                       otorgado_por = EXCLUDED.otorgado_por,
                       creado_en = now()`,
        [datos.usuarioId, datos.permiso, datos.concedido, motivo, autor.id],
      );
    }
  });

  await registrar({
    usuarioId: autor.id,
    accion:
      datos.concedido === null
        ? "permiso.excepcion_revertida"
        : "permiso.excepcion_guardada",
    entidad: "usuario_permiso",
    entidadId: datos.usuarioId,
    datos: { permiso: datos.permiso, concedido: datos.concedido, motivo },
  });

  refrescarPermisos();
  return { ok: true };
}
