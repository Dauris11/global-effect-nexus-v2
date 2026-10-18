"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { tienePermiso } from "@/lib/rbac";
import {
  ESTADOS_RENDICION,
  ESTADOS_TAREA_COLABORADOR,
  type EstadoRendicion,
  type EstadoTareaColaborador,
  ROLES_ASIGNABLES_PROYECTO,
  type RolAsignableProyecto,
} from "@/lib/torre-control";

export type ResultadoAccion = {
  ok: boolean;
  mensaje?: string;
};

/**
 * Actualiza el estado de una tarea asignada o visible al colaborador.
 */
export async function cambiarEstadoTareaColaboradorAction(
  id: string,
  nuevoEstado: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  if (!ESTADOS_TAREA_COLABORADOR.includes(nuevoEstado as EstadoTareaColaborador)) {
    return { ok: false, mensaje: "Estado de tarea inválido" };
  }

  try {
    const actualizada = await enTransaccion(async (cliente) => {
      // Verificar si el usuario puede mover la tarea
      const { rows: permisos } = await cliente.query<{ id: string; titulo: string }>(
        `SELECT t.id, t.titulo
           FROM public.tarea t
          WHERE t.id = $1
            AND (t.visibilidad = 'todos'
                 OR $2 = true
                 OR EXISTS (SELECT 1 FROM public.tarea_asignado ta
                             WHERE ta.tarea_id = t.id AND ta.usuario_id = $3))`,
        [id, tienePermiso(usuario.rol, "operaciones.escribir"), usuario.id],
      );

      if (permisos.length === 0) {
        return null;
      }

      await cliente.query(
        `UPDATE public.tarea
            SET estado = $2,
                updated_at = now()
          WHERE id = $1`,
        [id, nuevoEstado],
      );

      // Si la tarea se completó, sincronizar el evento de calendario
      await cliente.query(
        `UPDATE public.evento
            SET estado = CASE WHEN $2 = 'completada' THEN 'completado' ELSE 'programado' END
          WHERE tarea_id = $1`,
        [id, nuevoEstado],
      );

      return permisos[0];
    });

    if (!actualizada) {
      return { ok: false, mensaje: "No tienes permiso para modificar esta tarea o no existe." };
    }

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.colaborador_avance",
      entidad: "tarea",
      entidadId: id,
      datos: { nuevoEstado, titulo: actualizada.titulo },
    });

    revalidatePath("/administrativo/tareas");
    revalidatePath("/administrativo/tareas/hoy");
    return { ok: true };
  } catch (error) {
    console.error("[colaborador] Error al actualizar estado de tarea:", error);
    return { ok: false, mensaje: "Error interno al actualizar la tarea." };
  }
}

/**
 * Registra una tarea rápida del colaborador (ej. compra urgente, diligencia, mandado).
 */
