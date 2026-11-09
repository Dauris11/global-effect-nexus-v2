import { consultar, consultarUna } from "@/lib/db";
import {
  minutosActualesRD,
  SQL_HOY_RD,
  type InvitadoInscrito,
  type PasajeroViaje,
  type TransporteHorario,
  type TransporteIncidencia,
  type TransporteInscripcionRecurrente,
  type TransporteParada,
  type TransporteRuta,
  type TransporteViaje,
} from "@/lib/transporte";

/**
 * Columnas del viaje con su horario, chofer y parada actual. Una sola fuente:
 * antes el mismo SELECT estaba copiado cinco veces y se desalineaba.
 */
const SELECT_VIAJE = `
  SELECT v.id,
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
         to_char(v.iniciado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS iniciado_en,
         to_char(v.finalizado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS finalizado_en
    FROM transporte_viaje v
    JOIN transporte_horario h ON h.id = v.horario_id
    JOIN usuario u ON u.id = v.chofer_id
    LEFT JOIN transporte_parada p ON p.id = v.parada_actual_id`;

const SELECT_PARADA = `
  SELECT p.id, p.ruta_id, p.orden, p.nombre, p.referencia,
         p.lat::float AS lat, p.lng::float AS lng, p.minutos_estimados
    FROM transporte_parada p`;

/** Incidencias de un viaje, la más reciente primero. */
async function incidenciasDelViaje(
  viajeId: string,
): Promise<TransporteIncidencia[]> {
  return consultar<TransporteIncidencia>(
    `SELECT i.id, i.viaje_id, i.chofer_id, u.nombre AS chofer_nombre,
            i.tipo, i.descripcion, i.lat::float AS lat, i.lng::float AS lng,
            to_char(i.creado_en AT TIME ZONE 'America/Santo_Domingo', 'HH24:MI') AS creado_en
       FROM transporte_incidencia i
       JOIN usuario u ON u.id = i.chofer_id
      WHERE i.viaje_id = $1
      ORDER BY i.creado_en DESC`,
    [viajeId],
  );
}

/** Paradas de la ruta que recorre un horario, en orden de paso. */
async function paradasDelHorario(
  horarioId: string,
): Promise<TransporteParada[]> {
  return consultar<TransporteParada>(
    `${SELECT_PARADA}
       JOIN transporte_horario h ON h.ruta_id = p.ruta_id
      WHERE h.id = $1
      ORDER BY p.orden ASC`,
    [horarioId],
  );
}

/**
 * Todas las rutas activas con sus paradas ordenadas. Primero las que tienen
 * turnos: las páginas toman `rutas[0]` para el mapa y los formularios, y por
 * orden alfabético salía la ruta inversa, que no tiene horarios; el estudiante
 * se inscribía con paradas de una ruta que la guagua no recorre.
 */
export async function listarRutasConParadas(): Promise<
  (TransporteRuta & { paradas: TransporteParada[] })[]
> {
  const rutas = await consultar<TransporteRuta>(
    `SELECT r.id, r.codigo, r.nombre, r.descripcion, r.sentido, r.activo
       FROM transporte_ruta r
      WHERE r.activo = true
      ORDER BY EXISTS (
                 SELECT 1 FROM transporte_horario h
                  WHERE h.ruta_id = r.id AND h.activo = true
               ) DESC,
               r.nombre`,
  );

  if (rutas.length === 0) return [];

  const paradas = await consultar<TransporteParada>(
    `${SELECT_PARADA}
      ORDER BY p.ruta_id, p.orden ASC`,
  );

  return rutas.map((ruta) => ({
    ...ruta,
    paradas: paradas.filter((p) => p.ruta_id === ruta.id),
  }));
}

/**
 * Los horarios oficiales fijos de transporte con su ruta.
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
 * Un viaje por id, con incidencias y paradas. La API de rastreo y la vista en
 * vivo comparten esta consulta para que el mapa lea siempre lo mismo.
 */
