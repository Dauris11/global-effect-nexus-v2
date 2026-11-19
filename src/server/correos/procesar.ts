import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import {
  armarCartaParaPatrocinador,
  cuerpoDeCarta,
  direccionDe,
  mesYATiempo,
  revisarTraduccion,
  type MotivoCorreo,
} from "@/lib/correos-patrocinador";
import { parametros } from "@/server/parametros/consultas";

import { clasificarCarta } from "./clasificador";
import { vaciarColaCorreo } from "./cola";

/**
 * Recorrido de una carta, de que llega al buzón a que se entrega.
 *
 * El código decide; el modelo solo clasifica y traduce. Reglas que no cambian:
 *   · La carta se GUARDA antes de procesarla (los proveedores reintentan y un
 *     fallo a medias no debe perderla).
 *   · El estudiante se identifica por la dirección del remitente, que se puede
 *     falsificar: sin SPF/DKIM/DMARC en `pass`, la carta se retiene.
 *   · El destinatario sale SIEMPRE de la base (asignación activa → correo del
 *     patrocinador), nunca de la carta.
 *   · Cualquier duda —sin clave, sin respuesta válida, texto saliente con
 *     enlaces o cifras— termina en `retenido`. Nunca se envía por defecto.
 */

export type MensajeEntrante = {
  messageId: string;
  remitente: string;
  asunto: string | null;
  texto: string | null;
  html: string | null;
  recibidoEn: Date;
  autenticacion: "pass" | "fail" | "desconocida";
  adjuntos: number;
};

export type EstadoRecepcion =
  | "sin_identificar"
  | "sin_patrocinador"
  | "retenido"
  | "reenviado"
  | "duplicado"
  | "repetido";

type FilaCarta = {
  id: string;
  estudiante_id: string;
  mes: string;
  texto_original: string;
  autenticacion: "pass" | "fail" | "desconocida";
  estudiante: string;
  adjuntos: number;
};

export async function recibirCorreo(mensaje: MensajeEntrante): Promise<EstadoRecepcion> {
  const diaLimite = Number((await parametros())["correos.dia_limite"]);
  const { mes, aTiempo } = mesYATiempo(mensaje.recibidoEn, diaLimite);
  const cuerpo = cuerpoDeCarta(mensaje.texto, mensaje.html) || "(sin texto)";

  const nueva = await consultarUna<{ id: string }>(
    `INSERT INTO correo_patrocinador
       (message_id, remitente, asunto, mes, a_tiempo, recibido_en, texto_original,
        autenticacion, estado, motivos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sin_identificar',
             CASE WHEN $9::int > 0 THEN ARRAY['adjuntos'] ELSE '{}' END)
     ON CONFLICT (message_id) DO NOTHING
     RETURNING id`,
    [
      mensaje.messageId,
      mensaje.remitente,
      mensaje.asunto?.slice(0, 300) ?? null,
      mes,
      aTiempo,
      mensaje.recibidoEn,
      cuerpo,
      mensaje.autenticacion,
      mensaje.adjuntos,
    ],
  );

  if (!nueva) return "repetido";

  const direccion = direccionDe(mensaje.remitente);

  if (!direccion) return "sin_identificar";

  const estudiantes = await consultar<{ id: string }>(
    `SELECT id FROM estudiante WHERE email = $1::citext AND estado = 'activo'`,
    [direccion],
  );

  // Ninguno o varios: lo resuelve una persona, no se adivina.
  if (estudiantes.length !== 1) return "sin_identificar";

  await consultar(`UPDATE correo_patrocinador SET estudiante_id = $2 WHERE id = $1`, [
    nueva.id,
    estudiantes[0].id,
  ]);

  return continuarCarta(nueva.id);
}

/**
 * Del estudiante ya conocido a la decisión: patrocinador, duplicado, revisión
 * del modelo, comprobaciones propias y, si procede, reenvío. También sirve para
 * reprocesar una carta que quedó retenida por falta de clave.
 */
