import { consultar, consultarUna } from "@/lib/db";

export type CargaFila = {
  id: string;
  orden: number;
  matricula: string | null;
  nombre_leido: string | null;
  codigo_leido: string | null;
  materia_leida: string | null;
  letra: string | null;
  nota: string | null;
  confianza: number | null;
  estudiante_id: string | null;
  estudiante_nombre: string | null;
  codigo: string | null;
  materia: string | null;
  emparejado_por: "matricula" | "nombre" | "manual" | null;
  problemas: string[];
};

export type CargaDetalle = {
  id: string;
  anio: number;
  ronda: number;
  medio: "pdf" | "imagen" | "lista";
  estado: "borrador" | "confirmada" | "descartada";
  escritas: number | null;
  universidad: { id: string; siglas: string; nombre: string };
  filas: CargaFila[];
};

export const universidadesParaCarga = () =>
  consultar<{ id: string; siglas: string; nombre: string; regimen: string }>(
    `SELECT id, siglas, nombre, regimen FROM universidad WHERE activa ORDER BY siglas`,
  );

export async function cargaPorId(id: string): Promise<CargaDetalle | null> {
  const c = await consultarUna<{ id: string; anio: number; ronda: number; medio: CargaDetalle["medio"]; estado: CargaDetalle["estado"]; escritas: number | null; uid: string; siglas: string; unombre: string }>(
    `SELECT c.id, c.anio, c.ronda, c.medio, c.estado, c.escritas, u.id AS uid, u.siglas, u.nombre AS unombre
       FROM carga_calificaciones c JOIN universidad u ON u.id = c.universidad_id WHERE c.id = $1`,
    [id],
  );

  if (!c) return null;

  const filas = await consultar<CargaFila>(
    `SELECT f.id, f.orden, f.matricula, f.nombre_leido, f.codigo_leido, f.materia_leida, f.letra, f.nota::text AS nota, f.confianza,
            f.estudiante_id, e.nombre AS estudiante_nombre, f.codigo, pm.nombre AS materia, f.emparejado_por, f.problemas
       FROM carga_calificaciones_fila f
       LEFT JOIN estudiante e ON e.id = f.estudiante_id
       LEFT JOIN pensum_materia pm ON pm.pensum_id = e.pensum_id AND pm.codigo = f.codigo
      WHERE f.carga_id = $1 ORDER BY f.orden`,
    [id],
  );

  return { id: c.id, anio: c.anio, ronda: c.ronda, medio: c.medio, estado: c.estado, escritas: c.escritas, universidad: { id: c.uid, siglas: c.siglas, nombre: c.unombre }, filas };
}

/** Estudiantes de la universidad entre los que se elige a mano. */
export const estudiantesDeUniversidad = (universidadId: string) =>
  consultar<{ id: string; nombre: string; matricula: string | null }>(
    `SELECT id, nombre, matricula FROM estudiante WHERE universidad_id = $1 ORDER BY nombre`,
    [universidadId],
  );

export const cargasRecientes = () =>
  consultar<{ id: string; anio: number; ronda: number; estado: string; siglas: string; filas: number; created_at: string }>(
    `SELECT c.id, c.anio, c.ronda, c.estado, u.siglas, c.created_at::text,
            (SELECT count(*)::int FROM carga_calificaciones_fila f WHERE f.carga_id = c.id) AS filas
       FROM carga_calificaciones c JOIN universidad u ON u.id = c.universidad_id
      WHERE c.estado <> 'descartada' ORDER BY c.created_at DESC LIMIT 8`,
  );