export async function crearTareaRapidaColaboradorAction(
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const titulo = String(datos.get("titulo") ?? "").trim();
  const descripcion = String(datos.get("descripcion") ?? "").trim() || null;
  const prioridad = String(datos.get("prioridad") ?? "media").toLowerCase();
  const fechaLimite = String(datos.get("fecha_limite") ?? "").trim() || null;
  const proyectoId = String(datos.get("proyecto_id") ?? "").trim() || null;

  if (!titulo) {
    return { ok: false, mensaje: "El título de la tarea es obligatorio." };
  }

  try {
    const tareaId = await enTransaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO public.tarea (titulo, descripcion, estado, prioridad, visibilidad, fecha_limite, proyecto_id)
         VALUES ($1, $2, 'por_hacer', $3, 'asignados', $4::date, $5)
         RETURNING id`,
        [titulo, descripcion, prioridad, fechaLimite, proyectoId],
      );

      const nuevaId = rows[0].id;

      // Autoasignar al colaborador
      await cliente.query(
        `INSERT INTO public.tarea_asignado (tarea_id, usuario_id)
         VALUES ($1, $2)`,
        [nuevaId, usuario.id],
      );

      // Si tiene fecha, crear evento en calendario
      if (fechaLimite) {
        await cliente.query(
          `INSERT INTO public.evento (titulo, descripcion, tipo, fecha, estado, tarea_id)
           VALUES ($1, $2, 'administrativo', $3::date, 'programado', $4)`,
          [titulo, descripcion, fechaLimite, nuevaId],
        );
      }

      return nuevaId;
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.creacion_rapida",
      entidad: "tarea",
      entidadId: tareaId,
      datos: { titulo, prioridad },
    });

    revalidatePath("/administrativo/tareas");
    revalidatePath("/administrativo/tareas/hoy");
    return { ok: true };
  } catch (error) {
    console.error("[colaborador] Error al crear tarea rápida:", error);
    return { ok: false, mensaje: "Error al registrar la tarea." };
  }
}

/**
 * Registra una entrada en la bitácora diaria del colaborador.
 */
export async function registrarBitacoraDiariaAction(
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const descripcion = String(datos.get("descripcion") ?? "").trim();
  const minutos = parseInt(String(datos.get("minutos") ?? "0"), 10);
  const tareaId = String(datos.get("tarea_id") ?? "").trim() || null;

  if (!descripcion) {
    return { ok: false, mensaje: "La descripción de la actividad es requerida." };
  }

  try {
    await enTransaccion(async (cliente) => {
      await cliente.query(
        `INSERT INTO public.colaborador_bitacora_diaria (usuario_id, fecha, descripcion, tarea_id, minutos_dedicados)
         VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
        [usuario.id, descripcion, tareaId, isNaN(minutos) ? 0 : minutos],
      );
    });

    revalidatePath("/administrativo/tareas");
    revalidatePath("/administrativo/tareas/hoy");
    return { ok: true };
  } catch (error) {
    console.error("[colaborador] Error al registrar bitácora:", error);
    return { ok: false, mensaje: "No se pudo guardar la actividad en la bitácora." };
  }
}

/**
 * Registra una rendición de gastos con foto/comprobante u OCR.
 */
