import { consultar } from "@/lib/db";

/**
 * Consultas académicas de las subpáginas del portal del estudiante.
 *
 * Sigue rigiendo la regla de `portal.ts`: aquí no se toca el expediente ni
 * ninguna tabla de perfil, y todo filtra por `estudiante_id` sacado de la
 * sesión.
 *
 * Está separado de `portal.ts` porque ese archivo alimenta el dashboard —una
 * consulta por tarjeta, corta y resumida— mientras estas devuelven el listado
 * completo que pide cada subpágina. Mezclarlas llevaría a que el dashboard
 * arrastre filas que no dibuja.
 */

export type InscripcionDelEstudiante = {
  id: string;
  estado: string;
  materia: string;
  codigo: string | null;
  creditos: number | null;
  horario: string | null;
  aula: string | null;
  profesor: string | null;
  periodo: string;
  periodo_id: string;
  periodo_estado: string;
  /** Inicio del período, para ordenar y fechar el grupo en pantalla. */
  fecha_inicio: string | null;
};

/**
 * Todas las inscripciones del estudiante, no solo las activas.
 *
 * A diferencia de `materiasInscritas`, incluye las retiradas y las cerradas
 * (`aprobada`, `reprobada`): esta pantalla es el registro de su matrícula y
 * esconder lo retirado dejaría un historial que no cuadra con el que ve
 * coordinación.
 */
export async function inscripcionesDelEstudiante(
  estudianteId: string,
): Promise<InscripcionDelEstudiante[]> {
  return consultar<InscripcionDelEstudiante>(
    `SELECT i.id,
            i.estado,
            m.nombre  AS materia,
            m.codigo,
            m.creditos,
            m.horario,
            m.aula,
            m.profesor_nombre AS profesor,
            p.nombre  AS periodo,
            p.id      AS periodo_id,
            p.estado  AS periodo_estado,
            p.fecha_inicio::text AS fecha_inicio
       FROM inscripcion i
       JOIN materia m ON m.id = i.materia_id
       JOIN periodo p ON p.id = i.periodo_id
      WHERE i.estudiante_id = $1
      ORDER BY p.fecha_inicio DESC NULLS LAST, m.nombre`,
    [estudianteId],
  );
}

export type MateriaOfertada = {
  id: string;
  nombre: string;
  codigo: string | null;
  creditos: number | null;
  horario: string | null;
  aula: string | null;
  profesor: string | null;
  /** Si esta estudiante ya la tiene, y en qué estado. `null` si no la tiene. */
  estado_inscripcion: string | null;
};

/**
 * El catálogo de un período, con lo que esta persona ya lleva marcado.
 *
 * Solo materias `activa`: una materia retirada del catálogo no se ofrece,
 * aunque alguien la tuviera inscrita de antes —esa inscripción sigue viva y se
 * ve en la lista de arriba, pero no se vuelve a ofrecer—.
 *
 * `estado_inscripcion` viaja en la misma consulta y no en una segunda: la
 * pantalla necesita las dos cosas a la vez para decidir si cada fila lleva
 * "Inscribirme" o "Quitarme", y con dos consultas habría un instante en que una
 * dice una cosa y la otra ya no.
 */
export async function materiasOfertadas({
  periodoId,
  estudianteId,
}: {
  periodoId: string;
  estudianteId: string;
}): Promise<MateriaOfertada[]> {
  return consultar<MateriaOfertada>(
    `SELECT m.id,
            m.nombre,
            m.codigo,
            m.creditos,
            m.horario,
            m.aula,
            m.profesor_nombre AS profesor,
            (SELECT i.estado
               FROM inscripcion i
              WHERE i.materia_id = m.id
                AND i.estudiante_id = $2
                AND i.periodo_id = $1) AS estado_inscripcion
       FROM materia m
      WHERE m.periodo_id = $1
        AND m.estado = 'activa'
      ORDER BY m.nombre`,
    [periodoId, estudianteId],
  );
}
