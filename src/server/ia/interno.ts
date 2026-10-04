import { consultar, consultarUna } from "@/lib/db";
import type { TurnoIA } from "@/lib/ia";
import { UMBRAL_BANDA } from "@/lib/notas";
import { tienePermiso, type Rol } from "@/lib/rbac";
import { resumenDeNotas } from "@/server/academico/consultas";
import { cifrasPanel, eventosProximos } from "@/server/dashboard/consultas";
import { resumenDelMesEnCurso } from "@/server/finanzas/consultas";
import {
  cifrasAcademicas,
  cifrasDeOperaciones,
  proyectosParaReporte,
} from "@/server/reportes/consultas";

/**
 * Asistente interno del equipo: el contexto que recibe y su historial.
 *
 * DOS REGLAS. (Había una tercera, la primera de todas: psicología no entraba
 * aquí nunca. El departamento se cerró en octubre de 2026 y la 0030 borró sus
 * tablas, así que ya no hay nada clínico que dejar fuera.)
 *
 *   1. **El contexto se recorta con los permisos de quien pregunta.** Las
 *      cifras financieras solo si tiene `finanzas.leer`, las académicas si
 *      tiene `academico.leer`, las de operaciones si tiene `operaciones.leer`.
 *      Se llama a las MISMAS consultas que ya alimentan sus pantallas, así que
 *      no hay una segunda definición de "qué puede saber cada rol": si mañana
 *      se restringe algo allí, el asistente lo pierde a la vez.
 *
 *   2. **Todo son agregados.** Ni un nombre de estudiante, ni un expediente,
 *      ni una nota concreta. El asistente responde sobre cómo va la Fundación,
 *      no sobre personas; para una persona están las pantallas, que registran
 *      quién la consultó.
 *
 * El historial vive en `conversacion_ia` / `mensaje_ia` con
 * `ambito = 'interno'`, separado del estudiantil. Una conversación por cuenta.
 */

export type MensajeChat = {
  id: string;
  rol: string;
  contenido: string;
  created_at: Date;
};

/** Conversación interna de la cuenta, si ya la abrió alguna vez. */
export async function conversacionInterna(
  usuarioId: string,
): Promise<string | null> {
  const fila = await consultarUna<{ id: string }>(
    `SELECT id
       FROM conversacion_ia
      WHERE usuario_id = $1
        AND ambito = 'interno'
      ORDER BY created_at
      LIMIT 1`,
    [usuarioId],
  );

  return fila?.id ?? null;
}

/** Igual que la anterior, creándola si no existe. */
export async function asegurarConversacionInterna(
  usuarioId: string,
  titulo: string,
): Promise<string | null> {
  const existente = await conversacionInterna(usuarioId);
  if (existente) return existente;

  const creada = await consultarUna<{ id: string }>(
    `INSERT INTO conversacion_ia (usuario_id, ambito, titulo)
     VALUES ($1, 'interno', $2)
     RETURNING id`,
    [usuarioId, titulo],
  );

  return creada?.id ?? null;
}

/**
 * Mensajes de la conversación, del más antiguo al más nuevo.
 *
 * El SELECT ordena descendente y luego se invierte: así el LIMIT recorta los
 * mensajes VIEJOS y no los recientes, que son los que hacen falta para pintar
 * la pantalla y para darle contexto al modelo.
 */
