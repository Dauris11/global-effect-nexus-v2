"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import type { PasajeroViaje, TipoIncidenciaTransporte } from "@/lib/transporte";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { obtenerPasajerosHorario } from "./consultas";

/**
 * Guarda o actualiza la configuración semanal recurrente de transporte del estudiante.
 * Se guarda una sola vez para que el estudiante no tenga que anotarse todos los días.
 */
export async function guardarInscripcionRecurrenteAction(inscripciones: {
  horarioId: string;
  diaSemana: number;
  paradaAbordajeId: string;
  paradaDestinoId: string;
}[]): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirUsuario();
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante.id) {
    return { ok: false, mensaje: "estudiante_no_enlazado" };
  }

  try {
    await enTransaccion(async (cliente) => {
      // Desactivar inscripciones previas del estudiante
      await cliente.query(
        `DELETE FROM transporte_inscripcion_recurrente WHERE estudiante_id = $1`,
        [estudiante.id],
      );

      // Insertar las nuevas selecciones
      for (const item of inscripciones) {
        if (!item.horarioId || !item.paradaAbordajeId || !item.paradaDestinoId) {
          continue;
        }

        await cliente.query(
          `INSERT INTO transporte_inscripcion_recurrente
             (estudiante_id, horario_id, dia_semana, parada_abordaje_id, parada_destino_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (estudiante_id, dia_semana, horario_id)
           DO UPDATE SET
             parada_abordaje_id = EXCLUDED.parada_abordaje_id,
             parada_destino_id = EXCLUDED.parada_destino_id,
             activo = true`,
          [
            estudiante.id,
            item.horarioId,
            item.diaSemana,
            item.paradaAbordajeId,
            item.paradaDestinoId,
          ],
        );
      }
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "transporte.horario_recurrente_guardado",
      entidad: "transporte_inscripcion_recurrente",
      datos: { cantidad: inscripciones.length },
    });

    revalidatePath("/portal/estudiante/transporte");
    revalidatePath("/transporte");

    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al guardar horario recurrente:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Registro puntual diario para el transporte (usado tanto en la puerta pública sin login
 * como para viajes esporádicos).
 */
export async function inscribirPuntualDiariaAction(datos: {
  horarioId: string;
  nombre: string;
  matriculaOTelefono?: string;
  paradaAbordajeId: string;
  paradaDestinoId: string;
  fecha?: string;
}): Promise<{ ok: boolean; mensaje?: string }> {
  try {
    const fecha = datos.fecha ?? new Date().toISOString().slice(0, 10);

    await enTransaccion(async (cliente) => {
      // Intentar vincular a estudiante si coincide la matrícula
      let estudianteId: string | null = null;
      if (datos.matriculaOTelefono) {
        const est = await cliente.query<{ id: string }>(
          `SELECT id FROM estudiante WHERE cedula = $1 OR telefono = $1 LIMIT 1`,
          [datos.matriculaOTelefono.trim()],
        );
        estudianteId = est.rows[0]?.id ?? null;
      }

      await cliente.query(
        `INSERT INTO transporte_inscripcion_diaria
           (fecha, horario_id, estudiante_id, nombre_beneficiario, matricula_o_telefono, parada_abordaje_id, parada_destino_id)
         VALUES ($1::date, $2, $3, $4, $5, $6, $7)`,
        [
          fecha,
          datos.horarioId,
          estudianteId,
          datos.nombre.trim(),
          datos.matriculaOTelefono?.trim() || null,
          datos.paradaAbordajeId,
          datos.paradaDestinoId,
        ],
      );
    });

    revalidatePath("/transporte");
    revalidatePath("/portal/chofer");

    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al registrar inscripción puntual:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * El chofer inicia el viaje del turno correspondiente.
 * Pone el viaje en estado 'en_curso' y comienza a transmitir su señal.
 */
export async function iniciarViajeAction(datos: {
  horarioId: string;
  lat?: number;
  lng?: number;
}): Promise<{ ok: boolean; viajeId?: string; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");

  try {
    const viaje = await enTransaccion(async (cliente) => {
      // Si ya hay un viaje 'en_curso' de este chofer hoy, lo reactiva o toma
      const existente = await cliente.query<{ id: string }>(
        `SELECT id FROM transporte_viaje
          WHERE chofer_id = $1 AND fecha = CURRENT_DATE AND estado = 'en_curso'
          LIMIT 1`,
        [usuario.id],
      );

      if (existente.rows[0]?.id) {
        return existente.rows[0];
      }

      const res = await cliente.query<{ id: string }>(
        `INSERT INTO transporte_viaje
           (horario_id, chofer_id, fecha, estado, lat_actual, lng_actual, iniciado_en)
         VALUES ($1, $2, CURRENT_DATE, 'en_curso', $3, $4, now())
         RETURNING id`,
        [datos.horarioId, usuario.id, datos.lat ?? null, datos.lng ?? null],
      );

      return res.rows[0];
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "transporte.viaje_iniciado",
      entidad: "transporte_viaje",
      entidadId: viaje.id,
      datos: { horarioId: datos.horarioId },
    });

    revalidatePath("/portal/chofer");
    revalidatePath("/portal/estudiante/transporte");
    revalidatePath("/transporte");

    return { ok: true, viajeId: viaje.id };
  } catch (error) {
    console.error("[transporte] Error al iniciar viaje:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Transmisión continua de posición GPS enviada desde el dispositivo del chofer.
 */
export async function actualizarPosicionViajeAction(datos: {
  viajeId: string;
  lat: number;
  lng: number;
  rumbo?: number;
  velocidadKmh?: number;
  paradaActualId?: string | null;
}): Promise<{ ok: boolean }> {
  const usuario = await requerirPermiso("transporte.operar");

  try {
    await consultarUna(
      `UPDATE transporte_viaje
          SET lat_actual = $2,
              lng_actual = $3,
              rumbo = COALESCE($4, rumbo),
              velocidad_kmh = COALESCE($5, velocidad_kmh),
              parada_actual_id = COALESCE($6, parada_actual_id),
              actualizado_en = now()
        WHERE id = $1 AND chofer_id = $7`,
      [
        datos.viajeId,
        datos.lat,
        datos.lng,
        datos.rumbo ?? 0,
        datos.velocidadKmh ?? 0,
        datos.paradaActualId ?? null,
        usuario.id,
      ],
    );

    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al actualizar posición GPS:", error);
    return { ok: false };
  }
}

/**
 * El chofer culmina el viaje.
 */
export async function finalizarViajeAction(datos: {
  viajeId: string;
}): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");

  try {
    await consultarUna(
      `UPDATE transporte_viaje
          SET estado = 'completado',
              finalizado_en = now(),
              actualizado_en = now()
        WHERE id = $1 AND chofer_id = $2`,
      [datos.viajeId, usuario.id],
    );

    await registrar({
      usuarioId: usuario.id,
      accion: "transporte.viaje_finalizado",
      entidad: "transporte_viaje",
      entidadId: datos.viajeId,
    });

    revalidatePath("/portal/chofer");
    revalidatePath("/portal/estudiante/transporte");
    revalidatePath("/transporte");

    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al finalizar viaje:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Reporte de problema o avería mecánica por parte del chofer.
 * Notifica de inmediato a los estudiantes inscritos en ese viaje.
 */
export async function reportarIncidenciaAction(datos: {
  viajeId: string;
  tipo: TipoIncidenciaTransporte;
  descripcion: string;
  lat?: number;
  lng?: number;
}): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");

  try {
    await enTransaccion(async (cliente) => {
      // 1. Registrar la incidencia
      await cliente.query(
        `INSERT INTO transporte_incidencia
           (viaje_id, chofer_id, tipo, descripcion, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          datos.viajeId,
          usuario.id,
          datos.tipo,
          datos.descripcion.trim(),
          datos.lat ?? null,
          datos.lng ?? null,
        ],
      );

      // 2. Si es avería mecánica, marcar el viaje como averiado
      if (datos.tipo === "averia_mecanica") {
        await cliente.query(
          `UPDATE transporte_viaje
              SET estado = 'averiado', actualizado_en = now()
            WHERE id = $1`,
          [datos.viajeId],
        );
      }

      // 3. Notificar a los estudiantes convocados a este viaje
      const viajeRes = await cliente.query<{ horario_id: string }>(
        `SELECT horario_id FROM transporte_viaje WHERE id = $1`,
        [datos.viajeId],
      );
      const horarioId = viajeRes.rows[0]?.horario_id;

      if (horarioId) {
        const titulo =
          datos.tipo === "averia_mecanica"
            ? "Aviso de Transporte: Avería técnica"
            : "Aviso de Transporte: Incidencia en ruta";

        const mensaje = datos.descripcion.trim();

        await cliente.query(
          `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
           SELECT DISTINCT e.usuario_id, $1, $2, 'alerta', '/portal/estudiante/transporte'
             FROM transporte_inscripcion_recurrente r
             JOIN estudiante e ON e.id = r.estudiante_id
            WHERE r.horario_id = $3
              AND r.activo = true
              AND r.dia_semana = EXTRACT(ISODOW FROM CURRENT_DATE)::smallint
              AND e.usuario_id IS NOT NULL`,
          [titulo, mensaje, horarioId],
        );
      }
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "transporte.incidencia_reportada",
      entidad: "transporte_incidencia",
      datos: { viajeId: datos.viajeId, tipo: datos.tipo },
    });

    revalidatePath("/portal/chofer");
    revalidatePath("/portal/estudiante/transporte");
    revalidatePath("/transporte");

    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al reportar incidencia:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Actualiza manualmente la parada actual o próxima alcanzada por la guagua.
 * Muy útil como respaldo en zonas rurales donde el GPS o la cobertura móvil fluctúan.
 */
export async function actualizarParadaActualViajeAction(datos: {
  viajeId: string;
  paradaId: string;
}): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");

  try {
    await consultarUna(
      `UPDATE transporte_viaje v
          SET parada_actual_id = p.id,
              lat_actual = COALESCE(v.lat_actual, p.lat),
              lng_actual = COALESCE(v.lng_actual, p.lng),
              actualizado_en = now()
         FROM transporte_parada p
        WHERE v.id = $1
          AND v.chofer_id = $2
          AND p.id = $3`,
      [datos.viajeId, usuario.id, datos.paradaId],
    );

    revalidatePath("/portal/chofer");
    revalidatePath("/portal/estudiante/transporte");
    revalidatePath("/transporte");

    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al actualizar parada actual:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Carga dinámica de la lista de pasajeros convocados para un horario específico.
 */
export async function obtenerPasajerosHorarioAction(
  horarioId: string,
): Promise<{ ok: boolean; pasajeros: PasajeroViaje[] }> {
  await requerirPermiso("transporte.operar");

  try {
    const pasajeros = await obtenerPasajerosHorario(horarioId);
    return { ok: true, pasajeros };
  } catch (error) {
    console.error("[transporte] Error al obtener pasajeros:", error);
    return { ok: false, pasajeros: [] };
  }
}

