import { consultar, consultarUna } from "@/lib/db";
import { parametros } from "@/server/parametros/consultas";

/**
 * Estado del comedor para hoy.
 *
 * La hora sale de la base, no del proceso de Node: así el cierre de las 8:30 es
 * el mismo lo despliegue quien lo despliegue y con la zona horaria que tenga
 * configurada el servidor. Es la misma fuente que usa la Server Action al
 * validar, de modo que la página nunca ofrece un formulario abierto que la
 * acción va a rechazar.
 */
export async function estadoComedor(): Promise<{
  abierto: boolean;
  inscritos: number;
}> {
  // El horario sale de los parámetros institucionales (`/configuracion/parametros`).
  const p = await parametros();
  const fila = await consultarUna<{ abierto: boolean; inscritos: number }>(
    `SELECT CURRENT_TIME >= $1::time AND CURRENT_TIME < $2::time AS abierto,
            (SELECT count(*)::int
               FROM inscripcion_comida
              WHERE fecha = CURRENT_DATE) AS inscritos`,
    [p["comedor.apertura"], p["comedor.cierre"]],
  );

  return fila ?? { abierto: false, inscritos: 0 };
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * VISTA INTERNA DEL COMEDOR
 *
 * La otra cara de `/comida`: aquella es la puerta pública donde la gente se
 * apunta; esta es la lista con la que cocina el comedor.
 *
 * La hora de corte NO se repite aquí: sale del parámetro `comedor.cierre`, el
 * mismo que usan `estadoComedor` y la acción de inscripción. Si mañana el comedor
 * cierra a las 9:00, el cambio se hace en `/configuracion/parametros` y vale en
 * los tres sitios a la vez, y desde luego no en un `if` de JavaScript que
 * compare contra la hora del navegador.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type ComensalDelDia = {
  id: string;
  nombre: string;
  hora_inscripcion: string;
  confirmado: boolean;
  /** Si se apuntó dentro del horario de cocina. Lo decide la base. */
  a_tiempo: boolean;
};

/**
 * Los comensales de una fecha, en el orden en que se apuntaron.
 *
 * Por orden de inscripción y no alfabético: la lista se usa para servir, y ese
 * orden es además el que explica quién llegó tarde. Para buscar un nombre está
 * el buscador del navegador.
 */
export async function comensalesDelDia(
  /** `YYYY-MM-DD`, o `null` para hoy SEGÚN LA BASE. */
  fecha: string | null,
): Promise<ComensalDelDia[]> {
  const p = await parametros();

  return consultar<ComensalDelDia>(
    `SELECT id,
            nombre,
            hora_inscripcion,
            confirmado,
            (hora_inscripcion::time < $2::time) AS a_tiempo
       FROM inscripcion_comida
      WHERE fecha = coalesce($1::date, CURRENT_DATE)
      ORDER BY hora_inscripcion, nombre`,
    [fecha, p["comedor.cierre"]],
  );
}

export type ResumenComedor = {
  total: number;
  a_tiempo: number;
  tarde: number;
  /** Si AHORA se puede seguir apuntando para HOY. */
  abierto: boolean;
  /** La fecha de hoy según la base, para el selector y la navegación. */
  hoy: string;
};

/**
 * Las cifras del día y si la recepción sigue abierta.
 *
 * `coalesce($1::date, CURRENT_DATE)` y no un valor por omisión en TypeScript:
 * "hoy" lo decide la base, igual que la hora de corte. Con `new Date()` en el
 * proceso, un servidor en otra zona horaria enseñaría la lista del día
 * equivocado a primera hora de la mañana, que es justo cuando se usa.
 */
export async function resumenDelComedor(
  fecha: string | null,
): Promise<ResumenComedor> {
  const p = await parametros();
  const fila = await consultarUna<ResumenComedor>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE hora_inscripcion::time <  $3::time)::int AS a_tiempo,
            count(*) FILTER (WHERE hora_inscripcion::time >= $3::time)::int AS tarde,
            (SELECT CURRENT_TIME >= $2::time AND CURRENT_TIME < $3::time
                    AND coalesce($1::date, CURRENT_DATE) = CURRENT_DATE) AS abierto,
            (SELECT CURRENT_DATE::text) AS hoy
       FROM inscripcion_comida
      WHERE fecha = coalesce($1::date, CURRENT_DATE)`,
    [fecha, p["comedor.apertura"], p["comedor.cierre"]],
  );

  return fila ?? { total: 0, a_tiempo: 0, tarde: 0, abierto: false, hoy: "" };
}
