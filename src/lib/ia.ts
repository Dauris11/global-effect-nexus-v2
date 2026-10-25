import Anthropic from "@anthropic-ai/sdk";

/**
 * Cliente de Anthropic para los asistentes del sistema.
 *
 * Se usa el SDK oficial (`@anthropic-ai/sdk`) y no `fetch` a mano: el SDK ya
 * trae reintentos, tiempos de espera y los tipos de la respuesta, que aquí hay
 * que leer con cuidado —`content` es una unión de bloques, no un texto—.
 *
 * El modelo sale de `ANTHROPIC_MODEL`, y por defecto es el que ya eligió
 * `.env.example`: `claude-sonnet-5`. Para lo que hace este asistente —responder
 * sobre unas materias y unas notas que le llegan ya resueltas en el contexto—
 * rinde igual que un Opus y cuesta bastante menos, que en una fundación importa.
 *
 * Ojo con cambiar esa variable: la petición usa `output_config.effort`, que los
 * modelos anteriores a la generación 5 no aceptan y devuelven 400. Si se apunta
 * a uno viejo, el chat responde "no se pudo responder" en cada pregunta.
 *
 * Lo que este archivo NO hace: buscar en `fragmento_conocimiento` con
 * embeddings. Ese RAG es del sprint S11 y necesita un modelo de embeddings que
 * todavía no está elegido. Mientras tanto el contexto se arma con los datos que
 * el propio estudiante ya puede consultar en su portal, que es lo que hace
 * falta para responder sobre sus materias y sus notas.
 */

const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

/**
 * Techo de salida. Ojo: en `claude-opus-5` el razonamiento y el texto de la
 * respuesta comparten este presupuesto, así que quedarse corto no recorta la
 * respuesta: la trunca a media frase. 4096 da aire de sobra para el largo que
 * pide `docs/09-sistema-visual.md` en una respuesta de chat.
 */
const MAXIMO_TOKENS = 4096;

/**
 * Caracteres máximos de una pregunta.
 *
 * Vive aquí y no en el archivo de acciones porque un módulo `"use server"` solo
 * puede exportar funciones asíncronas: una constante ahí rompe el build. La
 * pantalla la recibe por props desde el servidor, así el SDK de Anthropic no
 * entra en el paquete del navegador.
 */
export const MAXIMO_CARACTERES_PREGUNTA = 1000;

/**
 * Lo que puede responder una pregunta al asistente, en los dos chats.
 *
 * Vive aquí y no en cada archivo de acciones porque los DOS chats —el del
 * estudiante y el interno del equipo— comparten pantalla: un solo componente
 * cliente los dibuja, y para eso su `useActionState` necesita un solo tipo.
 * Con un estado por chat, el componente tendría que aceptar una unión de dos
 * uniones y traducir cada caso dos veces.
 *
 * Cada acción usa el subconjunto que le toca —`sin_expediente` solo le puede
 * pasar al estudiante— y la pantalla tiene un texto para cada uno: un estado
 * sin mensaje sale como un error genérico, que es justo lo que estos nombres
 * existen para evitar.
 */
export type EstadoChat = {
  estado:
    | "inicial"
    | "ok"
    | "vacia"
    | "larga"
    | "limite"
    | "sin_expediente"
    | "sin_permiso"
    | "sin_clave"
    | "rechazada"
    | "error";
};

/** Tokens de una llamada. `cache` son los leídos de la caché de prompt. */
export type UsoIA = {
  modelo: string;
  entrada: number;
  salida: number;
  cache: number;
  latenciaMs: number;
};

/** Ajustes por llamada; lo que no se da, sale de las constantes de arriba. */
export type OpcionesIA = { modelo?: string; maximoTokens?: number };

/** Mensajes que se le pasan al modelo, ya en su formato. */
export type TurnoIA = { rol: "user" | "assistant"; contenido: string };

export type RespuestaIA =
  | {
      estado: "ok";
      texto: string;
      tokens: number;
      /** Lo que cuenta el medidor: la API lo devuelve en cada respuesta. */
      uso: UsoIA;
    }
  | { estado: "sin_clave" }
  | { estado: "rechazada" }
  | { estado: "fallo" };