export async function obtenerViajePorId(
  viajeId: string,
): Promise<(TransporteViaje & { paradas: TransporteParada[] }) | null> {
  const viaje = await consultarUna<TransporteViaje>(
    `${SELECT_VIAJE} WHERE v.id = $1`,
    [viajeId],
  );
  if (!viaje) return null;

  const [incidencias, paradas] = await Promise.all([
    incidenciasDelViaje(viaje.id),
    paradasDelHorario(viaje.horario_id),
  ]);

  return { ...viaje, incidencias, paradas };
}

/**
 * El viaje que se está haciendo hoy (en curso o averiado) o, si no hay,
 * el último movimiento del día. Alimenta la vista en vivo y la puerta pública.
 */
export async function obtenerViajeEnVivo(): Promise<
  (TransporteViaje & { paradas: TransporteParada[] }) | null
> {
  const activo = await consultarUna<{ id: string }>(
    `SELECT v.id
       FROM transporte_viaje v
      WHERE v.fecha = ${SQL_HOY_RD}
        AND v.estado IN ('en_curso', 'averiado')
      ORDER BY v.iniciado_en DESC NULLS LAST
      LIMIT 1`,
  );

  const id =
    activo?.id ??
    (
      await consultarUna<{ id: string }>(
        `SELECT v.id
           FROM transporte_viaje v
          WHERE v.fecha = ${SQL_HOY_RD}
          ORDER BY v.actualizado_en DESC
          LIMIT 1`,
      )
    )?.id;

  return id ? obtenerViajePorId(id) : null;
}

/**
 * La inscripción semanal recurrente de un estudiante.
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
 * Turno que toca según la hora de La Vega: los cortes quedan entre salidas
 * (antes de las 10:00 → 06:00; hasta las 15:00 → 12:00; hasta las 19:15 → 18:00;
 * después → 20:00) para que el chofer vea sugerido el turno que va a salir.
 */
function horarioSegunHora(
  horarios: TransporteHorario[],
  minutos: number,
): TransporteHorario | null {
  const turnos = [
    { hasta: 10 * 60, codigo: "VIAJE_06AM" },
    { hasta: 15 * 60, codigo: "VIAJE_12M" },
    { hasta: 19 * 60 + 15, codigo: "VIAJE_06PM" },
    { hasta: Infinity, codigo: "VIAJE_08PM" },
  ];
  const indice = turnos.findIndex((t) => minutos < t.hasta);

  return (
    horarios.find((h) => h.codigo === turnos[indice].codigo) ??
    horarios[indice] ??
    null
  );
}

/**
 * Estado del chofer para su portal: viaje en curso, turno sugerido,
 * pasajeros y paradas del turno.
 */
export async function obtenerEstadoChofer(choferId: string): Promise<{
  viajeActivo: TransporteViaje | null;
  horarioSugerido: TransporteHorario | null;
  horariosDisponibles: TransporteHorario[];
  pasajerosHoy: PasajeroViaje[];
  paradasDisponibles: TransporteParada[];
}> {
  const [viajeActivo, horariosDisponibles] = await Promise.all([
    consultarUna<TransporteViaje>(
      `${SELECT_VIAJE}
        WHERE v.chofer_id = $1
          AND v.fecha = ${SQL_HOY_RD}
          AND v.estado IN ('en_curso', 'averiado')
        ORDER BY v.iniciado_en DESC
        LIMIT 1`,
      [choferId],
    ),
    listarHorariosTransporte(),
  ]);

  if (viajeActivo) {
    viajeActivo.incidencias = await incidenciasDelViaje(viajeActivo.id);
  }

  const horarioSugerido = viajeActivo
    ? (horariosDisponibles.find((h) => h.id === viajeActivo.horario_id) ?? null)
    : horarioSegunHora(horariosDisponibles, minutosActualesRD());

  const horarioId = viajeActivo?.horario_id ?? horarioSugerido?.id ?? null;

  const [pasajerosHoy, paradasDisponibles] = horarioId
    ? await Promise.all([
        obtenerPasajerosHorario(horarioId),
        paradasDelHorario(horarioId),
      ])
    : [[], []];

  return {
    viajeActivo,
    horarioSugerido,
    horariosDisponibles,
    pasajerosHoy,
    paradasDisponibles,
  };
}

