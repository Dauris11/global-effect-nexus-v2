import { consultarUna } from "@/lib/db";
import {
  leerDocumento,
  MAXIMO_DOCUMENTO_OCR,
  TIPOS_DOCUMENTO_OCR,
  type LecturaDocumento,
} from "@/lib/ia";

/**
 * OCR de documentos: lo que se le pide al modelo y qué se hace con su respuesta.
 *
 * Lo usa el alta de expediente, y lo que quiere es **precargar** campos para
 * que una persona los confirme. Nunca guardar directamente lo que dijo el modelo.
 *
 * De ahí las tres reglas de este archivo:
 *
 *   1. **`confianza` viaja siempre y la pantalla la enseña.** Un dato leído al
 *      62% y otro al 99% no se revisan igual, y esconder el número convierte
 *      una sugerencia en un hecho.
 *   2. **Cada campo se valida por separado.** Una cédula que no tiene forma de
 *      cédula, o una fecha que no existe, se descartan y el resto se conserva:
 *      media lectura buena ahorra la mitad del trabajo, y una lectura que se
 *      cuela mal cuesta más que no tenerla.
 *   3. **Queda rastro en `extraccion_ocr`**, tabla que llevaba creada desde la
 *      migración 0012 sin que nadie escribiera en ella. Con el modelo, la
 *      confianza y los campos leídos: es lo que permite, meses después, saber
 *      si un dato raro del expediente lo teclateó alguien o lo leyó una máquina.
 *      `documento_id` queda en NULL a propósito —el archivo no se guarda, ver
 *      la cabecera de `leerDocumento`—.
 */

const INSTRUCCIONES = [
  "Eres un lector de documentos de identidad y fichas escaneadas de una fundación educativa dominicana.",
  "Transcribes lo que VES. No completas, no corriges, no adivinas.",
  "Responde SOLO con un objeto JSON, sin texto alrededor y sin bloque de código.",
  "Campos:",
  '  "nombre": nombre completo de la persona, tal como aparece, o null.',
  '  "cedula": número de documento con guiones si los lleva, o null.',
  '  "fecha_nacimiento": en formato YYYY-MM-DD, o null.',
  '  "confianza": entero de 0 a 100, tu certeza sobre la lectura del NOMBRE.',
  "Si el documento no es legible o no es un documento de identidad, devuelve todos los campos en null y confianza 0.",
] .join("\n");

const PETICION =
  "Lee este documento y devuelve el JSON con los campos indicados.";

export type DatosLeidos = {
  nombre: string | null;
  cedula: string | null;
  fechaNacimiento: string | null;
  /** 0–100. Es la certeza del modelo, no una garantía. */
  confianza: number;
};

export type ResultadoOcr =
  | { estado: "ok"; datos: DatosLeidos }
  | { estado: "tipo_no_admitido" }
  | { estado: "demasiado_grande" }
  | { estado: "sin_clave" }
  | { estado: "ilegible" }
  | { estado: "error" };

/**
 * Lee un documento y devuelve los campos ya validados.
 *
 * El archivo se comprueba antes de gastar una llamada a la API: tipo y tamaño.
 * El `accept` del `input` no cuenta como comprobación —es una sugerencia del
 * navegador que se salta con una petición a mano—.
 */
