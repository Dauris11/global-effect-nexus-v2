import { consultar } from "@/lib/db";

/**
 * Historial de Global Effect 360 de UN estudiante, para la ficha del
 * expediente y para el historial académico.
 *
 * Es otro programa distinto de la carrera: estas materias no cuentan para el
 * índice académico (ver la nota de la 0027), así que no se mezclan con
 * `historial_calificacion` y su promedio es propio.
 */

export const ESTADOS_360 = [
  "cursando",
  "prematriculada",
  "aprobada",
  "reprobada",
  "retirada",
] as const;

export type Estado360 = (typeof ESTADOS_360)[number];

export type MateriaDe360 = {
  id: string;
  materia: string;
  estado: Estado360;
  nota: number | null;
  decidida_por: string | null;
  /** Texto ISO: un `Date` no sobrevive bien a la frontera servidor-cliente. */
  decidida_en: string | null;
  /** Sesiones del período con marca para este estudiante: las únicas que cuentan. */
  marcadas: number;
  presentes: number;
};

export type PeriodoDe360 = {
  id: string;
  nombre: string;
  materias: MateriaDe360[];
};

export type Historial360 = {
  periodos: PeriodoDe360[];
  /** Nota media de las materias con nota; `null` si ninguna la tiene. */
  promedio: number | null;
};

/**
 * Materias de 360 del estudiante agrupadas por período, el más reciente
 * primero.
 *
 * La asistencia se cuenta por inscripción (materia + período), no por
 * materia: quien repite no arrastra las faltas del intento anterior. Va en una
 * subconsulta para no multiplicar filas al unir sesiones.
 */
export async function historial360DelEstudiante(
  estudianteId: string,
): Promise<Historial360> {
  const filas = await consultar<
    MateriaDe360 & { periodo_id: string; periodo: string }
  >(
    `SELECT i.id::text AS id,
            m.nombre AS materia,
            i.estado,
            i.nota::float8 AS nota,
            u.nombre AS decidida_por,
            to_char(i.decidida_en AT TIME ZONE 'America/Santo_Domingo',
                    'YYYY-MM-DD') AS decidida_en,
            p.id::text AS periodo_id,
            p.nombre AS periodo,
            coalesce(asis.marcadas, 0)::int AS marcadas,
            coalesce(asis.presentes, 0)::int AS presentes
       FROM inscripcion_360 i
       JOIN materia_360 m ON m.id = i.materia_id
       JOIN periodo p ON p.id = i.periodo_id
       LEFT JOIN usuario u ON u.id = i.decidida_por
       LEFT JOIN LATERAL (
              SELECT count(*) AS marcadas,
                     count(*) FILTER (WHERE a.presente IS TRUE) AS presentes
                FROM sesion_360 s
                JOIN asistencia_360 a ON a.sesion_id = s.id
               WHERE s.materia_360_id = i.materia_id
                 AND s.periodo_id = i.periodo_id
                 AND a.inscripcion_id = i.id
            ) asis ON TRUE
      WHERE i.estudiante_id = $1
      ORDER BY p.fecha_inicio DESC NULLS LAST, p.nombre DESC, m.nombre`,
    [estudianteId],
  );

  const grupos = new Map<string, PeriodoDe360>();
  const notas: number[] = [];

  for (const { periodo_id, periodo, ...materia } of filas) {
    if (materia.nota !== null) notas.push(materia.nota);

    const grupo = grupos.get(periodo_id);
    if (grupo) grupo.materias.push(materia);
    else grupos.set(periodo_id, { id: periodo_id, nombre: periodo, materias: [materia] });
  }

  return {
    periodos: [...grupos.values()],
    promedio:
      notas.length === 0 ? null : notas.reduce((a, b) => a + b, 0) / notas.length,
  };
}
