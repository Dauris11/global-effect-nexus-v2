/**
 * Reglas académicas compartidas entre servidor y cliente.
 *
 * Cada estudiante universitario debe cursar al menos 2 clases obligatorias
 * por cuatrimestre. Esta exigencia aplica únicamente a estudiantes
 * universitarios (quienes tienen institución universitaria registrada en su
 * expediente).
 */

export const MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE = 2;

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

