import { consultar, consultarUna } from "@/lib/db";
import type { TurnoIA } from "@/lib/ia";
import { NOTA_APROBADA, promedio } from "@/lib/notas";
import { asignacionesDelEstudiante } from "@/server/estudiantes/aula";
import {
  condicionEnLaFundacion,
  materiasInscritas,
  notas360DelEstudiante,
  notasDelEstudiante,
  type EstudianteDeSesion,
} from "@/server/estudiantes/portal";

/**
 * Chat con el asistente, en el ámbito estudiantil.
 *
 * Dos reglas gobiernan este archivo:
 *
 *   1. El asistente solo ve lo que el estudiante ya ve en su portal. El
 *      contexto se arma llamando a las mismas consultas de
 *      `server/estudiantes/*`, que por diseño no tocan el expediente. Así no hay dos definiciones de "qué puede saber":
 *      si mañana se restringe algo allí, el asistente lo pierde también.
 *
 *   2. El historial se guarda en `conversacion_ia` / `mensaje_ia` con
 *      `ambito = 'estudiantil'`, separado del chat interno del equipo. Una
 *      conversación por estudiante: no hace falta que gestione hilos, y el
 *      contexto se mantiene entre visitas.
 */

export type MensajeChat = {
  id: string;
  rol: string;
  contenido: string;
  created_at: Date;
};

/** Conversación estudiantil del usuario, si ya la abrió alguna vez. */
export async function conversacionDelEstudiante(
  usuarioId: string,
): Promise<string | null> {
  const fila = await consultarUna<{ id: string }>(
    `SELECT id
       FROM conversacion_ia
      WHERE usuario_id = $1
        AND ambito = 'estudiantil'
      ORDER BY created_at
      LIMIT 1`,
    [usuarioId],
  );

  return fila?.id ?? null;
}

/** Igual que la anterior, pero creándola si no existe. */
export async function asegurarConversacion(
  usuarioId: string,
  titulo: string,
): Promise<string | null> {
  const existente = await conversacionDelEstudiante(usuarioId);
  if (existente) return existente;

  const creada = await consultarUna<{ id: string }>(
    `INSERT INTO conversacion_ia (usuario_id, ambito, titulo)
     VALUES ($1, 'estudiantil', $2)
     RETURNING id`,
    [usuarioId, titulo],
  );

  return creada?.id ?? null;
}

/**
 * Mensajes de la conversación, del más antiguo al más nuevo.
 *
 * El SELECT ordena descendente y luego se invierte: así el LIMIT recorta los
 * mensajes viejos y no los recientes, que son los que hacen falta tanto para
 * pintar la pantalla como para darle contexto al modelo.
 */
export async function mensajesDeConversacion(
  conversacionId: string,
  limite = 30,
): Promise<MensajeChat[]> {
  const filas = await consultar<MensajeChat>(
    `SELECT id, rol, contenido, created_at
       FROM mensaje_ia
      WHERE conversacion_id = $1
        AND rol <> 'system'
      ORDER BY created_at DESC
      LIMIT $2`,
    [conversacionId, limite],
  );

  return filas.reverse();
}

/**
 * Preguntas que el estudiante ha hecho en la última hora.
 *
 * Sirve para el límite de uso. No es una medida de abuso sino de presupuesto:
 * cada pregunta cuesta dinero de API, y un bucle accidental en el navegador
 * podría gastarlo entero en una tarde.
 */
export async function preguntasEnLaUltimaHora(
  usuarioId: string,
): Promise<number> {
  const fila = await consultarUna<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM mensaje_ia m
       JOIN conversacion_ia c ON c.id = m.conversacion_id
      WHERE c.usuario_id = $1
        AND c.ambito = 'estudiantil'
        AND m.rol = 'user'
        AND m.created_at >= now() - INTERVAL '1 hour'`,
    [usuarioId],
  );

  return fila?.total ?? 0;
}

export async function guardarMensaje(
  conversacionId: string,
  rol: "user" | "assistant",
  contenido: string,
  tokens: number | null = null,
): Promise<void> {
  await consultarUna<{ id: string }>(
    `INSERT INTO mensaje_ia (conversacion_id, rol, contenido, tokens)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [conversacionId, rol, contenido, tokens],
  );
}

/**
 * Instrucciones del asistente, con el expediente académico del estudiante ya
 * incrustado.
 *
 * El texto va en código y no en `messages/*.json` a propósito: no es interfaz,
 * es la instrucción que recibe el modelo. Lo que sí depende del idioma es la
 * respuesta, y eso se le pide explícitamente.
 *
 * Se reconstruye en cada pregunta porque las notas cambian; no se declara
 * cacheable por eso mismo.
 */
