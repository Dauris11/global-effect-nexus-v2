import { ErrorModelo } from "@/lib/gemini";
import { capacidadesIA, hayClaveIA, llamarModelo, modeloIA } from "@/lib/modelo-ia";

/**
 * Cliente del modelo para los asistentes del sistema.
 *
 * Habla con OpenAI o con Gemini por REST con `fetch` (ver `modelo-ia.ts`): sin
 * paquete que mantener, y cambiar de proveedor es una variable de entorno
 * (`IA_PROVEEDOR`). Todo lo que pasa por aquí —notas del estudiante, cédulas,
 * cartas— se envía a un tercero; en la capa GRATUITA de Gemini, además, Google
 * puede usarlo para mejorar sus productos.
 *
 * Lo que este archivo NO hace: buscar en `fragmento_conocimiento` con
 * embeddings. Ese RAG es del sprint S11 y necesita un modelo de embeddings que
 * todavía no está elegido. Mientras tanto el contexto se arma con los datos que
 * el propio estudiante ya puede consultar en su portal, que es lo que hace
 * falta para responder sobre sus materias y sus notas.
 */

/** Techo de salida de una respuesta de chat. */
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
    // La pregunta traía código, JSON, etiquetas u órdenes para la IA.
    | "entrada_invalida"
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
  // El proveedor limitó la frecuencia (429): común en la capa gratuita.
  | { estado: "limite" }
  | { estado: "fallo" };

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
  // Sin clave el chat se apaga solo y lo dice. Es el caso de un despliegue de
  // desarrollo con `.env.local` a medio llenar.
  if (!hayClaveIA()) return { estado: "sin_clave" };

  const modelo = modeloIA(opciones.modelo);
  const inicio = Date.now();

  try {
    const respuesta = await llamarModelo({
      model: modelo,
      max_tokens: opciones.maximoTokens ?? MAXIMO_TOKENS,
      system: sistema,
      messages: turnos.map((turno) => ({ role: turno.rol, content: turno.contenido })),
    });

    // `stop_reason` se mira ANTES del contenido: en un bloqueo `content` viene
    // vacío, y leer `content[0]` a ciegas rompería la acción. Un bloqueo se le
    // explica a la persona y ahí acaba; no se reintenta con otro modelo.
    if (respuesta.stop_reason === "refusal") return { estado: "rechazada" };

    const texto = respuesta.content
      .flatMap((bloque) => (bloque.type === "text" ? [bloque.text] : []))
      .join("\n")
      .trim();

    if (!texto) return { estado: "fallo" };

    return {
      estado: "ok",
      texto,
      tokens: respuesta.usage.output_tokens,
      uso: {
        modelo: respuesta.modelo ?? modelo,
        entrada: respuesta.usage.input_tokens,
        salida: respuesta.usage.output_tokens,
        cache: respuesta.usage.cache_read_input_tokens ?? 0,
        latenciaMs: Date.now() - inicio,
      },
    };
  } catch (error) {
    // Se registra en el servidor y a la persona se le da un mensaje corto: el
    // detalle del error de la API no le sirve de nada y puede filtrar datos.
    console.error("[ia] fallo al conversar", error);

    if (error instanceof ErrorModelo && error.tipo === "limite") return { estado: "limite" };

    // Clave inválida = «no configurado», no fallo pasajero: decir «inténtalo de
    // nuevo» cuando ningún reintento va a funcionar deja a la gente en bucle.
    if (error instanceof ErrorModelo && error.tipo === "sin_clave") return { estado: "sin_clave" };

    return { estado: "fallo" };
  }
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * LECTURA DE DOCUMENTOS (OCR)
 *
 * Segundo uso del cliente del modelo: sacar campos de una cédula o de una
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
 *   3. **Pocos tokens.** Es transcribir lo que se ve, no razonar; el
 *      presupuesto largo solo daría ocasión de inventar.
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
  if (!hayClaveIA()) return { estado: "sin_clave" };

  // Algunos proveedores no leen PDF o no tienen modelo de visión (Groq). Se dice
  // «ilegible» y la pantalla manda a capturarlo a mano, que es lo correcto.
  const lee = capacidadesIA();

  if (archivo.mime === "application/pdf" ? !lee.pdf : !lee.imagen) return { estado: "ilegible" };

  const modelo = modeloIA(undefined, { vision: true });

  try {
    const respuesta = await llamarModelo({
      model: modelo,
      // Corto a propósito: la respuesta es un JSON de cuatro campos. Un techo
      // amplio no mejora una transcripción, solo da sitio a la invención.
      max_tokens: 600,
      requiere: archivo.mime === "application/pdf" ? "pdf" : "imagen",
      system: instrucciones,
      messages: [
        {
          role: "user",
          content: [
            { type: "archivo", mime: archivo.mime, base64: archivo.base64 },
            { type: "text", text: peticion },
          ],
        },
      ],
    });

    if (respuesta.stop_reason === "refusal") return { estado: "rechazada" };

    const texto = respuesta.content
      .flatMap((bloque) => (bloque.type === "text" ? [bloque.text] : []))
      .join("\n")
      .trim();

    const datos = objetoDeJson(texto);

    // El modelo contestó algo que no es un objeto JSON. No es un fallo de red
    // ni de clave: es que del documento no salió nada aprovechable, y la
    // pantalla lo dice de otra manera («búscalo a mano»).
    if (!datos) return { estado: "ilegible" };

    return { estado: "ok", datos, modelo: respuesta.modelo ?? modelo };
  } catch (error) {
    console.error("[ia] fallo al leer el documento", error);

    if (error instanceof ErrorModelo && error.tipo === "sin_clave") return { estado: "sin_clave" };

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
