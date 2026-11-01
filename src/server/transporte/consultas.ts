import { consultar, consultarUna } from "@/lib/db";
import type {
  PasajeroViaje,
  TransporteHorario,
  TransporteIncidencia,
  TransporteInscripcionRecurrente,
  TransporteParada,
  TransporteRuta,
  TransporteViaje,
} from "@/lib/transporte";

/**
 * Consulta todas las rutas de transporte activas con sus paradas geográficas ordenadas.
 */
export async function listarRutasConParadas(): Promise<
  (TransporteRuta & { paradas: TransporteParada[] })[]
> {
  const rutas = await consultar<TransporteRuta>(
    `SELECT id, codigo, nombre, descripcion, sentido, activo
       FROM transporte_ruta
      WHERE activo = true
      ORDER BY nombre`,
  );

  if (rutas.length === 0) return [];

  const paradas = await consultar<TransporteParada>(
    `SELECT id, ruta_id, orden, nombre, referencia,
            lat::float AS lat, lng::float AS lng, minutos_estimados
       FROM transporte_parada
      ORDER BY ruta_id, orden ASC`,
  );

  return rutas.map((ruta) => ({
    ...ruta,
    paradas: paradas.filter((p) => p.ruta_id === ruta.id),
  }));
}

/**
 * Obtiene los 4 horarios oficiales fijos de transporte con su ruta asociada.
 */
export async function listarHorariosTransporte(): Promise<TransporteHorario[]> {
  return consultar<TransporteHorario>(
    `SELECT h.id,
            h.codigo,
            h.nombre,
            to_char(h.hora_salida, 'HH24:MI') AS hora_salida,
            to_char(h.hora_llegada_estimada, 'HH24:MI') AS hora_llegada_estimada,
            h.ruta_id,
            r.nombre AS ruta_nombre,
            h.orden,
            h.activo
       FROM transporte_horario h
       JOIN transporte_ruta r ON r.id = h.ruta_id
      WHERE h.activo = true
      ORDER BY h.orden ASC, h.hora_salida ASC`,
  );
}

/**
 * Obtiene el viaje actualmente en curso o el más reciente del día de hoy.
 * Útil para la vista en vivo de los estudiantes y la puerta pública.
 */