export async function instruccionesPara(
  estudiante: EstudianteDeSesion,
  idioma: "es" | "en",
): Promise<string> {
  const [materias, notas, notas360, condicion, asignaciones] = await Promise.all([
    materiasInscritas(estudiante.id),
    notasDelEstudiante(estudiante.id),
    notas360DelEstudiante(estudiante.id),
    condicionEnLaFundacion(estudiante.id, 3),
    asignacionesDelEstudiante(estudiante.id),
  ]);

  const valores = notas.map((nota) => nota.nota);
  // El índice sale de los de cada fila, no de convertir el promedio: el
  // historial universitario trae el suyo guardado (ver `notasDelEstudiante`).
  // Solo de la carrera: las notas de 360 se listan aparte y no entran en él.
  const indice = promedio(notas.map((nota) => nota.gpa));
  const media = promedio(valores);

  const pendientes = asignaciones.filter(
    (fila) =>
      (fila.tipo === "tarea" || fila.tipo === "examen") &&
      (fila.estado_entrega ?? "pendiente") === "pendiente",
  );

  const lista = (titulo: string, lineas: readonly string[]) =>
    lineas.length === 0 ? "" : `\n${titulo}\n${lineas.map((l) => `- ${l}`).join("\n")}`;

  return [
    "Eres el asistente académico de la Fundación Global Effect.",
    "Acompañas a un becado universitario con sus estudios y con Global Effect 360: le explicas su situación académica, le ayudas a organizarse y le aclaras dudas de las materias en las que está inscrito.",
    "",
    "Reglas que no puedes romper:",
    "- Solo sabes lo que aparece abajo. Si te preguntan algo que no está ahí, dilo y remite a coordinación en vez de suponer.",
    "- Nunca inventes una nota, una fecha ni un requisito. Si un dato no aparece, es que no lo tienes.",
    "- No hablas de otros estudiantes ni de personal de la Fundación.",
    "- No das diagnósticos ni consejo psicológico o médico. Si detectas malestar o un problema que no es académico, sugiere con calma pedir una cita con administración (menú «Mis solicitudes»).",
    "- No opinas sobre el trabajo de sus docentes.",
    `- Respondes en ${idioma === "en" ? "inglés" : "español"}, breve y en tono cercano. Si la respuesta cabe en dos frases, no escribas cinco.`,
    "",
    `Estudiante: ${estudiante.nombre} (becado universitario, estado ${estudiante.estado}).`,
    `Índice académico: ${indice === null ? "sin historial" : indice.toFixed(2)} sobre 4.00. Promedio: ${media === null ? "sin historial" : media.toFixed(1)} sobre 100 (se aprueba con ${NOTA_APROBADA}).`,
    lista(
      "Materias inscritas:",
      materias.map((materia) =>
        [
          materia.nombre,
          materia.codigo,
          materia.horario,
          materia.aula,
          materia.profesor,
          materia.creditos === null ? null : `${materia.creditos} créditos`,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    ),
    lista(
      "Calificaciones registradas:",
      notas.map(
        (nota) =>
          `${nota.materia} (${nota.periodo}, universidad): ${nota.nota.toFixed(1)} — ${nota.letra}`,
      ),
    ),
    lista(
      "Calificaciones de Global Effect 360 (no cuentan para el índice académico):",
      notas360.map(
        (nota) =>
          `${nota.materia} (${nota.periodo}): ${nota.nota.toFixed(1)} — ${nota.letra}`,
      ),
    ),
    lista(
      "Pendientes del aula virtual:",
      pendientes.map((fila) =>
        [
          fila.titulo,
          fila.materia,
          fila.fecha_vencimiento
            ? `vence ${fila.fecha_vencimiento.toISOString().slice(0, 10)}`
            : "sin fecha de entrega",
          fila.vencida ? "YA VENCIDA" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    ),
    lista(
      "Servicio mensual y reuniones (últimos meses):",
      condicion.map(
        (mes) =>
          `${mes.mes}: servicio ${mes.hizo_servicio ? "cumplido" : "sin cumplir"}, reunión ${mes.asistio_reunion ? "asistida" : "sin asistir"}`,
      ),
    ),
  ].join("\n");
}

/** Historial en el formato que espera el cliente de IA. */
export function turnosDe(mensajes: readonly MensajeChat[]): TurnoIA[] {
  return mensajes
    .filter((mensaje) => mensaje.rol === "user" || mensaje.rol === "assistant")
    .map((mensaje) => ({
      rol: mensaje.rol === "assistant" ? "assistant" : "user",
      contenido: mensaje.contenido,
    }));
}
