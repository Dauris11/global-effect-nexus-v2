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
  /** Año y ronda del cuatrimestre (R1/R2/R3 → 1/2/3). */
  anio: number;
  ronda: number;
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
      anio: Number(anio),
      ronda: Number(rondaPeriodo),
      letra,
    });
  }

  // Sin matrícula ni una sola fila, esto no es un gradua.
  return lectura.matricula && lectura.filas.length > 0 ? lectura : null;
}

/** Solo dígitos: «2023-0253» y «20230253» son la misma matrícula. */
export const soloDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

const NUMERAL = ["I", "II", "III"];

/** «2026-II»: como se nombran los períodos en el resto del sistema. */
export const etiquetaPeriodo = (anio: number, ronda: number) => `${anio}-${NUMERAL[ronda - 1] ?? ronda}`;

/** Lo contrario: «2026-II» → { anio: 2026, ronda: 2 }; `null` si no tiene esa forma. */
export function leerEtiquetaPeriodo(texto: string): { anio: number; ronda: number } | null {
  const m = /^(\d{4})-(I{1,3}|[123])$/i.exec(texto.trim());

  if (!m) return null;

  const ronda = /^\d$/.test(m[2]) ? Number(m[2]) : m[2].length;

  return { anio: Number(m[1]), ronda };
}

/** «ISC-R-2-2019» y «ISC-R2-2019» son el mismo plan: se comparan sin signos ni mayúsculas. */
export const normalizarVersion = (v: string | null | undefined) => (v ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Dos nombres se parecen si uno contiene al otro, sin acentos ni mayúsculas. */
export function nombresParecidos(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (x: string | null | undefined) => (x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/gi, "").trim().toLowerCase();
  const x = n(a);
  const y = n(b);

  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

/**
 * Qué lector sabe leer el gradua de cada universidad, por siglas. Cada una imprime
 * el suyo; al llegar otra se añade aquí con el mismo resultado y nada más cambia.
 */
export const LECTORES_GRADUA: Record<string, (paginas: readonly string[]) => LecturaGradua | null> = {
  UCATECI: leerGradua,
};