export async function mensajesInternos(
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
 * Preguntas que esta cuenta ha hecho en la última hora.
 *
 * Es un tope de gasto, no de abuso: cada pregunta cuesta dinero de API y un
 * bucle accidental en el navegador podría gastarlo entero en una tarde.
 */
export async function preguntasInternasEnLaUltimaHora(
  usuarioId: string,
): Promise<number> {
  const fila = await consultarUna<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM mensaje_ia m
       JOIN conversacion_ia c ON c.id = m.conversacion_id
      WHERE c.usuario_id = $1
        AND c.ambito = 'interno'
        AND m.rol = 'user'
        AND m.created_at >= now() - INTERVAL '1 hour'`,
    [usuarioId],
  );

  return fila?.total ?? 0;
}

export async function guardarMensajeInterno(
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
 * Las instrucciones del asistente, con el estado de la Fundación dentro.
 *
 * El texto va en código y no en `messages/*.json` a propósito: no es interfaz,
 * es la instrucción que recibe el modelo. Lo que sí depende del idioma es la
 * respuesta, y eso se le pide explícitamente.
 *
 * Se reconstruye en cada pregunta porque las cifras cambian, y se recorta por
 * permiso: ver la regla 1 de la cabecera.
 */
export async function instruccionesInternas(
  usuario: { nombre: string; rol: Rol },
  idioma: "es" | "en",
): Promise<string> {
  const verFinanzas = tienePermiso(usuario.rol, "finanzas.leer");
  const verAcademico = tienePermiso(usuario.rol, "academico.leer");
  const verOperaciones = tienePermiso(usuario.rol, "operaciones.leer");

  // Lo que no se puede enseñar, NO SE CONSULTA. Es la misma regla del panel
  // general: pedirlo y luego no pintarlo deja el dato en la memoria del
  // servidor y en los registros de la base sin que nadie lo haya pedido.
  const [cifras, eventos, finanzas, academico, notas, operaciones, proyectos] =
    await Promise.all([
      cifrasPanel(),
      eventosProximos(5),
      verFinanzas ? resumenDelMesEnCurso() : null,
      verAcademico ? cifrasAcademicas() : null,
      verAcademico
        ? resumenDeNotas({ periodoId: null, umbrales: UMBRAL_BANDA })
        : null,
      verOperaciones ? cifrasDeOperaciones() : null,
      verOperaciones ? proyectosParaReporte() : null,
    ]);

  const lista = (titulo: string, lineas: readonly string[]) =>
    lineas.length === 0
      ? ""
      : `\n${titulo}\n${lineas.map((linea) => `- ${linea}`).join("\n")}`;

  return [
    "Eres el asistente interno de la Fundación Global Effect, para su equipo de trabajo.",
    "Ayudas a entender cómo va la institución con los datos agregados que te llegan abajo, y a redactar o resumir cuando te lo piden.",
    "",
    "Reglas que no puedes romper:",
    "- Solo sabes lo que aparece abajo. Si te preguntan algo que no está, dilo y di en qué pantalla del sistema se consulta, en vez de suponer.",
    "- Nunca inventes una cifra. Si un número no aparece, es que no lo tienes o que quien pregunta no tiene permiso para verlo.",
    "- No hablas de estudiantes concretos ni de personal concreto: no recibes nombres ni expedientes. Para una persona, remite a su expediente en el sistema.",
    "- No des consejo legal, médico ni psicológico.",
    `- Respondes en ${idioma === "en" ? "inglés" : "español"}, breve y directo. Si la respuesta cabe en dos frases, no escribas cinco.`,
    "",
    `Quien pregunta: ${usuario.nombre}, con el rol ${usuario.rol}.`,
    "",
    "Cifras generales:",
    `- Estudiantes universitarios activos (becados): ${cifras.universitarios}`,
    `- Estudiantes de curso técnico activos: ${cifras.tecnicos}`,
    `- Candidatos en el embudo de reclutamiento: ${cifras.reclutamiento}`,
    `- Cursos técnicos activos: ${cifras.cursos}`,
    `- Proyectos en curso: ${cifras.proyectos}`,
    `- Tareas abiertas: ${cifras.tareas}`,
    `- Patrocinadores activos: ${cifras.patrocinadores}`,
    academico
      ? [
          "",
          "Académico:",
          `- Cursos registrados: ${academico.cursos}, materias: ${academico.materias}`,
          `- Notas registradas: ${notas?.total ?? 0}`,
          `- Promedio general: ${notas?.promedio === null || notas?.promedio === undefined ? "sin notas todavía" : notas.promedio.toFixed(1)} sobre 100`,
          `- Aprobadas: ${notas?.aprobadas ?? 0} de ${notas?.total ?? 0}`,
          `- Distribución: ${notas?.excelente ?? 0} excelentes, ${notas?.buena ?? 0} aprobadas, ${notas?.riesgo ?? 0} en riesgo, ${notas?.critica ?? 0} reprobadas`,
        ].join("\n")
      : "",
    operaciones
      ? [
          "",
          "Operaciones:",
          `- Proyectos: ${operaciones.proyectos} en total, ${operaciones.en_curso} en curso, ${operaciones.completados} completados`,
          `- Tareas abiertas: ${operaciones.tareas_abiertas}`,
        ].join("\n")
      : "",
    operaciones && proyectos
      ? lista(
          "Avance de los proyectos (tareas completadas sobre tareas vivas):",
          proyectos
            .slice(0, 10)
            .map((fila) =>
              fila.tareas === 0
                ? `${fila.nombre} (${fila.estado}): sin tareas todavía`
                : `${fila.nombre} (${fila.estado}): ${Math.round((fila.hechas / fila.tareas) * 100)}% — ${fila.hechas} de ${fila.tareas}`,
            ),
        )
      : "",
    finanzas
      ? [
          "",
          "Finanzas del mes en curso (USD):",
          `- Ingresos: ${finanzas.ingresos.toFixed(2)}`,
          `- Egresos: ${finanzas.egresos.toFixed(2)}`,
          `- Balance: ${finanzas.balance.toFixed(2)} en ${finanzas.movimientos} movimientos`,
        ].join("\n")
      : "",
    lista(
      "Próximos eventos del calendario:",
      eventos.map((evento) =>
        [evento.fecha, evento.titulo, evento.tipo, evento.ubicacion]
          .filter(Boolean)
          .join(" · "),
      ),
    ),
  ]
    .filter((bloque) => bloque !== "")
    .join("\n");
}

/** Historial en el formato que espera el cliente de IA. */
export function turnosInternos(mensajes: readonly MensajeChat[]): TurnoIA[] {
  return mensajes
    .filter((mensaje) => mensaje.rol === "user" || mensaje.rol === "assistant")
    .map((mensaje) => ({
      rol: mensaje.rol === "assistant" ? "assistant" : "user",
      contenido: mensaje.contenido,
    }));
}
