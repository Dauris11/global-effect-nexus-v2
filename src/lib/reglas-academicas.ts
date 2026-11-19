/**
 * Reglas académicas compartidas entre servidor y cliente.
 *
 * 1. Mínimo cuatrimestral: cada estudiante universitario debe cursar al menos 2
 *    clases obligatorias por cuatrimestre.
 * 2. Tope de créditos universitarios: se rige por las pautas de la universidad
 *    en la que estudia el becado (UCATECI, UNPHU, UASD o UTESA), con respaldo
 *    parametrizable en `/configuracion/parametros`.
 */

export const MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE = 2;

export const UNIVERSIDADES_CONVENIO = [
  "UCATECI",
  "UNPHU",
  "UASD",
  "UTESA",
] as const;

export type UniversidadConvenio = (typeof UNIVERSIDADES_CONVENIO)[number];

/**
 * Tope regular de créditos por período académico según las pautas de cada
 * universidad donde estudian los becados de la Fundación:
 *   · UCATECI (cuatrimestral): 24 créditos
 *   · UNPHU   (cuatrimestral): 22 créditos
 *   · UASD    (semestral):     20 créditos
 *   · UTESA   (cuatrimestral): 24 créditos
 */
export const TOPE_CREDITOS_POR_UNIVERSIDAD: Record<UniversidadConvenio, number> = {
  UCATECI: 24,
  UNPHU: 22,
  UASD: 20,
  UTESA: 24,
};

export const TOPE_CREDITOS_GENERAL = 24;

const CLAVE_PARAMETRO_UNIVERSIDAD: Record<UniversidadConvenio, string> = {
  UCATECI: "becas.creditos_maximos_ucateci",
  UNPHU: "becas.creditos_maximos_unphu",
  UASD: "becas.creditos_maximos_uasd",
  UTESA: "becas.creditos_maximos_utesa",
};

/**
 * Identifica a cuál de las cuatro universidades principales pertenece el texto
 * registrado en `estudiante.universidad` (admite siglas o nombre completo).
 */
export function detectarUniversidadConvenio(
  universidad: string | null | undefined,
): UniversidadConvenio | null {
  if (!universidad) return null;

  const limpio = universidad
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (limpio.includes("UCATECI") || limpio.includes("CATOLICA DEL CIBAO")) {
    return "UCATECI";
  }
  if (limpio.includes("UNPHU") || limpio.includes("PEDRO HENRIQUEZ")) {
    return "UNPHU";
  }
  if (limpio.includes("UASD") || limpio.includes("AUTONOMA DE SANTO DOMINGO")) {
    return "UASD";
  }
  if (limpio.includes("UTESA") || limpio.includes("TECNOLOGICA DE SANTIAGO")) {
    return "UTESA";
  }

  return null;
}

/**
 * Calcula el tope de créditos aplicable al estudiante según su universidad
 * (UCATECI, UNPHU, UASD o UTESA) y los parámetros institucionales vigentes.
 */
export function topeCreditosDeUniversidad(
  universidad: string | null | undefined,
  valoresParametros?: Record<string, string | number | undefined>,
): {
  universidad: UniversidadConvenio | null;
  etiquetaUniversidad: string | null;
  tope: number;
} {
  const convenio = detectarUniversidadConvenio(universidad);

  if (convenio) {
    const clave = CLAVE_PARAMETRO_UNIVERSIDAD[convenio];
    const desdeParametro = Number(valoresParametros?.[clave]);
    const tope =
      Number.isFinite(desdeParametro) && desdeParametro > 0
        ? desdeParametro
        : TOPE_CREDITOS_POR_UNIVERSIDAD[convenio];

    return {
      universidad: convenio,
      etiquetaUniversidad: convenio,
      tope,
    };
  }

  const generalDesdeParametro = Number(
    valoresParametros?.["becas.creditos_maximos_cuatrimestre"],
  );
  const topeGeneral =
    Number.isFinite(generalDesdeParametro) && generalDesdeParametro > 0
      ? generalDesdeParametro
      : TOPE_CREDITOS_GENERAL;

  const textoUniversidad = universidad?.trim() || null;

  return {
    universidad: null,
    etiquetaUniversidad: textoUniversidad,
    tope: topeGeneral,
  };
}

export type EvaluacionMinimoCuatrimestral = {
  aplica: boolean;
  minimo: number;
  clases360: number;
  clasesCarrera: number;
  tomadas: number;
  faltantes: number;
  cumplido: boolean;
};

/** Un estudiante es universitario cuando tiene una universidad registrada. */
export function esEstudianteUniversitario(
  universidad: string | null | undefined,
): boolean {
  return Boolean(universidad && universidad.trim().length > 0);
}

/**
 * Evalúa el cumplimiento del mínimo obligatorio de 2 clases por cuatrimestre.
 * Para estudiantes no universitarios, la regla no aplica (`cumplido: true`).
 */
export function evaluarMinimoCuatrimestral({
  esUniversitario,
  clases360,
  clasesCarrera,
}: {
  esUniversitario: boolean;
  clases360: number;
  clasesCarrera: number;
}): EvaluacionMinimoCuatrimestral {
  const tomadas = Math.max(0, clases360) + Math.max(0, clasesCarrera);

  if (!esUniversitario) {
    return {
      aplica: false,
      minimo: 0,
      clases360: Math.max(0, clases360),
      clasesCarrera: Math.max(0, clasesCarrera),
      tomadas,
      faltantes: 0,
      cumplido: true,
    };
  }

  const faltantes = Math.max(0, MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE - tomadas);

  return {
    aplica: true,
    minimo: MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE,
    clases360: Math.max(0, clases360),
    clasesCarrera: Math.max(0, clasesCarrera),
    tomadas,
    faltantes,
    cumplido: faltantes === 0,
  };
}

