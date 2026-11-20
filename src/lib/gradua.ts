/**
 * Lectura del «gradua»: el reporte «Validación de asignaturas cursadas según
 * pénsum» que cada estudiante baja del portal de su universidad. Recibe el texto
 * ya extraído del PDF, una fila por línea (así lo entrega `unpdf`), y devuelve lo
 * que dice: quién es, qué cursó y con qué resultado.
 *
 * Es el formato de UCATECI. Cada universidad imprime el suyo; cuando llegue otra,
 * se añade su lector aquí con el mismo resultado y el resto del sistema no cambia.
 *
 * Qué NO hace: no inventa. Una línea que no reconoce se ignora, y quien llama
 * recibe el total de filas leídas y el índice que declara el propio reporte para
 * poder compararlo con el que calcula el sistema.
 */

export type FilaGradua = {
  /** Código de la materia en el pénsum; en una electiva, el del cupo (ELE015). */
  codigo: string;
  /** Solo electivas: la materia real que ocupó el cupo (ISC127 INTELIGENCIA ARTIFICIAL). */
  detalle: string | null;
  nombre: string;
  creditos: number;
  puntos: number;
  /** «R2 2023»: período dentro del año y año. `null` si no hay. */
  periodo: string | null;
  /** A, B, C, D, F, P (seminario) o R (retirada). `null` si no hay resultado. */
  letra: string | null;
};

export type LecturaGradua = {
  nombre: string | null;
  matricula: string | null;
  version: string | null;
  /** El índice general que imprime el reporte. */
  indiceReportado: number | null;
  creditosReportados: number | null;
  puntosReportados: number | null;
  filas: FilaGradua[];
  /** Materias del reporte sin resultado (no cursadas todavía). */
  noCursadas: number;
};

const RE_ENCABEZADO = /^(.*?)(\d{6,12})\s*(\S+?)\s*Versi[oó]n:?\s*$/;
const RE_GRUPO = /^(SEM\d+|ELE\d+)$/;
const RE_FILA = /^([A-Z]{3}\d{3})\s+(.+?)\s+(\d+)\s+(\d+)(?:\s+R(\d)\s+(\d{4})\s+([A-Z]))?$/;
const RE_TOTAL = /^Total\s+(\d+)\s+(\d+)$/i;
const RE_INDICE = /[ÍI]ndice General:?\s*(\d+(?:[.,]\d+)?)/i;

export function leerGradua(paginas: readonly string[]): LecturaGradua | null {
  const lineas = paginas.flatMap((p) => p.split("\n")).map((l) => l.trim()).filter(Boolean);
  const lectura: LecturaGradua = {
    nombre: null,
    matricula: null,
    version: null,
    indiceReportado: null,
    creditosReportados: null,
    puntosReportados: null,
    filas: [],
    noCursadas: 0,
  };
  let grupo: string | null = null;

  for (const linea of lineas) {
    const enc = RE_ENCABEZADO.exec(linea);

    if (enc && !lectura.matricula) {
      lectura.nombre = enc[1].trim() || null;
      lectura.matricula = enc[2];
      lectura.version = enc[3];
      continue;
    }

    const total = RE_TOTAL.exec(linea);

    if (total) {
      lectura.creditosReportados = Number(total[1]);
      lectura.puntosReportados = Number(total[2]);
      continue;
    }

    const indice = RE_INDICE.exec(linea);

    if (indice) {
      lectura.indiceReportado = Number(indice[1].replace(",", "."));
      continue;
    }

    const g = RE_GRUPO.exec(linea);

    if (g) {
      grupo = g[1];
      continue;
    }

    const f = RE_FILA.exec(linea);

    if (!f) continue;

    const [, codigo, nombre, creditos, puntos, rondaPeriodo, anio, letra] = f;

    if (!letra) {
      // Sin período ni resultado: la materia está en el pénsum pero no se cursó.
      lectura.noCursadas++;
      continue;
    }

    const esElectiva = grupo?.startsWith("ELE") ?? false;

    lectura.filas.push({
      codigo: esElectiva ? (grupo as string) : codigo,
      detalle: esElectiva ? `${codigo} ${nombre}` : null,
      nombre,
      creditos: Number(creditos),
      puntos: Number(puntos),
      periodo: `R${rondaPeriodo} ${anio}`,
      letra,
    });
  }

  // Sin matrícula ni una sola fila, esto no es un gradua.
  return lectura.matricula && lectura.filas.length > 0 ? lectura : null;
}

/** Solo dígitos: «2023-0253» y «20230253» son la misma matrícula. */
export const soloDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
