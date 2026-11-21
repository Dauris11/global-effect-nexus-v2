import { consultarUna } from "@/lib/db";
import { GPA_PRUEBA_ACADEMICA, promedio } from "@/lib/notas";
import { parametros } from "@/server/parametros/consultas";
import type { CatalogoDelEstudiante } from "@/server/universidades/consultas";

/**
 * UN solo índice y UN solo umbral para todo el sistema.
 *
 * Antes la lista de expedientes promediaba el GPA del historial, el pénsum
 * calculaba otro con las reglas de la universidad y el código comparaba contra un
 * 2,00 fijo mientras el reglamento (y el parámetro `becas.indice_minimo`) decían
 * 3,00. Ahora el índice es el nativo —las reglas de la universidad del estudiante
 * sobre sus resultados— y, solo si no tiene resultados nativos, el promedio del
 * historial anterior; y el umbral es el parámetro editable.
 */

/** Por debajo de este índice el estudiante está en observación académica. */
export async function umbralDeIndice(): Promise<number> {
  const n = Number((await parametros())["becas.indice_minimo"]);

  return Number.isFinite(n) && n > 0 ? n : GPA_PRUEBA_ACADEMICA;
}

/**
 * Umbrales de alerta de la universidad del estudiante: del acumulado y del último
 * período. Cada universidad los define en su ficha; mientras estén sin definir se
 * usa el global (`becas.indice_minimo`). `maximo` es la escala (UCATECI: 4,00).
 */
export async function umbralesDeUniversidad(estudianteId: string): Promise<{ acumulado: number; periodo: number; maximo: number | null }> {
  const [global, fila] = await Promise.all([
    umbralDeIndice(),
    consultarUna<{ acumulado: number | null; periodo: number | null; maximo: number | null }>(
      `SELECT u.indice_minimo_acumulado::float8 AS acumulado, u.indice_minimo_periodo::float8 AS periodo, u.indice_maximo::float8 AS maximo
         FROM estudiante e JOIN universidad u ON u.id = e.universidad_id WHERE e.id = $1`,
      [estudianteId],
    ),
  ]);

  return { acumulado: fila?.acumulado ?? global, periodo: fila?.periodo ?? fila?.acumulado ?? global, maximo: fila?.maximo ?? null };
}

/** Índice del estudiante, o `null` si no tiene ni resultados nativos ni historial. */
export async function indiceDelEstudiante(estudianteId: string | null): Promise<number | null> {
  if (!estudianteId) return null;

  const fila = await consultarUna<{ nativo: number | null; historial: number | null }>(
    `SELECT indice_estudiante($1)::float8 AS nativo,
            (SELECT round(avg(gpa), 2)::float8 FROM historial_calificacion WHERE estudiante_id = $1) AS historial`,
    [estudianteId],
  );

  return fila?.nativo ?? fila?.historial ?? null;
}

export type AlertaAcademica =
  | { tipo: "indice_bajo"; indice: number; umbral: number }
  | { tipo: "indice_periodo_bajo"; periodo: string; indice: number; umbral: number }
  | { tipo: "reprobadas"; materias: string[] }
  | { tipo: "retiradas"; materias: string[] };

/**
 * Alertas que se derivan al mirar el expediente, sin tabla de avisos que se pueda
 * quedar vieja: en cuanto entra una calificación, la alerta aparece o desaparece.
 * Una materia retirada que ya se volvió a cursar deja de contar (el estado es el
 * del intento más reciente).
 */
export function alertasAcademicas(
  catalogo: CatalogoDelEstudiante,
  indice: number | null,
  umbral: number,
  /** Índice del último período cargado y su umbral; sin esto no hay alerta de período. */
  ultimoPeriodo?: { periodo: string; indice: number | null; umbral: number } | null,
): AlertaAcademica[] {
  const alertas: AlertaAcademica[] = [];
  const nombres = (estado: "reprobada" | "retirada") => catalogo.materias.filter((m) => m.estado === estado).map((m) => `${m.codigo} ${m.nombre}`);

  if (indice !== null && indice < umbral) alertas.push({ tipo: "indice_bajo", indice, umbral });

  if (ultimoPeriodo && ultimoPeriodo.indice !== null && ultimoPeriodo.indice < ultimoPeriodo.umbral) {
    alertas.push({ tipo: "indice_periodo_bajo", periodo: ultimoPeriodo.periodo, indice: ultimoPeriodo.indice, umbral: ultimoPeriodo.umbral });
  }

  const reprobadas = nombres("reprobada");
  const retiradas = nombres("retirada");

  if (reprobadas.length > 0) alertas.push({ tipo: "reprobadas", materias: reprobadas });
  if (retiradas.length > 0) alertas.push({ tipo: "retiradas", materias: retiradas });

  return alertas;
}

/** Promedio de GPA de unas notas, para los sitios que aún solo tienen el historial. */
export const promedioDeNotas = (gpas: readonly number[]) => promedio(gpas);
