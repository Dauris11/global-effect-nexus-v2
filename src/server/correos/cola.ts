import { consultar, consultarUna } from "@/lib/db";
import { parametros } from "@/server/parametros/consultas";

/**
 * Envío de lo que hay en `correo_cola`.
 *
 * Hasta ahora la cola solo se llenaba y nada la vaciaba. Esto la vacía con la
 * API de Resend por `fetch` (sin paquete nuevo). Sin `RESEND_API_KEY` no hace
 * nada y deja los correos pendientes: encolar nunca falla por falta de clave.
 *
 * Cada fila se reclama con `FOR UPDATE SKIP LOCKED` y se envía con
 * `Idempotency-Key = id`: si dos procesos coinciden, o uno muere a mitad, Resend
 * no entrega dos veces el mismo correo.
 */

const MAXIMO_INTENTOS = 5;

export type ResultadoCola = { enviados: number; fallidos: number; sinClave: boolean };

export async function vaciarColaCorreo(limite = 20): Promise<ResultadoCola> {
  const clave = process.env.RESEND_API_KEY;
  const desde = process.env.RESEND_FROM;

  if (!clave || clave.includes("[") || !desde) {
    return { enviados: 0, fallidos: 0, sinClave: true };
  }

  const responder = (await parametros())["contacto.correo"];

  const filas = await consultar<{
    id: string;
    destinatario: string;
    asunto: string;
    cuerpo_html: string;
    cuerpo_texto: string | null;
    intentos: number;
  }>(
    `UPDATE correo_cola
        SET intentos = intentos + 1
      WHERE id IN (SELECT id FROM correo_cola
                    WHERE estado = 'pendiente' AND intentos < $1
                    ORDER BY created_at
                    LIMIT $2
                      FOR UPDATE SKIP LOCKED)
      RETURNING id, destinatario, asunto, cuerpo_html, cuerpo_texto, intentos`,
    [MAXIMO_INTENTOS, limite],
  );

  let enviados = 0;
  let fallidos = 0;

  for (const fila of filas) {
    try {
      const respuesta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clave}`,
          "Content-Type": "application/json",
          "Idempotency-Key": fila.id,
        },
        body: JSON.stringify({
          from: desde,
          to: [fila.destinatario],
          reply_to: responder,
          subject: fila.asunto,
          html: fila.cuerpo_html,
          ...(fila.cuerpo_texto ? { text: fila.cuerpo_texto } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (respuesta.ok) {
        await consultarUna(
          `UPDATE correo_cola SET estado = 'enviado', enviado_en = now(), ultimo_error = NULL
            WHERE id = $1 RETURNING id`,
          [fila.id],
        );
        enviados++;
        continue;
      }

      throw new Error(`Resend ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`);
    } catch (error) {
      fallidos++;
      await consultarUna(
        `UPDATE correo_cola
            SET ultimo_error = $2,
                estado = CASE WHEN intentos >= $3 THEN 'fallido' ELSE estado END
          WHERE id = $1 RETURNING id`,
        [fila.id, String(error instanceof Error ? error.message : error).slice(0, 500), MAXIMO_INTENTOS],
      ).catch(() => {});
    }
  }

  return { enviados, fallidos, sinClave: false };
}
