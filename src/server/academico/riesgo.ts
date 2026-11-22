import { consultar } from "@/lib/db";
import { umbralDeIndice } from "@/server/academico/indice";
import { recordNativoDelEstudiante } from "@/server/universidades/consultas";

export type MotivoRiesgo = "acumulado" | "periodo" | "reprobadas";

export type EstudianteEnRiesgo = {
  id: string;
  nombre: string;
  universidad: string | null;
  carrera: string | null;
  email: string | null;
  telefono: string | null;
  indice: number | null;
  umbralAcumulado: number;
  periodo: string | null;
  indicePeriodo: number | null;
  umbralPeriodo: number;
  reprobadas: number;
  motivos: MotivoRiesgo[];
};

/**
 * Los estudiantes activos que hoy necesitan atención académica, juntos en una lista: índice
 * acumulado o del último período por debajo del mínimo de SU universidad, o materias
 * reprobadas sin volver a cursar. Es la misma regla de las alertas del expediente y del
 * aviso a administración, calculada para todos a la vez. Solo los activos: son los únicos
 * que son parte de la Fundación.
 */
export async function estudiantesEnRiesgo(): Promise<EstudianteEnRiesgo[]> {
  const global = await umbralDeIndice();
  const base = await consultar<{
    id: string;
    nombre: string;
    universidad: string | null;
    carrera: string | null;
    email: string | null;
    telefono: string | null;
    indice: number | null;
    minimo_acumulado: number | null;
    minimo_periodo: number | null;
  }>(
    `SELECT e.id, e.nombre, u.siglas AS universidad, c.nombre AS carrera, e.email::text AS email, e.telefono,
            indice_estudiante(e.id)::float8 AS indice,
            u.indice_minimo_acumulado::float8 AS minimo_acumulado, u.indice_minimo_periodo::float8 AS minimo_periodo
       FROM estudiante e
       LEFT JOIN universidad u ON u.id = e.universidad_id
       LEFT JOIN carrera c ON c.id = e.carrera_id
      WHERE e.estado = 'activo' AND EXISTS (SELECT 1 FROM resultado_materia r WHERE r.estudiante_id = e.id)
      ORDER BY e.nombre`,
  );

  const enRiesgo: EstudianteEnRiesgo[] = [];

  // De a pocos: cada récord son dos consultas y no hay por qué saturar el pool.
  for (let i = 0; i < base.length; i += 8) {
    const lote = await Promise.all(
      base.slice(i, i + 8).map(async (b) => {
        const record = await recordNativoDelEstudiante(b.id);
        const ultimo = record?.periodos[0] ?? null;
        const umbralAcumulado = b.minimo_acumulado ?? global;
        const umbralPeriodo = b.minimo_periodo ?? umbralAcumulado;
        // Reprobada = su intento más reciente de esa materia sigue reprobado.
        const reprobadas = new Set(
          (record?.periodos ?? []).flatMap((p) => p.intentos.filter((x) => x.vigente && x.estado === "reprobada").map((x) => x.codigo)),
        ).size;
        const motivos: MotivoRiesgo[] = [];

        if (b.indice !== null && b.indice < umbralAcumulado) motivos.push("acumulado");
        if (ultimo && ultimo.indice !== null && ultimo.indice < umbralPeriodo) motivos.push("periodo");
        if (reprobadas > 0) motivos.push("reprobadas");

        return motivos.length === 0
          ? null
          : ({
              id: b.id,
              nombre: b.nombre,
              universidad: b.universidad,
              carrera: b.carrera,
              email: b.email,
              telefono: b.telefono,
              indice: b.indice,
              umbralAcumulado,
              periodo: ultimo?.periodo ?? null,
              indicePeriodo: ultimo?.indice ?? null,
              umbralPeriodo,
              reprobadas,
              motivos,
            } satisfies EstudianteEnRiesgo);
      }),
    );

    enRiesgo.push(...lote.filter((x): x is EstudianteEnRiesgo => x !== null));
  }

  // Primero los que están peor: más motivos y, a igualdad, índice más bajo.
  return enRiesgo.sort((a, b) => b.motivos.length - a.motivos.length || (a.indice ?? 99) - (b.indice ?? 99));
}