export async function leerDocumentoDeIdentidad(
  archivo: File,
  usuarioId: string,
  estudianteId: string | null = null,
): Promise<ResultadoOcr> {
  if (!(TIPOS_DOCUMENTO_OCR as readonly string[]).includes(archivo.type)) {
    return { estado: "tipo_no_admitido" };
  }

  if (archivo.size > MAXIMO_DOCUMENTO_OCR) {
    return { estado: "demasiado_grande" };
  }

  const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64");

  const lectura = await leerDocumento(
    { mime: archivo.type, base64 },
    INSTRUCCIONES,
    PETICION,
  );

  if (lectura.estado === "sin_clave") return { estado: "sin_clave" };
  if (lectura.estado === "ilegible") return { estado: "ilegible" };

  if (lectura.estado !== "ok") {
    await anotarExtraccion({
      usuarioId,
      estudianteId,
      estado: "error",
      modelo: null,
      datos: null,
      confianza: null,
      mensaje: lectura.estado,
    });

    return { estado: "error" };
  }

  const datos = validar(lectura.datos);

  await anotarExtraccion({
    usuarioId,
    estudianteId,
    estado: "completado",
    modelo: lectura.modelo,
    datos,
    confianza: datos.confianza,
    mensaje: null,
  });

  // Sin nombre no hay nada que precargar, y es el único campo que las dos
  // pantallas necesitan: se trata como ilegible aunque el modelo respondiera.
  if (!datos.nombre) return { estado: "ilegible" };

  return { estado: "ok", datos };
}

/**
 * Los cuatro campos, comprobados uno a uno.
 *
 * Nada se convierte ni se normaliza más allá de recortar: si el documento dice
 * "MARIA  DE LOS SANTOS", eso es lo que se enseña. Arreglar mayúsculas o
 * espacios aquí sería empezar a decidir qué pone en un documento que no se
 * guarda y que la persona ya tiene delante.
 */
function validar(bruto: Record<string, unknown>): DatosLeidos {
  const nombre = texto(bruto.nombre, 160);
  const cedula = texto(bruto.cedula, 30);
  const fecha = texto(bruto.fecha_nacimiento, 10);

  return {
    nombre,
    // Una cédula dominicana son 11 dígitos, con o sin guiones. Se admite
    // cualquier cosa de 7 a 20 caracteres que solo tenga dígitos y guiones:
    // hay pasaportes y actas con otros formatos, y rechazar el documento de
    // alguien por no ser una cédula sería peor que dejarlo confirmar a mano.
    cedula: cedula && /^[\d-]{7,20}$/.test(cedula) ? cedula : null,
    fechaNacimiento: fecha && esFechaIso(fecha) ? fecha : null,
    confianza: entero(bruto.confianza),
  };
}

function texto(valor: unknown, largo: number): string | null {
  if (typeof valor !== "string") return null;

  const limpio = valor.trim().slice(0, largo);

  return limpio === "" ? null : limpio;
}

/** 0–100. Cualquier otra cosa cuenta como 0: sin certeza declarada, ninguna. */
function entero(valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor);

  if (!Number.isFinite(numero)) return 0;

  return Math.min(100, Math.max(0, Math.round(numero)));
}

function esFechaIso(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;

  const fecha = new Date(`${valor}T00:00:00Z`);

  return (
    !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
  );
}

/**
 * El rastro de la extracción.
 *
 * No lanza nunca, igual que `registrar()` de auditoría: si el rastro falla, la
 * lectura ya se hizo y abortarla ahora dejaría a quien está dando de alta un
 * expediente sin su precarga por un problema que no es suyo.
 */
async function anotarExtraccion({
  usuarioId,
  estudianteId,
  estado,
  modelo,
  datos,
  confianza,
  mensaje,
}: {
  usuarioId: string;
  estudianteId: string | null;
  estado: "completado" | "error";
  modelo: string | null;
  datos: DatosLeidos | null;
  confianza: number | null;
  mensaje: string | null;
}): Promise<void> {
  try {
    await consultarUna<{ id: string }>(
      `INSERT INTO extraccion_ocr
              (documento_id, estudiante_id, estado, modelo, confianza,
               datos_extraidos, mensaje_error, creado_por_id)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        estudianteId,
        estado,
        modelo,
        confianza,
        datos ? JSON.stringify(datos) : null,
        mensaje,
        usuarioId,
      ],
    );
  } catch (error) {
    console.error("[ocr] no se pudo anotar la extracción", error);
  }
}
