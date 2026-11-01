import { consultar } from "@/lib/db";

/**
 * Aula virtual del estudiante (tablas `asignacion` y `entrega_estudiante` de la
 * migración 0021).
 *
 * Es de solo lectura, y no por falta de tiempo: subir la entrega necesita el
 * bucket de Supabase Storage, que es trabajo del sprint S5 junto con el flujo
 * OCR → Expediente. Mientras no exista, la pantalla muestra el estado que el
 * docente registra desde su portal —pendiente, entregado, calificado, tarde— sin
 * ofrecer un botón que no guardaría el archivo en ningún sitio.
 *
 * `comentario_profesor` sí se muestra: es la devolución escrita para él. Lo que
 * no se trae es nada de otros estudiantes: el JOIN con `entrega_estudiante` va
 * atado a `$1` en la propia condición del LEFT JOIN, no en el WHERE, para que
 * una asignación sin entrega siga apareciendo en vez de desaparecer de la lista.
 */

export type AsignacionDelEstudiante = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: "tarea" | "examen" | "material" | "anuncio";
  archivo_url: string | null;
  /**
   * Los TIMESTAMPTZ llegan como `Date`, sin pasar por texto: `pg` ya los
   * convierte y `fechas.ts` acepta ambos. Las columnas DATE sí se piden como
   * texto en el resto del proyecto, porque ahí convertir a `Date` puede correr
   * el día según la zona del proceso.
   */
  fecha_publicacion: Date;
  fecha_vencimiento: Date | null;
  materia: string;
  materia_codigo: string | null;
  docente_nombre?: string | null;
  /** `null` cuando el docente aún no ha abierto una fila de entrega. */
  estado_entrega: "pendiente" | "entregado" | "calificado" | "tarde" | null;
  fecha_entrega: Date | null;
  calificacion: number | null;
  comentario_profesor: string | null;
  /** Lo calcula la base: vencida y sin entregar. */
  vencida: boolean;
  // Campos Moodle
  limite_mb?: number;
  formatos_permitidos?: string[];
  puntaje_maximo?: number;
  permite_entregas_tardias?: boolean;
  instrucciones_entrega?: string | null;
  entrega_id?: string | null;
  entrega_archivo_nombre?: string | null;
  entrega_archivo_tamano_mb?: number | null;
  entrega_archivo_formato?: string | null;
  entrega_comentario_estudiante?: string | null;
};

/**
 * Asignaciones de las materias en las que el estudiante está inscrito ahora.
 *
 * Una tarea cuelga de una materia universitaria o de una de Global Effect
 * 360, exactamente de una (CHECK `asignacion_una_sola_unidad`, 0047): no hay
 * tareas sueltas que repartir a todo el mundo.
 */
export async function asignacionesDelEstudiante(
  estudianteId: string | null,
): Promise<AsignacionDelEstudiante[]> {
  if (!estudianteId) return [];
  return consultar<AsignacionDelEstudiante>(
    `SELECT a.id,
            a.titulo,
            a.descripcion,
            a.tipo::text AS tipo,
            a.archivo_url,
            a.fecha_publicacion,
            a.fecha_vencimiento,
            coalesce(m.nombre, m360.nombre, 'Asignatura') AS materia,
            coalesce(m.codigo, m360.codigo) AS materia_codigo,
            doc.nombre AS docente_nombre,
            coalesce(e.estado::text, 'pendiente') AS estado_entrega,
            e.fecha_entrega,
            e.calificacion::float8 AS calificacion,
            e.comentario_profesor,
            (a.fecha_vencimiento IS NOT NULL
             AND a.fecha_vencimiento < now()
             AND coalesce(e.estado::text, 'pendiente') = 'pendiente') AS vencida,
            coalesce(a.limite_mb, 15)::int AS limite_mb,
            coalesce(a.formatos_permitidos, ARRAY['pdf', 'docx', 'zip'])::text[] AS formatos_permitidos,
            coalesce(a.puntaje_maximo, 100.00)::float8 AS puntaje_maximo,
            coalesce(a.permite_entregas_tardias, true) AS permite_entregas_tardias,
            a.instrucciones_entrega,
            e.id AS entrega_id,
            e.archivo_nombre AS entrega_archivo_nombre,
            e.archivo_tamano_mb::float8 AS entrega_archivo_tamano_mb,
            e.archivo_formato AS entrega_archivo_formato,
            e.comentario_estudiante AS entrega_comentario_estudiante
       FROM asignacion a
       LEFT JOIN materia m ON m.id = a.materia_id
       LEFT JOIN materia_360 m360 ON m360.id = a.materia_360_id
       LEFT JOIN usuario doc ON doc.id = a.creada_por_id
       LEFT JOIN entrega_estudiante e
         ON e.asignacion_id = a.id
        AND e.estudiante_id = $1
      WHERE (
        a.materia_id IN (
          SELECT i.materia_id FROM inscripcion i
           WHERE i.estudiante_id = $1 AND i.estado = 'activa'
        )
        OR
        a.materia_360_id IN (
          SELECT i360.materia_id FROM inscripcion_360 i360
           WHERE i360.estudiante_id = $1 AND i360.estado IN ('cursando', 'prematriculada')
        )
      )
      ORDER BY a.fecha_vencimiento ASC NULLS LAST, a.fecha_publicacion DESC`,
    [estudianteId],
  );
}
