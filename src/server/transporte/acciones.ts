"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import {
  fechaHoyRD,
  SQL_HOY_RD,
  type PasajeroViaje,
  type TipoIncidenciaTransporte,
  type ViaInscripcion,
} from "@/lib/transporte";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { obtenerPasajerosHorario } from "./consultas";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_INCIDENCIA: readonly TipoIncidenciaTransporte[] = [
  "averia_mecanica",
  "transito_pesado",
  "desvio_ruta",
  "accidente",
  "otro",
];

/** Refresca todas las pantallas que muestran el estado del transporte. */
function refrescarTransporte() {
  revalidatePath("/portal/chofer");
  revalidatePath("/portal/estudiante/transporte");
  revalidatePath("/transporte");
}

/**
 * Guarda la configuración semanal recurrente del estudiante. Se hace una sola
 * vez para que no tenga que anotarse todos los días.
 */
export async function guardarInscripcionRecurrente(
  inscripciones: {
    horarioId: string;
    diaSemana: number;
    paradaAbordajeId: string;
    paradaDestinoId: string;
  }[],
): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirUsuario();
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante.id) {
    return { ok: false, mensaje: "estudiante_no_enlazado" };
  }

  // Un día con la misma parada de subida y bajada se rechaza entero en vez de
  // descartarse en silencio: antes el estudiante veía "guardado" y ese día
  // desaparecía de su horario y de la lista del chofer.
  if (inscripciones.some((i) => i.paradaAbordajeId === i.paradaDestinoId)) {
    return { ok: false, mensaje: "paradas_iguales" };
  }

  const validas = inscripciones.filter(
    (i) =>
      UUID.test(i.horarioId) &&
      UUID.test(i.paradaAbordajeId) &&
      UUID.test(i.paradaDestinoId) &&
      Number.isInteger(i.diaSemana) &&
      i.diaSemana >= 1 &&
      i.diaSemana <= 6,
  );
  if (validas.length !== inscripciones.length) {
    return { ok: false, mensaje: "datos_invalidos" };
  }

  try {
    await enTransaccion(async (cliente) => {
      // Reemplazo completo: lo que el estudiante ve en pantalla es lo que queda.
      await cliente.query(
        `DELETE FROM transporte_inscripcion_recurrente WHERE estudiante_id = $1`,
        [estudiante.id],
      );

      for (const item of validas) {
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
      datos: { cantidad: validas.length },
    });

    refrescarTransporte();
    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al guardar horario recurrente:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

type DatosInscripcion = {
  horarioId: string;
  nombre: string;
  matriculaOTelefono?: string;
  paradaAbordajeId: string;
  paradaDestinoId: string;
  fecha?: string;
};

/** Máximo de personas que un estudiante puede inscribir por día. */
const TOPE_INVITADOS_POR_DIA = 8;

/**
 * Valida y guarda una inscripción de un día. Las tres vías (puerta pública,
 * estudiante e inscripción asistida) pasan por aquí, así que validan igual:
 * sin sesión no hay a quién pedirle cuentas, y con sesión tampoco se confía
 * en lo que llega del navegador.
 */
async function registrarInscripcionDiaria(
  datos: DatosInscripcion,
  via: ViaInscripcion,
  autorId: string | null,
): Promise<{ ok: boolean; mensaje?: string }> {
  const nombre = datos.nombre.trim();
  const contacto = datos.matriculaOTelefono?.trim() || null;
  const hoy = fechaHoyRD();

  if (
    nombre.length < 2 ||
    nombre.length > 120 ||
    (contacto && contacto.length > 40) ||
    !UUID.test(datos.horarioId) ||
    !UUID.test(datos.paradaAbordajeId) ||
    !UUID.test(datos.paradaDestinoId) ||
    (datos.fecha && !FECHA.test(datos.fecha))
  ) {
    return { ok: false, mensaje: "datos_invalidos" };
  }

  // Subir y bajar en la misma parada no es un viaje.
  if (datos.paradaAbordajeId === datos.paradaDestinoId) {
    return { ok: false, mensaje: "paradas_iguales" };
  }

  // Solo hoy o futuro: una fecha pasada no sirve y ensucia la lista.
  const fecha = datos.fecha && datos.fecha >= hoy ? datos.fecha : hoy;

  try {
    const resultado = await enTransaccion(async (cliente) => {
      if (via === "estudiante" && autorId) {
        const { rows } = await cliente.query<{ n: number }>(
          `SELECT count(*)::int AS n
             FROM transporte_inscripcion_diaria
            WHERE inscrito_por = $1 AND via = 'estudiante' AND fecha = $2::date`,
          [autorId, fecha],
        );
        if ((rows[0]?.n ?? 0) >= TOPE_INVITADOS_POR_DIA) return "tope" as const;
      }

      // Si el contacto coincide con un estudiante, el registro queda enlazado a él.
      let estudianteId: string | null = null;
      if (contacto) {
        const est = await cliente.query<{ id: string }>(
          `SELECT id FROM estudiante WHERE cedula = $1 OR telefono = $1 LIMIT 1`,
          [contacto],
        );
        estudianteId = est.rows[0]?.id ?? null;
      }

      await cliente.query(
        `INSERT INTO transporte_inscripcion_diaria
           (fecha, horario_id, estudiante_id, nombre_beneficiario, matricula_o_telefono,
            parada_abordaje_id, parada_destino_id, inscrito_por, via)
         VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          fecha,
          datos.horarioId,
          estudianteId,
          nombre,
          contacto,
          datos.paradaAbordajeId,
          datos.paradaDestinoId,
          autorId,
          via,
        ],
      );
      return "ok" as const;
    });

    if (resultado === "tope") return { ok: false, mensaje: "tope_invitados" };

    revalidatePath("/transporte");
    revalidatePath("/portal/chofer");
    revalidatePath("/portal/estudiante/transporte");
    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al registrar inscripción:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/** Puerta pública `/transporte`: la única acción sin sesión. */
export async function inscribirPuntualDiaria(
  datos: DatosInscripcion,
): Promise<{ ok: boolean; mensaje?: string }> {
  return registrarInscripcionDiaria(datos, "publica", null);
}

/**
 * El estudiante inscribe a otra persona (un familiar, un compañero). Queda
 * anotado a su nombre para que pueda verla y quitarla.
 */
export async function inscribirInvitado(
  datos: DatosInscripcion,
): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirUsuario();
  const res = await registrarInscripcionDiaria(datos, "estudiante", usuario.id);

  if (res.ok) {
    await registrar({
      usuarioId: usuario.id,
      accion: "transporte.invitado_inscrito",
      entidad: "transporte_inscripcion_diaria",
      datos: { horarioId: datos.horarioId, fecha: datos.fecha ?? null },
    });
  }
  return res;
}

/**
 * El chofer o administración anota a quien no tiene internet y lo pidió por
 * teléfono o en persona. Solo quien opera o gestiona el transporte.
 */
export async function inscribirPasajeroAsistido(
  datos: DatosInscripcion,
): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");
  const res = await registrarInscripcionDiaria(datos, "asistida", usuario.id);

  if (res.ok) {
    await registrar({
      usuarioId: usuario.id,
      accion: "transporte.pasajero_asistido",
      entidad: "transporte_inscripcion_diaria",
      datos: { horarioId: datos.horarioId, fecha: datos.fecha ?? null },
    });
  }
  return res;
}

/** El estudiante quita a un invitado suyo; no puede tocar los de otros. */
export async function quitarInvitado(
  inscripcionId: string,
): Promise<{ ok: boolean }> {
  const usuario = await requerirUsuario();
  if (!UUID.test(inscripcionId)) return { ok: false };

  const fila = await consultarUna<{ id: string }>(
    `DELETE FROM transporte_inscripcion_diaria
      WHERE id = $1 AND inscrito_por = $2 AND via = 'estudiante'
    RETURNING id`,
    [inscripcionId, usuario.id],
  );
  if (!fila) return { ok: false };

  refrescarTransporte();
  return { ok: true };
}

/**
 * El chofer inicia el viaje de su turno. Si ya tiene uno en curso hoy lo
 * retoma en lugar de abrir otro, para que recargar la página no duplique viajes.
 */
export async function iniciarViaje(datos: {
  horarioId: string;
  lat?: number;
  lng?: number;
}): Promise<{ ok: boolean; viajeId?: string; horarioId?: string; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");

  if (!UUID.test(datos.horarioId)) {
    return { ok: false, mensaje: "datos_invalidos" };
  }

  try {
    const viaje = await enTransaccion(async (cliente) => {
      const existente = await cliente.query<{ id: string; horario_id: string }>(
        `SELECT id, horario_id FROM transporte_viaje
          WHERE chofer_id = $1 AND fecha = ${SQL_HOY_RD} AND estado = 'en_curso'
          LIMIT 1`,
        [usuario.id],
      );

      if (existente.rows[0]?.id) return existente.rows[0];

      const res = await cliente.query<{ id: string; horario_id: string }>(
        `INSERT INTO transporte_viaje
           (horario_id, chofer_id, fecha, estado, lat_actual, lng_actual, iniciado_en)
         VALUES ($1, $2, ${SQL_HOY_RD}, 'en_curso', $3, $4, now())
         RETURNING id, horario_id`,
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

    refrescarTransporte();
    // El horario real del viaje: si ya había uno abierto se retoma ese, que
    // puede no ser el turno elegido en pantalla.
    return { ok: true, viajeId: viaje.id, horarioId: viaje.horario_id };
  } catch (error) {
    console.error("[transporte] Error al iniciar viaje:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Posición GPS que transmite el dispositivo del chofer. Solo actualiza viajes
 * propios: el `chofer_id` en el WHERE impide mover la guagua de otro.
 */
export async function actualizarPosicionViaje(datos: {
  viajeId: string;
  lat: number;
  lng: number;
  rumbo?: number;
  velocidadKmh?: number;
  paradaActualId?: string | null;
}): Promise<{ ok: boolean }> {
  const usuario = await requerirPermiso("transporte.operar");

  if (
    !UUID.test(datos.viajeId) ||
    !Number.isFinite(datos.lat) ||
    !Number.isFinite(datos.lng) ||
    Math.abs(datos.lat) > 90 ||
    Math.abs(datos.lng) > 180
  ) {
    return { ok: false };
  }

  try {
    const fila = await consultarUna<{ id: string }>(
      `UPDATE transporte_viaje
          SET lat_actual = $2,
              lng_actual = $3,
              rumbo = COALESCE($4, rumbo),
              velocidad_kmh = COALESCE($5, velocidad_kmh),
              parada_actual_id = COALESCE($6, parada_actual_id),
              actualizado_en = now()
        WHERE id = $1 AND chofer_id = $7
        RETURNING id`,
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

    return { ok: Boolean(fila) };
  } catch (error) {
    console.error("[transporte] Error al actualizar posición GPS:", error);
    return { ok: false };
  }
}

/**
 * El chofer termina su viaje. Solo se audita si el viaje era suyo y seguía
 * abierto; antes quedaba registro aunque el UPDATE no tocara ninguna fila.
 */
export async function finalizarViaje(datos: {
  viajeId: string;
}): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");

  if (!UUID.test(datos.viajeId)) {
    return { ok: false, mensaje: "datos_invalidos" };
  }

  try {
    const fila = await consultarUna<{ id: string }>(
      `UPDATE transporte_viaje
          SET estado = 'completado',
              finalizado_en = now(),
              actualizado_en = now()
        WHERE id = $1 AND chofer_id = $2
          AND estado IN ('en_curso', 'averiado')
        RETURNING id`,
      [datos.viajeId, usuario.id],
    );

    if (!fila) return { ok: false, mensaje: "viaje_no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "transporte.viaje_finalizado",
      entidad: "transporte_viaje",
      entidadId: datos.viajeId,
    });

    refrescarTransporte();
    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al finalizar viaje:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Avería o problema en ruta. Avisa de inmediato a los estudiantes convocados
 * hoy a ese turno. El viaje tiene que ser del chofer que reporta.
 */
export async function reportarIncidencia(datos: {
  viajeId: string;
  tipo: TipoIncidenciaTransporte;
  descripcion: string;
  lat?: number;
  lng?: number;
}): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");
  const descripcion = datos.descripcion.trim();

  if (
    !UUID.test(datos.viajeId) ||
    !TIPOS_INCIDENCIA.includes(datos.tipo) ||
    descripcion.length === 0 ||
    descripcion.length > 500
  ) {
    return { ok: false, mensaje: "datos_invalidos" };
  }

  try {
    const registrada = await enTransaccion(async (cliente) => {
      const viaje = await cliente.query<{ horario_id: string }>(
        `SELECT horario_id FROM transporte_viaje WHERE id = $1 AND chofer_id = $2`,
        [datos.viajeId, usuario.id],
      );
      const horarioId = viaje.rows[0]?.horario_id;
      if (!horarioId) return false;

      await cliente.query(
        `INSERT INTO transporte_incidencia
           (viaje_id, chofer_id, tipo, descripcion, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          datos.viajeId,
          usuario.id,
          datos.tipo,
          descripcion,
          datos.lat ?? null,
          datos.lng ?? null,
        ],
      );

      if (datos.tipo === "averia_mecanica") {
        await cliente.query(
          `UPDATE transporte_viaje
              SET estado = 'averiado', actualizado_en = now()
            WHERE id = $1`,
          [datos.viajeId],
        );
      }

      const titulo =
        datos.tipo === "averia_mecanica"
          ? "Aviso de transporte: avería técnica"
          : "Aviso de transporte: incidencia en ruta";

      await cliente.query(
        `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
         SELECT DISTINCT convocados.usuario_id, $1, $2, 'alerta', '/portal/estudiante/transporte'
           FROM (
             SELECT e.usuario_id
               FROM transporte_inscripcion_recurrente r
               JOIN estudiante e ON e.id = r.estudiante_id
              WHERE r.horario_id = $3
                AND r.activo = true
                AND r.dia_semana = EXTRACT(ISODOW FROM ${SQL_HOY_RD})::smallint
             -- Los anotados solo para hoy también van en la guagua: antes la
             -- alerta llegaba únicamente a los de horario semanal.
             UNION
             SELECT e.usuario_id
               FROM transporte_inscripcion_diaria d
               JOIN estudiante e ON e.id = d.estudiante_id
              WHERE d.horario_id = $3
                AND d.fecha = ${SQL_HOY_RD}
             UNION
             SELECT d.inscrito_por
               FROM transporte_inscripcion_diaria d
              WHERE d.horario_id = $3
                AND d.fecha = ${SQL_HOY_RD}
                AND d.via = 'estudiante'
           ) convocados
          WHERE convocados.usuario_id IS NOT NULL`,
        [titulo, descripcion, horarioId],
      );

      return true;
    });

    if (!registrada) return { ok: false, mensaje: "viaje_no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "transporte.incidencia_reportada",
      entidad: "transporte_incidencia",
      datos: { viajeId: datos.viajeId, tipo: datos.tipo },
    });

    refrescarTransporte();
    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al reportar incidencia:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Marca a mano la parada actual. Respaldo para zonas rurales donde el GPS o
 * la cobertura se cortan.
 */
export async function actualizarParadaViaje(datos: {
  viajeId: string;
  paradaId: string;
}): Promise<{ ok: boolean; mensaje?: string }> {
  const usuario = await requerirPermiso("transporte.operar");

  if (!UUID.test(datos.viajeId) || !UUID.test(datos.paradaId)) {
    return { ok: false, mensaje: "datos_invalidos" };
  }

  try {
    const fila = await consultarUna<{ id: string }>(
      `UPDATE transporte_viaje v
          SET parada_actual_id = p.id,
              lat_actual = COALESCE(v.lat_actual, p.lat),
              lng_actual = COALESCE(v.lng_actual, p.lng),
              actualizado_en = now()
         FROM transporte_parada p
        WHERE v.id = $1
          AND v.chofer_id = $2
          AND p.id = $3
        RETURNING v.id`,
      [datos.viajeId, usuario.id, datos.paradaId],
    );

    if (!fila) return { ok: false, mensaje: "viaje_no_encontrado" };

    refrescarTransporte();
    return { ok: true };
  } catch (error) {
    console.error("[transporte] Error al actualizar parada actual:", error);
    return { ok: false, mensaje: "error_servidor" };
  }
}

/**
 * Pasajeros de un turno para el chofer cuando cambia de horario en pantalla.
 */
export async function cargarPasajerosHorario(
  horarioId: string,
): Promise<{ ok: boolean; pasajeros: PasajeroViaje[] }> {
  await requerirPermiso("transporte.operar");

  if (!UUID.test(horarioId)) return { ok: false, pasajeros: [] };

  try {
    const pasajeros = await obtenerPasajerosHorario(horarioId);
    return { ok: true, pasajeros };
  } catch (error) {
    console.error("[transporte] Error al obtener pasajeros:", error);
    return { ok: false, pasajeros: [] };
  }
}