export async function obtenerViajeEnVivo(
  viajeId?: string,
): Promise<(TransporteViaje & { paradas: TransporteParada[] }) | null> {
  let viaje: TransporteViaje | null = null;

  if (viajeId) {
    viaje = await consultarUna<TransporteViaje>(
      `SELECT v.id,
              v.horario_id,
              h.nombre AS horario_nombre,
              to_char(h.hora_salida, 'HH24:MI') AS hora_salida,
              v.chofer_id,
              u.nombre AS chofer_nombre,
              to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
              v.estado,
              v.lat_actual::float AS lat_actual,
              v.lng_actual::float AS lng_actual,
              v.rumbo::float AS rumbo,
              v.velocidad_kmh::float AS velocidad_kmh,
              v.parada_actual_id,
              p.nombre AS parada_actual_nombre,
              to_char(v.iniciado_en, 'YYYY-MM-DD HH24:MI') AS iniciado_en,
              to_char(v.finalizado_en, 'YYYY-MM-DD HH24:MI') AS finalizado_en
         FROM transporte_viaje v
         JOIN transporte_horario h ON h.id = v.horario_id
         JOIN usuario u ON u.id = v.chofer_id
         LEFT JOIN transporte_parada p ON p.id = v.parada_actual_id
        WHERE v.id = $1`,
      [viajeId],
    );
  } else {
    // Buscar primero si hay un viaje 'en_curso' o 'averiado' hoy
    viaje = await consultarUna<TransporteViaje>(
      `SELECT v.id,
              v.horario_id,
              h.nombre AS horario_nombre,
              to_char(h.hora_salida, 'HH24:MI') AS hora_salida,
              v.chofer_id,
              u.nombre AS chofer_nombre,
              to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
              v.estado,
              v.lat_actual::float AS lat_actual,
              v.lng_actual::float AS lng_actual,
              v.rumbo::float AS rumbo,
              v.velocidad_kmh::float AS velocidad_kmh,
              v.parada_actual_id,
              p.nombre AS parada_actual_nombre,
              to_char(v.iniciado_en, 'YYYY-MM-DD HH24:MI') AS iniciado_en,
              to_char(v.finalizado_en, 'YYYY-MM-DD HH24:MI') AS finalizado_en
         FROM transporte_viaje v
         JOIN transporte_horario h ON h.id = v.horario_id
         JOIN usuario u ON u.id = v.chofer_id
         LEFT JOIN transporte_parada p ON p.id = v.parada_actual_id
        WHERE v.fecha = CURRENT_DATE
          AND v.estado IN ('en_curso', 'averiado')
        ORDER BY v.iniciado_en DESC NULLS LAST
        LIMIT 1`,
    );

    // Si no hay viaje en curso, buscar el último de hoy o el programado más próximo
    if (!viaje) {
      viaje = await consultarUna<TransporteViaje>(
        `SELECT v.id,
                v.horario_id,
                h.nombre AS horario_nombre,
                to_char(h.hora_salida, 'HH24:MI') AS hora_salida,
                v.chofer_id,
                u.nombre AS chofer_nombre,
                to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
                v.estado,
                v.lat_actual::float AS lat_actual,
                v.lng_actual::float AS lng_actual,
                v.rumbo::float AS rumbo,
                v.velocidad_kmh::float AS velocidad_kmh,
                v.parada_actual_id,
                p.nombre AS parada_actual_nombre,
                to_char(v.iniciado_en, 'YYYY-MM-DD HH24:MI') AS iniciado_en,
                to_char(v.finalizado_en, 'YYYY-MM-DD HH24:MI') AS finalizado_en
           FROM transporte_viaje v
           JOIN transporte_horario h ON h.id = v.horario_id
           JOIN usuario u ON u.id = v.chofer_id
           LEFT JOIN transporte_parada p ON p.id = v.parada_actual_id
          WHERE v.fecha = CURRENT_DATE
          ORDER BY v.actualizado_en DESC
          LIMIT 1`,
      );
    }
  }

  if (!viaje) return null;

  // Cargar incidencias registradas en este viaje
  const incidencias = await consultar<TransporteIncidencia>(
    `SELECT i.id, i.viaje_id, i.chofer_id, u.nombre AS chofer_nombre,
            i.tipo, i.descripcion, i.lat::float AS lat, i.lng::float AS lng,
            to_char(i.creado_en, 'HH24:MI') AS creado_en
       FROM transporte_incidencia i
       JOIN usuario u ON u.id = i.chofer_id
      WHERE i.viaje_id = $1
      ORDER BY i.creado_en DESC`,
    [viaje.id],
  );
  viaje.incidencias = incidencias;

  // Cargar paradas de la ruta del horario
  const paradas = await consultar<TransporteParada>(
    `SELECT p.id, p.ruta_id, p.orden, p.nombre, p.referencia,
            p.lat::float AS lat, p.lng::float AS lng, p.minutos_estimados
       FROM transporte_parada p
       JOIN transporte_horario h ON h.ruta_id = p.ruta_id
      WHERE h.id = $1
      ORDER BY p.orden ASC`,
    [viaje.horario_id],
  );

  return {
    ...viaje,
    paradas,
  };
}

/**
 * Consulta la inscripción recurrente semanal de un estudiante.
 */
export async function obtenerInscripcionesRecurrentesEstudiante(
  estudianteId: string | null,
): Promise<TransporteInscripcionRecurrente[]> {
  if (!estudianteId) return [];

  return consultar<TransporteInscripcionRecurrente>(
    `SELECT r.id,
            r.estudiante_id,
            r.horario_id,
            h.codigo AS horario_codigo,
            h.nombre AS horario_nombre,
            to_char(h.hora_salida, 'HH24:MI') AS hora_salida,
            r.dia_semana,
            r.parada_abordaje_id,
            pa.nombre AS parada_abordaje_nombre,
            r.parada_destino_id,
            pd.nombre AS parada_destino_nombre,
            r.activo
       FROM transporte_inscripcion_recurrente r
       JOIN transporte_horario h ON h.id = r.horario_id
       JOIN transporte_parada pa ON pa.id = r.parada_abordaje_id
       JOIN transporte_parada pd ON pd.id = r.parada_destino_id
      WHERE r.estudiante_id = $1
        AND r.activo = true
      ORDER BY r.dia_semana ASC, h.hora_salida ASC`,
    [estudianteId],
  );
}

