import { gradosDeRespuesta, type GradoLiceo } from "@/lib/record-liceo";
import { leerDocumento, MAXIMO_DOCUMENTO_OCR, TIPOS_DOCUMENTO_OCR } from "@/lib/ia";

/**
 * Leer una foto o PDF del récord de notas de secundaria y devolver grados BORRADOR.
 * La IA solo transcribe lo impreso: no suma, no promedia y no corrige. Todo pasa
 * después por una persona y por `validarRecord` antes de guardarse.
 */

const INSTRUCCIONES = [
  "Eres un lector de récords de notas de secundaria de la República Dominicana (MINERD).",
  "Transcribes lo IMPRESO. No completas, no corriges, no adivinas y NO calculas ningún promedio.",
  "Responde SOLO con un objeto JSON, sin texto alrededor y sin bloque de código:",
  '{"estudiante":"nombre tal como aparece o null","grados":[{"grado":1,"anio":"2016-2017","centro":"…","notas":[{"materia":"…","nota":80,"modulo":false,"confianza":0}]}]}',
  "Reglas de lectura de ESTE formato de papel:",
  "- «grado» es el número del grado (1 a 6) y «anio» el año escolar del encabezado, p. ej. «2016-2017».",
  "- Una tabla puede traer VARIOS grados en columnas lado a lado (1er, 2do y 3er grado). Lee cada columna por separado: no mezcles notas de una con otra.",
  "- «centro» de cada grado sale de SU propia celda «Centro de procedencia» (debajo de esa columna o de esa tabla). Si no aparece, null.",
  "- Una fila por materia o módulo y por grado. «Lenguas Extranjeras» puede tener DOS filas (Inglés y Francés): son dos materias, con su nota cada una. Escribe «Lenguas Extranjeras Inglés» y «Lenguas Extranjeras Francés».",
  '- Los módulos técnicos empiezan con «MF_» (p. ej. «MF_002_3 Ofimática»): ponles "modulo": true y escribe el nombre completo con su código.',
  "- «nota» es SOLO la «Calificación Final» impresa de esa materia: un número de 0 a 100. Si no se puede leer con certeza, null.",
  "- IGNORA la columna «Fecha de aprobación» (05-17, 06-20…), la leyenda de calificaciones (A=90-100…), los sellos, las firmas y los datos personales.",
  "- IGNORA todo lo escrito A MANO o a lápiz (números azules o grises sobre las celdas, como un promedio o «GPA 89»): no es una nota.",
  "- IGNORA manchas, puntos sueltos junto a una nota («95.») y el texto espejado que se transparenta del otro lado de la hoja.",
  '- «confianza» es un entero de 0 a 100: tu certeza de haber leído bien ESA nota.',
  'Si el documento no es un récord de notas de secundaria o no se lee, devuelve {"estudiante":null,"grados":[]}.',
].join("\n");

export type LecturaRecord =
  | { estado: "ok"; grados: GradoLiceo[]; estudiante: string | null }
  | { estado: "tipo_no_admitido" | "demasiado_grande" | "sin_clave" | "ilegible" | "sin_filas" | "error" };

export async function leerRecordDeArchivo(archivo: { mime: string; base64: string; bytes: number }): Promise<LecturaRecord> {
  if (!(TIPOS_DOCUMENTO_OCR as readonly string[]).includes(archivo.mime)) return { estado: "tipo_no_admitido" };
  if (archivo.bytes > MAXIMO_DOCUMENTO_OCR) return { estado: "demasiado_grande" };

  const lectura = await leerDocumento(
    { mime: archivo.mime, base64: archivo.base64 },
    INSTRUCCIONES,
    "Lee este récord de notas y devuelve el JSON con todos los grados visibles.",
    { maxTokens: 8000 },
  );

  if (lectura.estado === "sin_clave") return { estado: "sin_clave" };
  if (lectura.estado === "ilegible" || lectura.estado === "rechazada") return { estado: "ilegible" };
  if (lectura.estado !== "ok") return { estado: "error" };

  const grados = gradosDeRespuesta(lectura.datos);
  const nombre = (lectura.datos as { estudiante?: unknown }).estudiante;

  return grados.length === 0 ? { estado: "sin_filas" } : { estado: "ok", grados, estudiante: typeof nombre === "string" ? nombre.slice(0, 160) : null };
}
