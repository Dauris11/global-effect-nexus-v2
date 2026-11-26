import { consultar, consultarUna } from "@/lib/db";

/**
 * Avisos a los pasajeros según lo que hace la guagua, como el seguimiento de un
 * pedido: «ya arrancó», «viene por Rincón» y «está llegando a tu parada».
 *
 * Quién espera el viaje: los inscritos de ese horario y día (recurrentes) y los
 * de hoy (puntuales). Cada aviso se registra en `transporte_aviso` ANTES de
 * enviarse; si el registro ya existía no se repite, porque la posición llega
 * cada pocos segundos.
 *
 * Es aviso dentro del sistema (campana), no push al teléfono.
 */

/** A esta distancia de una parada se considera que el chofer llegó a ella. */
const RADIO_PARADA_M = 300;

const SQL_DOW_RD = `EXTRACT(ISODOW FROM (now() AT TIME ZONE 'America/Santo_Domingo'))`;
const SQL_HOY_RD = `(now() AT TIME ZONE 'America/Santo_Domingo')::date`;

/** Distancia en metros entre dos puntos (haversine). */
function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;

  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

type Pasajero = { usuario_id: string; abordaje_orden: number };

/** Usuarios que esperan este viaje, con el orden de la parada donde suben. */
async function pasajerosDelViaje(viajeId: string): Promise<Pasajero[]> {
  return consultar<Pasajero>(
    `SELECT e.usuario_id, pa.orden AS abordaje_orden
       FROM transporte_viaje v
       JOIN transporte_inscripcion_recurrente r
         ON r.horario_id = v.horario_id AND r.activo AND r.dia_semana = ${SQL_DOW_RD}
       JOIN estudiante e ON e.id = r.estudiante_id AND e.usuario_id IS NOT NULL
       JOIN transporte_parada pa ON pa.id = r.parada_abordaje_id
      WHERE v.id = $1
     UNION
     SELECT e.usuario_id, pa.orden
       FROM transporte_viaje v
       JOIN transporte_inscripcion_diaria d
         ON d.horario_id = v.horario_id AND d.fecha = ${SQL_HOY_RD}
       JOIN estudiante e ON e.id = d.estudiante_id AND e.usuario_id IS NOT NULL
       JOIN transporte_parada pa ON pa.id = d.parada_abordaje_id
      WHERE v.id = $1`,
    [viajeId],
  );
}

/** Registra el aviso; `true` solo la primera vez. */
async function registrarAviso(
  viajeId: string,
  tipo: "arranco" | "paso" | "llegando",
  paradaId: string | null,
): Promise<boolean> {
  const fila = await consultarUna<{ id: string }>(
    `INSERT INTO transporte_aviso (viaje_id, tipo, parada_id)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [viajeId, tipo, paradaId],
  );

  return Boolean(fila);
}

async function enviar(usuarios: string[], titulo: string, mensaje: string): Promise<void> {
  if (usuarios.length === 0) return;

  await consultar(
    `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
     SELECT u, $2, $3, 'info', '/portal/estudiante/transporte'
       FROM unnest($1::uuid[]) AS u`,
    [[...new Set(usuarios)], titulo, mensaje],
  );
}

/** «Ya arrancó»: a todos los que esperan este viaje. */
export async function avisarArranque(viajeId: string): Promise<void> {
  if (!(await registrarAviso(viajeId, "arranco", null))) return;

  const pasajeros = await pasajerosDelViaje(viajeId);

  await enviar(
    pasajeros.map((p) => p.usuario_id),
    "El transporte ya arrancó",
    "El chofer inició el recorrido. Sigue la guagua en el mapa.",
  );
}

/**
 * Con cada posición: si el chofer está en una parada, avisa a quien sube allí
 * («llegó a tu parada») y a quien sube en la siguiente («viene por X, está
 * llegando a tu parada»). Devuelve la parada alcanzada para que quien llama la
 * marque como actual.
 */
export async function avisarProgreso(
  viajeId: string,
  lat: number,
  lng: number,
): Promise<string | null> {
  const paradas = await consultar<{
    id: string;
    nombre: string;
    orden: number;
    lat: number;
    lng: number;
  }>(
    `SELECT p.id, p.nombre, p.orden, p.lat::float8 AS lat, p.lng::float8 AS lng
       FROM transporte_viaje v
       JOIN transporte_horario h ON h.id = v.horario_id
       JOIN transporte_parada p ON p.ruta_id = h.ruta_id
      WHERE v.id = $1
      ORDER BY p.orden`,
    [viajeId],
  );

  const alcanzada = paradas.find(
    (parada) => distanciaM(lat, lng, parada.lat, parada.lng) <= RADIO_PARADA_M,
  );

  if (!alcanzada) return null;
  if (!(await registrarAviso(viajeId, "paso", alcanzada.id))) return alcanzada.id;

  const pasajeros = await pasajerosDelViaje(viajeId);
  const siguiente = paradas.find((parada) => parada.orden === alcanzada.orden + 1);

  await enviar(
    pasajeros.filter((p) => p.abordaje_orden === alcanzada.orden).map((p) => p.usuario_id),
    "El transporte llegó a tu parada",
    `La guagua está en ${alcanzada.nombre}.`,
  );

  if (siguiente && (await registrarAviso(viajeId, "llegando", siguiente.id))) {
    await enviar(
      pasajeros.filter((p) => p.abordaje_orden === siguiente.orden).map((p) => p.usuario_id),
      "El transporte está llegando",
      `Viene saliendo de ${alcanzada.nombre} hacia ${siguiente.nombre}.`,
    );
  }

  return alcanzada.id;
}
