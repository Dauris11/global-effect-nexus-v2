"use server";

import { revalidatePath } from "next/cache";

import { consultarUna } from "@/lib/db";

/**
 * Inscripción al almuerzo del día.
 *
 * Es la única escritura del sistema que NO exige sesión: el comedor está
 * abierto y así lo anuncia la propia página ("sin trámite, sin cuenta y sin
 * preguntas"). Por eso las tres reglas del módulo 25 se aplican aquí sin
 * excepción, y en el servidor: validarlas solo en el navegador no serviría de
 * nada cuando la acción se puede invocar directamente.
 */

export type EstadoComida = {
  estado: "inicial" | "ok" | "duplicado" | "fuera_de_hora" | "invalido";
};

const CIERRE_MINUTOS = 8 * 60 + 30; // 08:30
const APERTURA_MINUTOS = 6 * 60; // 06:00

export async function inscribirseAComida(
  _previo: EstadoComida,
  datos: FormData,
): Promise<EstadoComida> {
  const nombre = String(datos.get("nombre") ?? "")
    .trim()
    .replace(/\s+/g, " ");

  // Un nombre de una letra no identifica a nadie a la hora de servir.
  if (nombre.length < 3) return { estado: "invalido" };

  /*
   * La hora se mira en el servidor, no en el navegador: la del cliente la
   * cambia cualquiera, y el cierre a las 8:30 es el que decide cuánta comida se
   * cocina. Se usa la hora de la base para que no dependa de la zona en la que
   * corra el proceso.
   */
  const ahora = await consultarUna<{ minutos: number }>(
    `SELECT (EXTRACT(HOUR FROM CURRENT_TIME) * 60
             + EXTRACT(MINUTE FROM CURRENT_TIME))::int AS minutos`,
  );

  const minutos = ahora?.minutos ?? 0;

  if (minutos < APERTURA_MINUTOS || minutos >= CIERRE_MINUTOS) {
    return { estado: "fuera_de_hora" };
  }

  /*
   * El duplicado lo decide la restricción UNIQUE (nombre, fecha), no un SELECT
   * previo: entre comprobar y escribir cabe otra petición con el mismo nombre.
   * `ON CONFLICT DO NOTHING` deja que la base resuelva la carrera, y no
   * devolver fila es exactamente la señal de que ya estaba inscrito.
   */
  const fila = await consultarUna<{ id: string }>(
    `INSERT INTO inscripcion_comida (nombre)
     VALUES ($1)
     ON CONFLICT (nombre, fecha) DO NOTHING
     RETURNING id`,
    [nombre],
  );

  if (!fila) return { estado: "duplicado" };

  // Refresca el contador de la landing y de esta página.
  revalidatePath("/", "layout");

  return { estado: "ok" };
}