export async function continuarCarta(id: string): Promise<EstadoRecepcion> {
  const fila = await consultarUna<FilaCarta>(
    `SELECT c.id, c.estudiante_id, c.mes, c.texto_original, c.autenticacion,
            e.nombre AS estudiante,
            ('adjuntos' = ANY (c.motivos))::int AS adjuntos
       FROM correo_patrocinador c
       JOIN estudiante e ON e.id = c.estudiante_id
      WHERE c.id = $1 AND c.estado IN ('sin_identificar', 'sin_patrocinador', 'retenido')`,
    [id],
  );

  if (!fila) return "sin_identificar";

  const asignacion = await consultarUna<{
    asignacion_id: string;
    patrocinador_id: string;
    idioma: "es" | "en";
  }>(
    `SELECT a.id AS asignacion_id, p.id AS patrocinador_id, p.idioma
       FROM asignacion_beca a
       JOIN patrocinador p ON p.id = a.patrocinador_id
      WHERE a.estudiante_id = $1 AND a.estado = 'activo'
        AND p.estado = 'activo' AND p.email IS NOT NULL
      ORDER BY a.fecha_inicio DESC
      LIMIT 1`,
    [fila.estudiante_id],
  );

  if (!asignacion) {
    await consultar(`UPDATE correo_patrocinador SET estado = 'sin_patrocinador' WHERE id = $1`, [id]);

    return "sin_patrocinador";
  }

  const previa = await consultarUna<{ id: string }>(
    `SELECT id FROM correo_patrocinador
      WHERE estudiante_id = $1 AND mes = $2 AND id <> $3
        AND estado IN ('retenido', 'reenviado')`,
    [fila.estudiante_id, fila.mes, id],
  );

  if (previa) {
    await consultar(`UPDATE correo_patrocinador SET estado = 'duplicado' WHERE id = $1`, [id]);

    return "duplicado";
  }

  const veredicto = await clasificarCarta(fila.texto_original, asignacion.idioma);

  const motivos = new Set<MotivoCorreo>(veredicto?.motivos ?? []);

  if (!veredicto) motivos.add("clasificador_no_disponible");
  if (fila.autenticacion !== "pass") motivos.add("remitente_no_verificado");
  if (fila.adjuntos > 0) motivos.add("adjuntos");
  if (veredicto) revisarTraduccion(veredicto.traduccion).forEach((m) => motivos.add(m));

  const limpia = veredicto?.veredicto === "limpio" && motivos.size === 0;

  try {
    await consultar(
      `UPDATE correo_patrocinador
          SET asignacion_id = $2, patrocinador_id = $3, traduccion = $4,
              veredicto = $5, motivos = $6, estado = 'retenido'
        WHERE id = $1`,
      [
        id,
        asignacion.asignacion_id,
        asignacion.patrocinador_id,
        veredicto?.traduccion ?? null,
        veredicto?.veredicto ?? null,
        [...motivos],
      ],
    );
  } catch (error) {
    // La base garantiza una sola carta válida por estudiante y mes.
    if ((error as { code?: string }).code === "23505") {
      await consultar(`UPDATE correo_patrocinador SET estado = 'duplicado' WHERE id = $1`, [id]);

      return "duplicado";
    }

    throw error;
  }

  if (limpia && (await parametros())["correos.reenvio_automatico"] === "1") {
    return (await reenviarCarta(id, null)) ? "reenviado" : "retenido";
  }

  return "retenido";
}

/**
 * Entrega la carta retenida a su patrocinador. `revisorId` es la persona que la
 * aprueba; `null` es el reenvío automático, que además exige que la traducción
 * pase otra vez las comprobaciones propias.
 */
export async function reenviarCarta(id: string, revisorId: string | null): Promise<boolean> {
  const hecho = await enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<{
      traduccion: string | null;
      estudiante: string;
      correo: string | null;
      idioma: "es" | "en";
    }>(
      `SELECT c.traduccion, e.nombre AS estudiante, p.email::text AS correo, p.idioma
         FROM correo_patrocinador c
         JOIN estudiante e ON e.id = c.estudiante_id
         JOIN patrocinador p ON p.id = c.patrocinador_id
        WHERE c.id = $1 AND c.estado = 'retenido'
          FOR UPDATE OF c`,
      [id],
    );

    const carta = rows[0];

    if (!carta?.traduccion || !carta.correo) return false;
    if (revisorId === null && revisarTraduccion(carta.traduccion).length > 0) return false;

    const correo = armarCartaParaPatrocinador({
      idioma: carta.idioma,
      estudiante: carta.estudiante,
      traduccion: carta.traduccion,
    });

    // El correo se encola EN LA MISMA transacción que marca la carta como
    // reenviada: si algo falla a medias no queda un correo en cola de una carta
    // que sigue retenida (y que saldría dos veces).
    const cola = await cliente.query<{ id: string }>(
      `INSERT INTO correo_cola (destinatario, asunto, cuerpo_html, cuerpo_texto)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [carta.correo, correo.asunto, correo.html, correo.texto],
    );
    const colaId = cola.rows[0]?.id;

    await cliente.query(
      `UPDATE correo_patrocinador
          SET estado = 'reenviado', correo_cola_id = $2, revisado_por = $3,
              revisado_en = CASE WHEN $3::uuid IS NULL THEN NULL ELSE now() END
        WHERE id = $1`,
      [id, colaId || null, revisorId],
    );

    return true;
  });

  if (hecho) await vaciarColaCorreo().catch((e) => console.error("[correos] cola", e));

  return hecho;
}
