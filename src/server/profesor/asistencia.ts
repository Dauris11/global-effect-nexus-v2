import { consultar } from "@/lib/db";

/**
 * Consultas de asistencia de Global Effect 360.
 *
 * Mismo criterio de alcance que `clases360`: con `docenteId` solo las clases de
 * esa persona, con `null` todas (quien tiene `academico.escribir`).
 *
 * Las fechas y horas salen ya como texto (`to_char`): `pg` convierte DATE a
 * `Date` en la zona del proceso y un día puede correrse al serializarlo.
 */

export type SesionClase360 = {
  id: string;
  materia_id: string;
  periodo_id: string;
  periodo: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  presentes: number;
  ausentes: number;
  /** Inscritos no retirados del período: lo que hay que marcar. */
  total: number;
};

export type MarcaAsistencia = {
  inscripcion_id: string;
  nombre: string;
  /** `null` es "sin marcar": no es lo mismo que ausente. */
  presente: boolean | null;
};

export type PeriodoDeClase360 = {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
};

export type AsistenciaDeClases = {
  sesiones: Record<string, SesionClase360[]>;
  marcas: Record<string, MarcaAsistencia[]>;
  periodos: Record<string, PeriodoDeClase360[]>;
};

/** Sesiones, marcas y períodos con inscritos de las clases visibles. */
export async function asistenciaDeClases360(
  docenteId: string | null,
): Promise<AsistenciaDeClases> {
  const [sesiones, marcas, periodos] = await Promise.all([
    consultar<SesionClase360>(
      `SELECT s.id, s.materia_360_id AS materia_id, s.periodo_id,
              p.nombre AS periodo,
              to_char(s.fecha, 'YYYY-MM-DD') AS fecha,
              to_char(s.hora_inicio, 'HH24:MI') AS hora_inicio,
              to_char(s.hora_fin, 'HH24:MI') AS hora_fin,
              count(*) FILTER (WHERE a.presente IS TRUE)::int  AS presentes,
              count(*) FILTER (WHERE a.presente IS FALSE)::int AS ausentes,
              count(i.id)::int AS total
         FROM sesion_360 s
         JOIN materia_360 m ON m.id = s.materia_360_id
         JOIN periodo p ON p.id = s.periodo_id
         LEFT JOIN inscripcion_360 i
                ON i.materia_id = s.materia_360_id
               AND i.periodo_id = s.periodo_id
               AND i.estado <> 'retirada'
         LEFT JOIN asistencia_360 a
                ON a.sesion_id = s.id AND a.inscripcion_id = i.id
        WHERE ($1::uuid IS NULL OR m.docente_id = $1)
        GROUP BY s.id, p.nombre
        ORDER BY s.fecha DESC`,
      [docenteId],
    ),
    consultar<MarcaAsistencia & { sesion_id: string }>(
      `SELECT s.id AS sesion_id, i.id AS inscripcion_id, e.nombre, a.presente
         FROM sesion_360 s
         JOIN materia_360 m ON m.id = s.materia_360_id
         JOIN inscripcion_360 i
              ON i.materia_id = s.materia_360_id
             AND i.periodo_id = s.periodo_id
             AND i.estado <> 'retirada'
         JOIN estudiante e ON e.id = i.estudiante_id
         LEFT JOIN asistencia_360 a
                ON a.sesion_id = s.id AND a.inscripcion_id = i.id
        WHERE ($1::uuid IS NULL OR m.docente_id = $1)
        ORDER BY e.nombre`,
      [docenteId],
    ),
    consultar<PeriodoDeClase360 & { materia_id: string }>(
      `SELECT DISTINCT i.materia_id, p.id, p.nombre,
              to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
              to_char(p.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
         FROM inscripcion_360 i
         JOIN materia_360 m ON m.id = i.materia_id
         JOIN periodo p ON p.id = i.periodo_id
        WHERE i.estado <> 'retirada'
          AND ($1::uuid IS NULL OR m.docente_id = $1)
        ORDER BY p.fecha_inicio DESC`,
      [docenteId],
    ),
  ]);

  const resultado: AsistenciaDeClases = { sesiones: {}, marcas: {}, periodos: {} };

  for (const s of sesiones) (resultado.sesiones[s.materia_id] ??= []).push(s);
  for (const { sesion_id, ...marca } of marcas) {
    (resultado.marcas[sesion_id] ??= []).push(marca);
  }
  for (const { materia_id, ...periodo } of periodos) {
    (resultado.periodos[materia_id] ??= []).push(periodo);
  }

  return resultado;
}

export type AsistenciaDeMateria = {
  materia_id: string;
  materia: string;
  periodo: string;
  /** Sesiones programadas del período. */
  sesiones: number;
  /** Las que ya tienen marca para este estudiante: las únicas que cuentan. */
  marcadas: number;
  presentes: number;
  ausentes: number;
  /** Presentes sobre marcadas; `null` si aún no hay ninguna marcada. */
  porcentaje: number | null;
};

/** Asistencia del estudiante en las materias que cursa ahora. */
export async function asistenciaDelEstudiante(
  estudianteId: string,
): Promise<AsistenciaDeMateria[]> {
  return consultar<AsistenciaDeMateria>(
    `SELECT m.id AS materia_id, m.nombre AS materia, p.nombre AS periodo,
            count(s.id)::int AS sesiones,
            count(a.sesion_id)::int AS marcadas,
            count(*) FILTER (WHERE a.presente IS TRUE)::int  AS presentes,
            count(*) FILTER (WHERE a.presente IS FALSE)::int AS ausentes,
            CASE WHEN count(a.sesion_id) = 0 THEN NULL
                 ELSE round(100.0 * count(*) FILTER (WHERE a.presente IS TRUE)
                            / count(a.sesion_id))::int END AS porcentaje
       FROM inscripcion_360 i
       JOIN materia_360 m ON m.id = i.materia_id
       JOIN periodo p ON p.id = i.periodo_id
       JOIN sesion_360 s ON s.materia_360_id = i.materia_id AND s.periodo_id = i.periodo_id
       LEFT JOIN asistencia_360 a ON a.sesion_id = s.id AND a.inscripcion_id = i.id
      WHERE i.estudiante_id = $1
        AND i.estado IN ('prematriculada', 'cursando')
      GROUP BY m.id, m.nombre, p.id, p.nombre, p.fecha_inicio
      ORDER BY p.fecha_inicio DESC, m.nombre`,
    [estudianteId],
  );
}
