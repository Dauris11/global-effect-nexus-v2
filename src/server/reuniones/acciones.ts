"use server";

import { revalidatePath } from "next/cache";
import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import type {
  EstadoReunion,
  ModalidadReunion,
  TipoReunion,
} from "@/lib/reuniones";

export type EstadoAccionReunion = {
  exito?: boolean;
  mensaje?: string;
  reunionId?: string;
  error?: string;
};

/**
 * Agenda una nueva reunión institucional o tutoría.
 *
 * Accesible para cualquier rol con el permiso `reuniones.agendar`:
 * personal administrativo, directivo, docente, contabilidad, Habitudes y estudiantes.
 */
export async function agendarReunionAction(
  _previo: EstadoAccionReunion,
  formData: FormData
): Promise<EstadoAccionReunion> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "reuniones.agendar")) {
    return { error: "No tienes permiso para agendar reuniones." };
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const tipo = (String(formData.get("tipo") ?? "coordinacion")) as TipoReunion;
  const modalidad = (String(formData.get("modalidad") ?? "presencial")) as ModalidadReunion;
  const lugarOEnlace = String(formData.get("lugar_o_enlace") ?? "").trim();
  const fecha = String(formData.get("fecha") ?? "").trim();
  const horaInicio = String(formData.get("hora_inicio") ?? "").trim();
  const horaFin = String(formData.get("hora_fin") ?? "").trim();
  const estudianteId = String(formData.get("estudiante_id") ?? "").trim() || null;
  const participantesRaw = String(formData.get("participantes") ?? "[]").trim();

  if (!titulo) return { error: "El título de la reunión es obligatorio." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida (YYYY-MM-DD)." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicio)) return { error: "Hora de inicio inválida (HH:MM)." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaFin)) return { error: "Hora de fin inválida (HH:MM)." };

  let participantesIds: { id: string; tipo: "personal" | "estudiante" }[] = [];
  try {
    participantesIds = JSON.parse(participantesRaw);
  } catch {
    participantesIds = [];
  }

  try {
    const resultado = await enTransaccion(async (cliente) => {
      // 1. Insertar reunión
      const resReunion = await cliente.query<{ id: string; folio: number }>(
        `INSERT INTO reunion (
           titulo, descripcion, tipo, modalidad, lugar_o_enlace,
           fecha, hora_inicio, hora_fin, organizador_usuario_id,
           estudiante_id, estado
         ) VALUES ($1, NULLIF($2, ''), $3, $4, NULLIF($5, ''), $6::date, $7::time, $8::time, $9, $10, 'programada')
         RETURNING id, folio`,
        [
          titulo,
          descripcion,
          tipo,
          modalidad,
          lugarOEnlace,
          fecha,
          horaInicio,
          horaFin,
          usuario.id,
          estudianteId,
        ]
      );

      const nuevaReunion = resReunion.rows[0];

      // 2. Insertar al organizador como anfitrión
      await cliente.query(
        `INSERT INTO reunion_participante (
           reunion_id, usuario_id, estudiante_id, rol_en_reunion, asistencia
         ) VALUES ($1, $2, NULL, 'anfitrion', 'confirmada')
         ON CONFLICT DO NOTHING`,
        [nuevaReunion.id, usuario.id]
      );

      // 3. Si hay estudiante vinculado directamente, insertarlo como invitado
      if (estudianteId) {
        await cliente.query(
          `INSERT INTO reunion_participante (
             reunion_id, usuario_id, estudiante_id, rol_en_reunion, asistencia
           ) VALUES ($1, NULL, $2, 'invitado', 'confirmada')
           ON CONFLICT DO NOTHING`,
          [nuevaReunion.id, estudianteId]
        );
      }

      // 4. Insertar resto de participantes convocados
      for (const p of participantesIds) {
        if (!p.id || p.id === usuario.id || p.id === estudianteId) continue;
        const usuarioPartId = p.tipo === "personal" ? p.id : null;
        const estudiantePartId = p.tipo === "estudiante" ? p.id : null;

        await cliente.query(
          `INSERT INTO reunion_participante (
             reunion_id, usuario_id, estudiante_id, rol_en_reunion, asistencia
           ) VALUES ($1, $2, $3, 'participante', 'pendiente')
           ON CONFLICT DO NOTHING`,
          [nuevaReunion.id, usuarioPartId, estudiantePartId]
        );
      }

      return nuevaReunion;
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "reunion.agendada",
      entidad: "reunion",
      entidadId: resultado.id,
      datos: {
        folio: resultado.folio,
        titulo,
        fecha,
        horaInicio,
        modalidad,
      },
    });

    revalidatePath("/[locale]/(portal)/reuniones", "page");
    revalidatePath("/[locale]/(portal)/calendario", "page");
    revalidatePath("/[locale]/(portal)/portal/estudiante/calendario", "page");

    return {
      exito: true,
      mensaje: `Reunión #${resultado.folio} agendada con éxito.`,
      reunionId: resultado.id,
    };
  } catch (error) {
    console.error("[reuniones] error agendando reunión", error);
    return { error: "No se pudo agendar la reunión. Intente de nuevo." };
  }
}

/**
 * Guarda o actualiza la minuta y acuerdos de una reunión completada.
 */
export async function guardarMinutaReunionAction(
  _previo: EstadoAccionReunion,
  formData: FormData
): Promise<EstadoAccionReunion> {
  const usuario = await requerirUsuario();
  const reunionId = String(formData.get("reunion_id") ?? "").trim();
  const minuta = String(formData.get("minuta") ?? "").trim();
  const marcarRealizada = formData.get("marcar_realizada") === "true";
  const asistenciasRaw = String(formData.get("asistencias") ?? "{}").trim();

  if (!reunionId) return { error: "ID de reunión no proporcionado." };
  if (!minuta) return { error: "Debe ingresar el texto o acuerdos de la minuta." };

  const reunion = await consultarUna<{
    id: string;
    organizador_usuario_id: string;
    titulo: string;
  }>("SELECT id, organizador_usuario_id, titulo FROM reunion WHERE id = $1", [reunionId]);

  if (!reunion) return { error: "Reunión no encontrada." };

  // Comprobar permiso: gestor general, admin, o el propio anfitrión organizador
  const puedeGestionar =
    usuarioTienePermiso(usuario, "reuniones.gestionar") ||
    reunion.organizador_usuario_id === usuario.id;

  if (!puedeGestionar) {
    return { error: "Solo el anfitrión o un administrador pueden redactar la minuta." };
  }

  let asistenciasMap: Record<string, string> = {};
  try {
    asistenciasMap = JSON.parse(asistenciasRaw);
  } catch {
    asistenciasMap = {};
  }

  try {
    await enTransaccion(async (cliente) => {
      await cliente.query(
        `UPDATE reunion
            SET conclusiones_o_minuta = $2,
                estado = CASE WHEN $3 THEN 'realizada' ELSE estado END,
                actualizado_en = now()
          WHERE id = $1`,
        [reunionId, minuta, marcarRealizada]
      );

      // Actualizar asistencia de participantes si se envió
      for (const [partId, estadoAsistencia] of Object.entries(asistenciasMap)) {
        if (["asistio", "ausente", "justificada", "confirmada"].includes(estadoAsistencia)) {
          await cliente.query(
            `UPDATE reunion_participante
                SET asistencia = $2
              WHERE id = $1 AND reunion_id = $3`,
            [partId, estadoAsistencia, reunionId]
          );
        }
      }
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "reunion.minuta_guardada",
      entidad: "reunion",
      entidadId: reunionId,
      datos: {
        titulo: reunion.titulo,
        marcadaRealizada: marcarRealizada,
      },
    });

    revalidatePath("/[locale]/(portal)/reuniones", "page");
    revalidatePath("/[locale]/(portal)/calendario", "page");

    return {
      exito: true,
      mensaje: "Minuta y acuerdos guardados exitosamente.",
      reunionId,
    };
  } catch (error) {
    console.error("[reuniones] error guardando minuta", error);
    return { error: "Error al registrar la minuta." };
  }
}

/**
 * Modifica fecha, horario o sala de una reunión programada.
 */
export async function actualizarReunionAction(
  _previo: EstadoAccionReunion,
  formData: FormData
): Promise<EstadoAccionReunion> {
  const usuario = await requerirUsuario();
  const reunionId = String(formData.get("reunion_id") ?? "").trim();
  const fecha = String(formData.get("fecha") ?? "").trim();
  const horaInicio = String(formData.get("hora_inicio") ?? "").trim();
  const horaFin = String(formData.get("hora_fin") ?? "").trim();
  const lugarOEnlace = String(formData.get("lugar_o_enlace") ?? "").trim();
  const estado = String(formData.get("estado") ?? "programada") as EstadoReunion;

  if (!reunionId) return { error: "ID de reunión no proporcionado." };

  const reunion = await consultarUna<{
    id: string;
    organizador_usuario_id: string;
  }>("SELECT id, organizador_usuario_id FROM reunion WHERE id = $1", [reunionId]);

  if (!reunion) return { error: "Reunión no encontrada." };

  const puedeGestionar =
    usuarioTienePermiso(usuario, "reuniones.gestionar") ||
    reunion.organizador_usuario_id === usuario.id;

  if (!puedeGestionar) {
    return { error: "No tienes permiso para modificar esta reunión." };
  }

  try {
    await enTransaccion(async (cliente) => {
      await cliente.query(
        `UPDATE reunion
            SET fecha = COALESCE(NULLIF($2, '')::date, fecha),
                hora_inicio = COALESCE(NULLIF($3, '')::time, hora_inicio),
                hora_fin = COALESCE(NULLIF($4, '')::time, hora_fin),
                lugar_o_enlace = COALESCE(NULLIF($5, ''), lugar_o_enlace),
                estado = $6,
                actualizado_en = now()
          WHERE id = $1`,
        [reunionId, fecha, horaInicio, horaFin, lugarOEnlace, estado]
      );
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "reunion.actualizada",
      entidad: "reunion",
      entidadId: reunionId,
      datos: { fecha, horaInicio, estado },
    });

    revalidatePath("/[locale]/(portal)/reuniones", "page");
    revalidatePath("/[locale]/(portal)/calendario", "page");

    return {
      exito: true,
      mensaje: "Reunión actualizada correctamente.",
      reunionId,
    };
  } catch (error) {
    console.error("[reuniones] error actualizando reunión", error);
    return { error: "Error al actualizar la reunión." };
  }
}

/**
 * Cancela una reunión con motivo.
 */
export async function cancelarReunionAction(
  _previo: EstadoAccionReunion,
  formData: FormData
): Promise<EstadoAccionReunion> {
  const usuario = await requerirUsuario();
  const reunionId = String(formData.get("reunion_id") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!reunionId) return { error: "ID de reunión no proporcionado." };

  const reunion = await consultarUna<{
    id: string;
    organizador_usuario_id: string;
    descripcion: string | null;
  }>("SELECT id, organizador_usuario_id, descripcion FROM reunion WHERE id = $1", [reunionId]);

  if (!reunion) return { error: "Reunión no encontrada." };

  const puedeGestionar =
    usuarioTienePermiso(usuario, "reuniones.gestionar") ||
    reunion.organizador_usuario_id === usuario.id;

  if (!puedeGestionar) {
    return { error: "No tienes permiso para cancelar esta reunión." };
  }

  const descActualizada = [
    reunion.descripcion,
    motivo ? `[CANCELACIÓN]: ${motivo}` : "[CANCELADA POR ORGANIZADOR]",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    await consultarUna(
      `UPDATE reunion
          SET estado = 'cancelada',
              descripcion = $2,
              actualizado_en = now()
        WHERE id = $1`,
      [reunionId, descActualizada]
    );

    await registrar({
      usuarioId: usuario.id,
      accion: "reunion.cancelada",
      entidad: "reunion",
      entidadId: reunionId,
      datos: { motivo },
    });

    revalidatePath("/[locale]/(portal)/reuniones", "page");
    revalidatePath("/[locale]/(portal)/calendario", "page");

    return {
      exito: true,
      mensaje: "Reunión cancelada.",
      reunionId,
    };
  } catch (error) {
    console.error("[reuniones] error cancelando reunión", error);
    return { error: "Error al cancelar la reunión." };
  }
}
