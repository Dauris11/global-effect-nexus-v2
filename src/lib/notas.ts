/**
 * Escala de calificaciones.
 *
 * Las notas se guardan de 0 a 100 (`inscripcion_360.nota` y
 * `historial_calificacion.nota_numerica` son NUMERIC(5,2)) y se
 * muestran además como letra e índice sobre 4.00, que es lo que pide el portal
 * estudiantil y lo que la beca usa como referencia.
 *
 * Los colores ya no cambian de matiz. La marca es azul claro, azul oscuro,
 * blanco y negro, así que la escala se dice con el PESO del mismo azul: una A es
 * el azul más oscuro y una F es negra, con dos pasos de azul y un gris en medio.
 * Ordena igual que el arcoíris de antes y además se lee en escala de grises.
 *
 * Clases literales, para que Tailwind las compile.
 */

export type Letra = "A" | "B" | "C" | "D" | "F";

/** Nota mínima para aprobar. */
export const NOTA_APROBADA = 70;

/** Por debajo de este índice, el estudiante entra en prueba académica. */
export const GPA_PRUEBA_ACADEMICA = 2;

const TRAMOS: readonly {
  minimo: number;
  letra: Letra;
  gpa: number;
  color: string;
}[] = [
  { minimo: 90, letra: "A", gpa: 4, color: "text-white bg-[#0a6a8a] border-[#0a6a8a]" },
  { minimo: 80, letra: "B", gpa: 3, color: "text-white bg-[#2096BA] border-[#2096BA]" },
  { minimo: 70, letra: "C", gpa: 2, color: "text-[#187a99] bg-[#2096BA]/15 border-[#2096BA]/30" },
  { minimo: 60, letra: "D", gpa: 1, color: "text-slate-600 bg-slate-100 border-slate-200" },
  { minimo: 0, letra: "F", gpa: 0, color: "text-white bg-[#171A1D] border-[#171A1D]" },
];

function tramoDe(nota: number) {
  // Los tramos van de mayor a menor, así que el primero que cumple es el suyo.
  return TRAMOS.find((tramo) => nota >= tramo.minimo) ?? TRAMOS[TRAMOS.length - 1];
}

function tramoDeLetra(letra: Letra) {
  return TRAMOS.find((tramo) => tramo.letra === letra) ?? TRAMOS[TRAMOS.length - 1];
}

export function letraDe(nota: number): Letra {
  return tramoDe(nota).letra;
}

export function gpaDe(nota: number): number {
  return tramoDe(nota).gpa;
}

/**
 * ¿Es una de las cinco letras de la escala?
 *
 * `historial_calificacion.nota_letra` es TEXT sin CHECK, así que lo que viene de
 * la base se comprueba antes de tratarlo como una letra de la escala.
 */
export function esLetra(valor: string | null | undefined): valor is Letra {
  return TRAMOS.some((tramo) => tramo.letra === valor);
}

/** Clases de color de la letra, en cuadro con borde. */
export function colorDeNota(nota: number): string {
  return tramoDe(nota).color;
}

/**
 * Lo mismo, pero desde la letra.
 *
 * Hace falta porque la letra no siempre sale de la nota: la del historial
 * universitario viene guardada, y colorear por el número daría un cuadro
 * esmeralda alrededor de una B si la escala de aquel año no era esta.
 */
export function colorDeLetra(letra: Letra): string {
  return tramoDeLetra(letra).color;
}

export function aprobada(nota: number): boolean {
  return nota >= NOTA_APROBADA;
}

/**
 * Promedio simple de un grupo de notas.
 *
 * Simple y no ponderado por créditos a propósito: `historial_calificacion`
 * guarda la materia como texto, sin créditos, y en `materia_360` valen 0 por
 * omisión. Mezclar filas con peso y filas sin él daría un promedio ponderado a
 * medias, que es un número peor que el simple, no mejor.
 */
export function promedio(notas: readonly number[]): number | null {
  if (notas.length === 0) return null;

  const suma = notas.reduce((total, nota) => total + nota, 0);

  return Math.round((suma / notas.length) * 100) / 100;
}

/** Índice académico sobre 4.00 a partir de las notas de un grupo. */
export function indiceAcademico(notas: readonly number[]): number | null {
  if (notas.length === 0) return null;

  const suma = notas.reduce((total, nota) => total + gpaDe(nota), 0);

  return Math.round((suma / notas.length) * 100) / 100;
}

