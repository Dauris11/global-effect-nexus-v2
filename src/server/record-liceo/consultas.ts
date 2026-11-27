import { consultar, consultarUna } from "@/lib/db";
import type { GradoLiceo } from "@/lib/record-liceo";

/**
 * Lectura del récord de secundaria de un estudiante: lo confirmado, el borrador
 * pendiente de revisar y las fotos. Solo valores y tipos; el cálculo de promedios
 * vive en `src/lib/record-liceo.ts`.
 */

export type FotoRecord = { id: string; nombre: string; mime: string; pendiente: boolean; created_at: string };

export type RecordLiceoDelEstudiante = {
  existe: boolean;
  confirmadoAt: string | null;
  confirmadoPor: string | null;
  /** Lo confirmado, en el mismo formato que el editor. */
  grados: GradoLiceo[];
  /** Lo leído o escrito que aún no se confirma; `null` si no hay. */
  borrador: GradoLiceo[] | null;
  fotos: FotoRecord[];
  promedioGlobal: number | null;
  promedioAnual: number | null;
};

type FilaGrado = { id: string; grado: number; anio_inicio: number; centro: string };
type FilaNota = { grado_id: string; materia: string; es_modulo: boolean; nota: number };

export async function recordLiceoDe(estudianteId: string): Promise<RecordLiceoDelEstudiante> {
  const cabecera = await consultarUna<{ id: string; borrador: GradoLiceo[] | null; confirmado_at: string | null; confirmado_por: string | null; global: number | null; anual: number | null }>(
    `SELECT r.id, r.borrador, r.confirmado_at::text AS confirmado_at, u.nombre AS confirmado_por,
            e.promedio_secundaria::float8 AS global, e.promedio_secundaria_anual::float8 AS anual
       FROM estudiante e
       LEFT JOIN record_liceo r ON r.estudiante_id = e.id
       LEFT JOIN usuario u ON u.id = r.confirmado_por
      WHERE e.id = $1`,
    [estudianteId],
  );

  if (!cabecera?.id) {
    return { existe: false, confirmadoAt: null, confirmadoPor: null, grados: [], borrador: null, fotos: [], promedioGlobal: cabecera?.global ?? null, promedioAnual: cabecera?.anual ?? null };
  }

  const [grados, notas, fotos] = await Promise.all([
    consultar<FilaGrado>(`SELECT id, grado, anio_inicio, centro FROM record_liceo_grado WHERE record_id = $1 ORDER BY grado, anio_inicio`, [cabecera.id]),
    consultar<FilaNota>(
      `SELECT n.grado_id, n.materia, n.es_modulo, n.nota::float8 AS nota
         FROM record_liceo_nota n JOIN record_liceo_grado g ON g.id = n.grado_id
        WHERE g.record_id = $1 ORDER BY n.grado_id, n.orden`,
      [cabecera.id],
    ),
    consultar<FotoRecord>(
      `SELECT id, nombre, mime, pendiente, created_at::text AS created_at FROM archivo_academico WHERE record_liceo_id = $1 ORDER BY created_at`,
      [cabecera.id],
    ),
  ]);

  return {
    existe: true,
    confirmadoAt: cabecera.confirmado_at,
    confirmadoPor: cabecera.confirmado_por,
    grados: grados.map((g) => ({
      grado: g.grado,
      anioInicio: g.anio_inicio,
      centro: g.centro,
      notas: notas.filter((n) => n.grado_id === g.id).map((n) => ({ materia: n.materia, esModulo: n.es_modulo, nota: n.nota })),
    })),
    borrador: Array.isArray(cabecera.borrador) ? cabecera.borrador : null,
    fotos,
    promedioGlobal: cabecera.global,
    promedioAnual: cabecera.anual,
  };
}