export async function enviarRendicionGastoAction(
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirPermiso("rendicion.enviar");

  const proveedorNombre = String(datos.get("proveedor_nombre") ?? "").trim();
  const proveedorRnc = String(datos.get("proveedor_rnc") ?? "").trim() || null;
  const ncf = String(datos.get("ncf") ?? "").trim().toUpperCase() || null;
  const programaId = String(datos.get("programa_id") ?? "").trim() || null;
  const fechaComprobante = String(datos.get("fecha_comprobante") ?? "").trim();
  const montoTotal = parseFloat(String(datos.get("monto_total") ?? "0"));
  const montoItbis = parseFloat(String(datos.get("monto_itbis") ?? "0"));
  const concepto = String(datos.get("concepto") ?? "").trim();
  const comprobanteUrl = String(datos.get("comprobante_url") ?? "").trim() || null;
  const ocrRaw = String(datos.get("ocr_data") ?? "").trim();

  if (!proveedorNombre) {
    return { ok: false, mensaje: "El nombre del proveedor es obligatorio." };
  }
  if (!concepto) {
    return { ok: false, mensaje: "El concepto del gasto es obligatorio." };
  }
  if (isNaN(montoTotal) || montoTotal <= 0) {
    return { ok: false, mensaje: "El monto total debe ser mayor a 0." };
  }

  // Validación de NCF dominicano (B01, B02, B11, B14, B15, E31, etc.)
  if (ncf && !/^[BE][0-9]{8,12}$/.test(ncf)) {
    return { ok: false, mensaje: "El formato de NCF no es válido según DGII (ej. B0100000001 o E310000000001)." };
  }

  let ocrJson: Record<string, unknown> | null = null;
  if (ocrRaw) {
    try {
      ocrJson = JSON.parse(ocrRaw);
    } catch {
      ocrJson = null;
    }
  }

  try {
    const rendicionId = await enTransaccion(async (cliente) => {
      const codigoRes = await cliente.query<{ codigo: string }>(
        `SELECT public.siguiente_codigo_rendicion() AS codigo`,
      );
      const codigo = codigoRes.rows[0].codigo;

      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO public.rendicion_gasto (
           codigo, empleado_id, programa_id, proveedor_nombre, proveedor_rnc,
           ncf, fecha_comprobante, monto_total, monto_itbis, concepto,
           comprobante_url, ocr_data, estado
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, 'enviada')
         RETURNING id`,
        [
          codigo,
          usuario.id,
          programaId,
          proveedorNombre,
          proveedorRnc,
          ncf,
          fechaComprobante || new Date().toISOString().split("T")[0],
          montoTotal,
          isNaN(montoItbis) ? 0 : montoItbis,
          concepto,
          comprobanteUrl,
          ocrJson ? JSON.stringify(ocrJson) : null,
        ],
      );

      return rows[0].id;
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "rendicion.creada",
      entidad: "rendicion_gasto",
      entidadId: rendicionId,
      datos: { proveedorNombre, montoTotal, ncf },
    });

    revalidatePath("/administrativo/rendiciones");
    revalidatePath("/portal/contabilidad/gastos");
    return { ok: true, mensaje: "Rendición de gasto enviada correctamente a revisión contable." };
  } catch (error) {
    console.error("[rendicion] Error al enviar rendición de gasto:", error);
    return { ok: false, mensaje: "Error al registrar la rendición de gasto." };
  }
}

/**
 * Revisa una rendición de gasto: aprobar, rechazar o marcar contabilizada.
 */
export async function revisarRendicionGastoAction(
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirPermiso("rendicion.revisar");
  const id = String(datos.get("id") ?? "").trim();
  const nuevoEstado = String(datos.get("estado") ?? "").trim();
  const motivoRechazo = String(datos.get("motivo_rechazo") ?? "").trim() || null;

  if (!ESTADOS_RENDICION.includes(nuevoEstado as EstadoRendicion)) {
    return { ok: false, mensaje: "Estado de rendición inválido." };
  }

  if (nuevoEstado === "rechazada" && !motivoRechazo) {
    return { ok: false, mensaje: "Debe indicar el motivo del rechazo." };
  }

  try {
    const actualizada = await consultarUna<{ id: string; codigo: string }>(
      `UPDATE public.rendicion_gasto
          SET estado = $2,
              motivo_rechazo = CASE WHEN $2 = 'rechazada' THEN $3 ELSE NULL END,
              revisado_por = $4,
              revisado_en = now()
        WHERE id = $1
        RETURNING id, codigo`,
      [id, nuevoEstado, motivoRechazo, usuario.id],
    );

    if (!actualizada) {
      return { ok: false, mensaje: "La rendición especificada no existe." };
    }

    await registrar({
      usuarioId: usuario.id,
      accion: `rendicion.${nuevoEstado}`,
      entidad: "rendicion_gasto",
      entidadId: id,
      datos: { nuevoEstado, motivoRechazo, codigo: actualizada.codigo },
    });

    revalidatePath("/administrativo/rendiciones");
    revalidatePath("/portal/contabilidad/gastos");
    return { ok: true, mensaje: `Rendición ${actualizada.codigo} actualizada a ${nuevoEstado}.` };
  } catch (error) {
    console.error("[rendicion] Error al revisar rendición:", error);
    return { ok: false, mensaje: "Error al actualizar la rendición de gasto." };
  }
}

/**
 * Asigna programas o proyectos a roles institucionales (Gobernanza exclusiva de Superadmin).
 */
export async function guardarAsignacionProyectosRolesAction(
  proyectoId: string,
  roles: string[],
): Promise<ResultadoAccion> {
  const usuario = await requerirPermiso("proyectos.asignar_rol");

  const rolesFiltrados = roles.filter((r) =>
    ROLES_ASIGNABLES_PROYECTO.includes(r as RolAsignableProyecto),
  );

  try {
    await enTransaccion(async (cliente) => {
      // Eliminar asignaciones previas de este proyecto
      await cliente.query(
        `DELETE FROM public.proyecto_rol WHERE proyecto_id = $1`,
        [proyectoId],
      );

      // Insertar nuevas asignaciones
      for (const rol of rolesFiltrados) {
        await cliente.query(
          `INSERT INTO public.proyecto_rol (proyecto_id, rol, asignado_por)
           VALUES ($1, $2, $3)`,
          [proyectoId, rol, usuario.id],
        );
      }
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "proyecto.asignacion_roles",
      entidad: "proyecto",
      entidadId: proyectoId,
      datos: { roles: rolesFiltrados },
    });

    revalidatePath("/administrativo/proyectos");
    revalidatePath("/administrativo/proyectos/roles");
    return { ok: true };
  } catch (error) {
    console.error("[proyectos] Error al asignar roles al proyecto:", error);
    return { ok: false, mensaje: "Error al guardar la asignación de roles." };
  }
}