/**
 * Clave del consejo que acompaña al índice (`studentPortal.gpaHint`).
 * Devuelve `neutral` cuando aún no hay historial: es distinto de ir mal.
 */
export function consejoDeIndice(
  indice: number | null,
): "nota-excelente" | "nota-buena" | "nota-riesgo" | "nota-critica" | "neutral" {
  if (indice === null) return "neutral";
  if (indice >= 3.5) return "nota-excelente";
  if (indice >= 2.5) return "nota-buena";
  if (indice >= GPA_PRUEBA_ACADEMICA) return "nota-riesgo";

  return "nota-critica";
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * BANDAS — la escala, agrupada de cinco letras a cuatro tramos.
 *
 * Una letra es para el expediente: dice exactamente qué sacó alguien en una
 * evaluación. Una banda es para leer una lista de doscientas notas de un
 * vistazo, que es lo que hace falta en los reportes y en las clases de 360: ahí la
 * pregunta no es "¿sacó B o C?" sino "¿va bien, aprueba raspando, o está
 * reprobando?", y cinco tramos en una distribución de barras se leen peor que
 * cuatro.
 *
 * No trae umbrales propios: los saca de `TRAMOS`, que es la única escala. Si
 * mañana aprobar deja de ser 70, cambia ahí y las bandas cambian con él. Un
 * segundo juego de números aquí sería una escala paralela esperando a
 * divergir.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type Banda = "excelente" | "buena" | "riesgo" | "critica";

/** En orden, de mejor a peor, para que la distribución no dependa de los datos. */
export const BANDAS: readonly Banda[] = [
  "excelente",
  "buena",
  "riesgo",
  "critica",
];

function minimoDeLetra(letra: Letra): number {
  return tramoDeLetra(letra).minimo;
}

/**
 * Los umbrales de las bandas, derivados de la escala.
 *
 * Se exportan porque el resumen de calificaciones los cuenta EN SQL —un
 * `count(*) FILTER (WHERE nota >= $n)` sobre la tabla entera, no sobre las 500
 * filas que se pintan— y esos números tienen que entrar como parámetros. Si se
 * escribieran a mano dentro de la consulta, habría dos escalas: la de aquí y la
 * del SQL.
 */
export const UMBRAL_BANDA = {
  excelente: minimoDeLetra("A"),
  buena: minimoDeLetra("C"),
  riesgo: minimoDeLetra("D"),
} as const;

export function bandaDe(nota: number): Banda {
  if (nota >= UMBRAL_BANDA.excelente) return "excelente";
  if (nota >= UMBRAL_BANDA.buena) return "buena";
  if (nota >= UMBRAL_BANDA.riesgo) return "riesgo";

  return "critica";
}

/**
 * Color de cada banda: el mismo peso del azul que ya usa su letra.
 *
 * `barra` es un fondo sólido porque en una barra de distribución un
 * `bg-[#2096BA]/15` de 4px de alto no se ve; `pildora` es la versión con
 * contraste de texto para las insignias.
 */
export const BANDA_VISUAL: Record<Banda, { barra: string; pildora: string }> = {
  excelente: { barra: "bg-[#0a6a8a]", pildora: "bg-[#0a6a8a] text-white" },
  buena: { barra: "bg-[#2096BA]", pildora: "bg-[#2096BA]/15 text-[#187a99]" },
  riesgo: { barra: "bg-slate-300", pildora: "bg-slate-100 text-slate-600" },
  critica: { barra: "bg-[#171A1D]", pildora: "bg-[#171A1D] text-white" },
};

/**
 * Color del índice académico, por el mismo consejo que ya lo interpreta.
 *
 * Va indexado por lo que devuelve `consejoDeIndice` y no por umbrales propios:
 * el 3.5, el 2.5 y el 2.0 están escritos una sola vez, ahí arriba. Un mapa con
 * sus propios números sería una segunda opinión sobre cuándo alguien va bien.
 *
 * `neutral` —sin historial todavía— va en gris y no en el tono de "va mal": no
 * tener notas no es ir mal.
 */
export const COLOR_INDICE: Record<
  ReturnType<typeof consejoDeIndice>,
  string
> = {
  "nota-excelente": "text-white bg-[#0a6a8a] border-[#0a6a8a]",
  "nota-buena": "text-white bg-[#2096BA] border-[#2096BA]",
  "nota-riesgo": "text-slate-600 bg-slate-100 border-slate-200",
  "nota-critica": "text-white bg-[#171A1D] border-[#171A1D]",
  neutral: "text-slate-500 bg-slate-50 border-slate-200",
};