let cliente: Anthropic | null = null;

function obtenerCliente(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cliente) cliente = new Anthropic();

  return cliente;
}

/**
 * Una vuelta de conversación con el asistente.
 *
 * `sistema` describe quién es el asistente y qué sabe del estudiante; `turnos`
 * es el historial, con la pregunta nueva al final.
 *
 * Devuelve estados en vez de lanzar excepciones, igual que las Server Actions
 * del proyecto: "no hay clave configurada" y "el modelo declinó responder" son
 * respuestas normales que la interfaz tiene que saber explicar, no fallos que
 * deban romper la página.
 */
export async function conversar(
  sistema: string,
  turnos: readonly TurnoIA[],
  opciones: OpcionesIA = {},
): Promise<RespuestaIA> {
  const anthropic = obtenerCliente();

  // Sin clave el chat se apaga solo y lo dice. Es el caso de un despliegue de
  // desarrollo con `.env.local` a medio llenar.
  if (!anthropic) return { estado: "sin_clave" };

  const modelo = opciones.modelo ?? MODELO;
  const inicio = Date.now();

  try {
    const respuesta = await anthropic.messages.create({
      model: modelo,
      max_tokens: opciones.maximoTokens ?? MAXIMO_TOKENS,
      system: sistema,
      messages: turnos.map((turno) => ({
        role: turno.rol,
        content: turno.contenido,
      })),
      /*
       * `effort: "low"` con el razonamiento en automático. Es el ajuste barato
       * recomendado para este modelo: responde igual de bien en preguntas de
       * este tipo y gasta bastante menos. Apagar el razonamiento del todo
       * saldría más caro en errores —a veces se le escapan etiquetas internas
       * en el texto— que lo que ahorra.
       */
      output_config: { effort: "low" },
    });

    /*
     * `stop_reason` se mira ANTES del contenido: en un rechazo `content` puede
     * venir vacío, y leer `content[0]` a ciegas rompería la acción.
     *
     * Un rechazo se le explica al estudiante y ahí acaba; no se reintenta en
     * otro modelo. El reintento automático de la API es una función del nivel
     * Opus y ataría este archivo a ese modelo, cuando con preguntas académicas
     * un rechazo es raro y "pregúntalo de otra forma o escribe a coordinación"
     * es una salida razonable.
     */
    if (respuesta.stop_reason === "refusal") return { estado: "rechazada" };

    const texto = respuesta.content
      .filter((bloque) => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("\n")
      .trim();

    if (!texto) return { estado: "fallo" };

    return {
      estado: "ok",
      texto,
      tokens: respuesta.usage.output_tokens,
      uso: {
        modelo,
        entrada: respuesta.usage.input_tokens,
        salida: respuesta.usage.output_tokens,
        cache: respuesta.usage.cache_read_input_tokens ?? 0,
        latenciaMs: Date.now() - inicio,
      },
    };
  } catch (error) {
    // Se registra en el servidor y al estudiante se le da un mensaje corto: el
    // detalle del error de la API no le sirve de nada y puede filtrar datos de
    // la petición.
    console.error("[ia] fallo al conversar", error);

    /*
     * Una clave inválida o caducada se trata como "no configurado" y no como
     * fallo pasajero: decirle al estudiante "inténtalo de nuevo" cuando ningún
     * reintento va a funcionar lo deja probando en bucle. `sin_clave` le dice
     * que avise al equipo, que es lo único que resuelve esto.
     */
    if (error instanceof Anthropic.AuthenticationError) {
      return { estado: "sin_clave" };
    }

    return { estado: "fallo" };
  }
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * LECTURA DE DOCUMENTOS (OCR)
 *
 * Segundo uso del cliente de Anthropic: sacar campos de una cédula o de una
 * ficha escaneada para PRECARGAR un formulario. Precargar, no rellenar: lo que
 * devuelve el modelo se enseña para que una persona lo confirme, y por eso
 * viaja con su nivel de confianza.
 *
 * Tres decisiones que valen para las dos pantallas que lo usan:
 *
 *   1. **El archivo NO se guarda.** Va al modelo y se descarta. Guardar
 *      escaneos de documentos de identidad de menores es una decisión de
 *      política de datos, no un detalle técnico, y no se toma de paso mientras
 *      se construye un OCR. El bucket privado existe si algún día se decide
 *      que sí; lo que sí queda es el rastro en `extraccion_ocr`.
 *   2. **La respuesta se valida como si viniera de un desconocido.** Un modelo
 *      devuelve el JSON que le pides casi siempre, y "casi" no es una garantía:
 *      cada campo se comprueba por separado y lo que no encaje se descarta en
 *      vez de llegar al formulario.
 *   3. **`effort: "low"` y pocos tokens.** Es transcribir lo que se ve, no
 *      razonar; el presupuesto largo solo daría ocasión de inventar.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Tipos de archivo que se aceptan para leer. Se comprueba en el servidor. */
export const TIPOS_DOCUMENTO_OCR = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** Tope de tamaño. Por encima, la API rechaza la petición. */
export const MAXIMO_DOCUMENTO_OCR = 5 * 1024 * 1024;

export type LecturaDocumento =
  | { estado: "ok"; datos: Record<string, unknown>; modelo: string }
  | { estado: "sin_clave" }
  | { estado: "rechazada" }
  | { estado: "ilegible" }
  | { estado: "fallo" };

/**
 * Manda un documento al modelo y devuelve el JSON que responda.
 *
 * `instrucciones` describe qué se busca y `peticion` es el turno del usuario.
 * El objeto se devuelve SIN interpretar: quién llama sabe qué campos espera y
 * los valida. Aquí solo se garantiza que hay un objeto.
 */
export async function leerDocumento(
  archivo: { mime: string; base64: string },
  instrucciones: string,
  peticion: string,
): Promise<LecturaDocumento> {
  const anthropic = obtenerCliente();

  if (!anthropic) return { estado: "sin_clave" };

  try {
    const respuesta = await anthropic.messages.create({
      model: MODELO,
      // Corto a propósito: la respuesta es un JSON de cuatro campos. Un techo
      // amplio no mejora una transcripción, solo da sitio a la invención.
      max_tokens: 600,
      system: instrucciones,
      messages: [
        {
          role: "user",
          content: [
            archivo.mime === "application/pdf"
              ? {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: archivo.base64,
                  },
                }
              : {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: archivo.mime as
                      | "image/jpeg"
                      | "image/png"
                      | "image/webp",
                    data: archivo.base64,
                  },
                },
            { type: "text", text: peticion },
          ],
        },
      ],
      output_config: { effort: "low" },
    });

    if (respuesta.stop_reason === "refusal") return { estado: "rechazada" };

    const texto = respuesta.content
      .filter((bloque) => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("\n")
      .trim();

    const datos = objetoDeJson(texto);

    // El modelo contestó algo que no es un objeto JSON. No es un fallo de red
    // ni de clave: es que del documento no salió nada aprovechable, y la
    // pantalla lo dice de otra manera («búscalo a mano»).
    if (!datos) return { estado: "ilegible" };

    return { estado: "ok", datos, modelo: MODELO };
  } catch (error) {
    console.error("[ia] fallo al leer el documento", error);

    if (error instanceof Anthropic.AuthenticationError) {
      return { estado: "sin_clave" };
    }

    return { estado: "fallo" };
  }
}

/**
 * El primer objeto JSON que haya en el texto.
 *
 * Se pide "solo JSON" en las instrucciones y aun así a veces llega envuelto en
 * un bloque de código o con una frase delante. Se recorta entre la primera
 * llave y la última en vez de dar la respuesta por perdida, y si eso no parsea,
 * se devuelve `null`: nunca se lanza desde aquí, porque un JSON torcido es una
 * lectura fallida y no un error del sistema.
 */
function objetoDeJson(texto: string): Record<string, unknown> | null {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");

  if (inicio === -1 || fin <= inicio) return null;

  try {
    const valor: unknown = JSON.parse(texto.slice(inicio, fin + 1));

    return typeof valor === "object" && valor !== null
      ? (valor as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