/**
 * Resumen del estado actual para el portal del chofer.
 * Detecta el viaje en curso o sugiere el próximo viaje según la hora del día.
 */
export async function obtenerEstadoChofer(choferId: string): Promise<{
  viajeActivo: TransporteViaje | null;
  horarioSugerido: TransporteHorario | null;
  horariosDisponibles: TransporteHorario[];
  pasajerosHoy: PasajeroViaje[];
  paradasDisponibles: TransporteParada[];
}> {
  // 1. Viaje activo en curso del chofer
  const viajeActivo = await consultarUna<TransporteViaje>(
    `SELECT v.id,
            v.horario_id,
            h.nombre AS horario_nombre,
            to_char(h.hora_salida, 'HH24:MI') AS hora_salida,
            v.chofer_id,
            u.nombre AS chofer_nombre,
            to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
            v.estado,
            v.lat_actual::float AS lat_actual,
            v.lng_actual::float AS lng_actual,
            v.rumbo::float AS rumbo,
            v.velocidad_kmh::float AS velocidad_kmh,
            v.parada_actual_id,
            p.nombre AS parada_actual_nombre,
            to_char(v.iniciado_en, 'YYYY-MM-DD HH24:MI') AS iniciado_en,
            to_char(v.finalizado_en, 'YYYY-MM-DD HH24:MI') AS finalizado_en
       FROM transporte_viaje v
       JOIN transporte_horario h ON h.id = v.horario_id
       JOIN usuario u ON u.id = v.chofer_id
       LEFT JOIN transporte_parada p ON p.id = v.parada_actual_id
      WHERE v.chofer_id = $1
        AND v.fecha = CURRENT_DATE
        AND v.estado IN ('en_curso', 'averiado')
      ORDER BY v.iniciado_en DESC
      LIMIT 1`,
    [choferId],
  );

  if (viajeActivo) {
    const incidencias = await consultar<TransporteIncidencia>(
      `SELECT i.id, i.viaje_id, i.chofer_id, u.nombre AS chofer_nombre,
              i.tipo, i.descripcion, i.lat::float AS lat, i.lng::float AS lng,
              to_char(i.creado_en, 'HH24:MI') AS creado_en
         FROM transporte_incidencia i
         JOIN usuario u ON u.id = i.chofer_id
        WHERE i.viaje_id = $1
        ORDER BY i.creado_en DESC`,
      [viajeActivo.id],
    );
    viajeActivo.incidencias = incidencias;
  }

  // 2. Horarios disponibles
  const horariosDisponibles = await listarHorariosTransporte();

  // 3. Determinar horario sugerido basado en la hora actual
  // 06:00, 12:00, 18:00, 20:00
  const ahora = new Date();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();

  let horarioSugerido: TransporteHorario | null = null;
  if (viajeActivo) {
    horarioSugerido =
      horariosDisponibles.find((h) => h.id === viajeActivo.horario_id) ?? null;
  } else {
    // Si es antes de las 10:00 AM -> Viaje 1 (06:00 AM)
    // Entre 10:00 AM y 03:00 PM -> Viaje 2 (12:00 PM)
    // Entre 03:00 PM y 07:15 PM -> Viaje 3 (06:00 PM)
    // Después de 07:15 PM -> Viaje 4 (08:00 PM)
    if (horaActual < 10 * 60) {
      horarioSugerido =
        horariosDisponibles.find((h) => h.codigo === "VIAJE_06AM") ??
        horariosDisponibles[0] ??
        null;
    } else if (horaActual < 15 * 60) {
      horarioSugerido =
        horariosDisponibles.find((h) => h.codigo === "VIAJE_12M") ??
        horariosDisponibles[1] ??
        null;
    } else if (horaActual < 19 * 60 + 15) {
      horarioSugerido =
        horariosDisponibles.find((h) => h.codigo === "VIAJE_06PM") ??
        horariosDisponibles[2] ??
        null;
    } else {
      horarioSugerido =
        horariosDisponibles.find((h) => h.codigo === "VIAJE_08PM") ??
        horariosDisponibles[3] ??
        null;
    }
  }

  // 4. Pasajeros y paradas de hoy para el horario sugerido/activo
  const horarioIdParaPasajeros =
    viajeActivo?.horario_id ?? horarioSugerido?.id ?? null;

  let pasajerosHoy: PasajeroViaje[] = [];
  let paradasDisponibles: TransporteParada[] = [];

  if (horarioIdParaPasajeros) {
    pasajerosHoy = await obtenerPasajerosHorario(horarioIdParaPasajeros);

    paradasDisponibles = await consultar<TransporteParada>(
      `SELECT p.id, p.ruta_id, p.orden, p.nombre, p.referencia,
              p.lat::float AS lat, p.lng::float AS lng, p.minutos_estimados
         FROM transporte_parada p
         JOIN transporte_horario h ON h.ruta_id = p.ruta_id
        WHERE h.id = $1
        ORDER BY p.orden ASC`,
      [horarioIdParaPasajeros],
    );
  }

  return {
    viajeActivo,
    horarioSugerido,
    horariosDisponibles,
    pasajerosHoy,
    paradasDisponibles,
  };
}

