"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/contabilidad/formato";
import { enTransaccion } from "@/lib/db";
import { usuarioTienePermiso } from "@/lib/rbac";

export type ResultadoEntregaPasaje =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "no_permitido"
        | "datos_invalidos"
        | "no_encontrado"
        | "ya_entregado"
        | "error";
    };

/**
 * Confirma la entrega de una solicitud de Pasaje desde Contabilidad > Pasaje (Etapa 3).
 *
 * - Guarda el monto entregado (editable) y marca la solicitud como `entregado`
 *   tanto en Pasaje > Solicitudes como en Mis Solicitudes.
 * - NO mueve el registro a Historial (`en_historial_pasaje` sigue en `FALSE`).
 * - NO genera asiento contable en esta etapa.
 */
export async function entregarPasajeAction(datos: {
  id: string;
  montoEntregado: number;
}): Promise<ResultadoEntregaPasaje> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) {
    return { ok: false, error: "no_permitido" };
  }

  const id = String(datos.id ?? "").trim();
  const montoNum = Number(datos.montoEntregado);
  if (
    !esUuid(id) ||
    !Number.isFinite(montoNum) ||
    montoNum <= 0 ||
    montoNum >= 1e10
  ) {
    return { ok: false, error: "datos_invalidos" };
  }
  const montoRedondeado = Math.round(montoNum * 100) / 100;

  try {
    const res = await enTransaccion(async (cliente) => {
      const actual = await cliente.query<{
        id: string;
        folio: number;
        tipo: string;
        estado: string;
        titulo: string;
        solicitante_id: string | null;
      }>(
        `SELECT id, folio::int AS folio, tipo, estado, titulo, solicitante_id
           FROM public.solicitud
          WHERE id = $1
          FOR UPDATE`,
        [id],
      );
      const sol = actual.rows[0];
      if (!sol || sol.tipo !== "PASAJE" || sol.estado === "cancelada" || sol.estado === "rechazada") {
        return "no_encontrado" as const;
      }
      if (sol.estado === "entregado") {
        return "ya_entregado" as const;
      }

      await cliente.query(
        `UPDATE public.solicitud
            SET estado = 'entregado',
                monto_entregado = $2,
                entregado_por = $3,
                entregado_en = now(),
                resuelta_en = coalesce(resuelta_en, now())
          WHERE id = $1`,
        [id, montoRedondeado, usuario.id],
      );

      await cliente.query(
        `INSERT INTO public.solicitud_paso
           (solicitud_id, estado_anterior, estado_nuevo, usuario_id)
         VALUES ($1, $2, 'entregado', $3)`,
        [id, sol.estado, usuario.id],
      );

      if (sol.solicitante_id && sol.solicitante_id !== usuario.id) {
        const rolRes = await cliente.query<{ nombre: string }>(
          `SELECT r.nombre FROM public.usuario u JOIN public.rol r ON r.id = u.rol_id WHERE u.id = $1`,
          [sol.solicitante_id],
        );
        const enlace =
          rolRes.rows[0]?.nombre === "estudiante"
            ? "/portal/estudiante/solicitudes"
            : "/administrativo/solicitudes";
        await cliente.query(
          `INSERT INTO public.notificacion (usuario_id, titulo, mensaje, tipo, enlace)
           SELECT u.id, $2, 'entregado', 'solicitud', $3
             FROM public.usuario u
            WHERE u.id = $1 AND u.activo`,
          [sol.solicitante_id, `#${sol.folio} · ${sol.titulo}`, enlace],
        );
      }

      return "ok" as const;
    });

    if (res !== "ok") {
      return { ok: false, error: res };
    }
  } catch (error) {
    console.error("[pasaje] error confirmando entrega de pasaje", error);
    return { ok: false, error: "error" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "pasaje.entregado",
    entidad: "solicitud",
    entidadId: id,
    datos: { monto_entregado: montoRedondeado },
  });

  revalidatePath("/[locale]/contabilidad/pasaje", "page");
  revalidatePath("/[locale]/portal/estudiante/solicitudes", "page");
  revalidatePath("/[locale]/administrativo/solicitudes", "page");

  return { ok: true, id };
}