/**
 * Pasajeros convocados a un horario en una fecha (hoy por defecto): los
 * recurrentes del día de la semana más los puntuales de ese día, sin repetir
 * a quien está en ambas listas.
 */
export async function obtenerPasajerosHorario(
  horarioId: string,
  fecha?: string,
): Promise<PasajeroViaje[]> {
  // $2 nulo = hoy en La Vega; así la fecha viaja siempre como parámetro.
  return consultar<PasajeroViaje>(
    `WITH dia AS (
       SELECT COALESCE($2::date, ${SQL_HOY_RD}) AS fecha
     ),
     combinados AS (
       SELECT r.id::text AS id,
              COALESCE(r.estudiante_id::text, r.id::text) AS clave_dedup,
              e.nombre,
              COALESCE(e.cedula, e.telefono) AS matricula_o_telefono,
              'recurrente' AS tipo,
              pa.nombre AS parada_abordaje_nombre,
              pd.nombre AS parada_destino_nombre,
              false AS presente
         FROM transporte_inscripcion_recurrente r
         JOIN estudiante e ON e.id = r.estudiante_id
         JOIN transporte_parada pa ON pa.id = r.parada_abordaje_id
         JOIN transporte_parada pd ON pd.id = r.parada_destino_id
         CROSS JOIN dia
        WHERE r.horario_id = $1
          AND r.activo = true
          AND r.dia_semana = EXTRACT(ISODOW FROM dia.fecha)::smallint

       UNION ALL

       SELECT d.id::text,
              COALESCE(d.estudiante_id::text, d.id::text),
              d.nombre_beneficiario,
              d.matricula_o_telefono,
              'diaria',
              pa.nombre,
              pd.nombre,
              d.presente
         FROM transporte_inscripcion_diaria d
         JOIN transporte_parada pa ON pa.id = d.parada_abordaje_id
         JOIN transporte_parada pd ON pd.id = d.parada_destino_id
         CROSS JOIN dia
        WHERE d.horario_id = $1
          AND d.fecha = dia.fecha
     )
     SELECT id, nombre, matricula_o_telefono, tipo,
            parada_abordaje_nombre, parada_destino_nombre, presente
       FROM (
         SELECT DISTINCT ON (clave_dedup) *
           FROM combinados
          ORDER BY clave_dedup, tipo ASC
       ) sin_repetidos
      ORDER BY nombre ASC`,
    [horarioId, fecha ?? null],
  );
}

/**
 * Las personas que este usuario inscribió, de hoy en adelante. Sirve para que
 * el estudiante vea a quién anotó y pueda quitarlo si cambia el plan.
 */
export async function invitadosDeUsuario(
  usuarioId: string,
): Promise<InvitadoInscrito[]> {
  return consultar<InvitadoInscrito>(
    `SELECT d.id::text AS id,
            to_char(d.fecha, 'YYYY-MM-DD') AS fecha,
            d.nombre_beneficiario AS nombre,
            h.nombre AS horario_nombre,
            to_char(h.hora_salida, 'HH24:MI') AS hora_salida,
            pa.nombre AS parada_abordaje_nombre,
            pd.nombre AS parada_destino_nombre
       FROM transporte_inscripcion_diaria d
       JOIN transporte_horario h ON h.id = d.horario_id
       JOIN transporte_parada pa ON pa.id = d.parada_abordaje_id
       JOIN transporte_parada pd ON pd.id = d.parada_destino_id
      WHERE d.inscrito_por = $1
        AND d.via = 'estudiante'
        AND d.fecha >= ${SQL_HOY_RD}
      ORDER BY d.fecha, h.hora_salida, d.nombre_beneficiario`,
    [usuarioId],
  );
}