/**
 * Retorna la lista de pasajeros convocados para un viaje y horario en una fecha.
 * Cruza los inscritos recurrentes del día de la semana con los inscritos diarios puntuales.
 */
export async function obtenerPasajerosHorario(
  horarioId: string,
  fecha?: string,
): Promise<PasajeroViaje[]> {
  const fechaConsulta = fecha ?? "CURRENT_DATE";

  return consultar<PasajeroViaje>(
    `SELECT id,
            nombre,
            matricula_o_telefono,
            tipo,
            parada_abordaje_nombre,
            parada_destino_nombre,
            presente
       FROM (
         SELECT DISTINCT ON (clave_dedup)
                id,
                nombre,
                matricula_o_telefono,
                tipo,
                parada_abordaje_nombre,
                parada_destino_nombre,
                presente
           FROM (
             -- Pasajeros recurrentes semanales
             SELECT r.id::text AS id,
                    COALESCE(r.estudiante_id::text, r.id::text) AS clave_dedup,
                    e.nombre,
                    e.matricula AS matricula_o_telefono,
                    'recurrente' AS tipo,
                    pa.nombre AS parada_abordaje_nombre,
                    pd.nombre AS parada_destino_nombre,
                    false AS presente
               FROM transporte_inscripcion_recurrente r
               JOIN estudiante e ON e.id = r.estudiante_id
               JOIN transporte_parada pa ON pa.id = r.parada_abordaje_id
               JOIN transporte_parada pd ON pd.id = r.parada_destino_id
              WHERE r.horario_id = $1
                AND r.activo = true
                AND r.dia_semana = EXTRACT(ISODOW FROM ${fechaConsulta === "CURRENT_DATE" ? "CURRENT_DATE" : "$2::date"})::smallint

             UNION ALL

             -- Pasajeros puntuales diarios (con o sin login)
             SELECT d.id::text AS id,
                    COALESCE(d.estudiante_id::text, d.id::text) AS clave_dedup,
                    d.nombre_beneficiario AS nombre,
                    d.matricula_o_telefono,
                    'diaria' AS tipo,
                    pa.nombre AS parada_abordaje_nombre,
                    pd.nombre AS parada_destino_nombre,
                    d.presente
               FROM transporte_inscripcion_diaria d
               JOIN transporte_parada pa ON pa.id = d.parada_abordaje_id
               JOIN transporte_parada pd ON pd.id = d.parada_destino_id
              WHERE d.horario_id = $1
                AND d.fecha = ${fechaConsulta === "CURRENT_DATE" ? "CURRENT_DATE" : "$2::date"}
           ) combinados
          ORDER BY clave_dedup, tipo ASC
       ) deduplicados
      ORDER BY nombre ASC`,
    fechaConsulta === "CURRENT_DATE" ? [horarioId] : [horarioId, fecha],
  );
}

