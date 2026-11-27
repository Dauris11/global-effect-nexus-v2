import { consultar } from "@/lib/db";

export type EleccionEstudiante = {
  id: string;
  nombre: string;
  /** Tiene al menos una materia (no retirada) en el período de la ventana. */
  eligio: boolean;
  /** Se le puede avisar: tiene cuenta de acceso. */
  puedeAvisarse: boolean;
};

/**
 * Los estudiantes activos y si ya eligieron materia en el período de la ventana: es lo que decide el
 * progreso «9 de 13 eligieron» y a quién se le puede recordar.
 */
export async function eleccionesDeLaVentana(periodoId: string): Promise<EleccionEstudiante[]> {
  return consultar<EleccionEstudiante>(
    `SELECT e.id, e.nombre,
            (EXISTS (SELECT 1 FROM inscripcion_360 i WHERE i.estudiante_id = e.id AND i.periodo_id = $1 AND i.estado <> 'retirada')
             OR EXISTS (SELECT 1 FROM inscripcion n WHERE n.estudiante_id = e.id AND n.periodo_id = $1 AND n.estado <> 'retirada')) AS eligio,
            (e.usuario_id IS NOT NULL) AS "puedeAvisarse"
       FROM estudiante e
      WHERE e.estado = 'activo'
      ORDER BY eligio, e.nombre`,
    [periodoId],
  );
}
