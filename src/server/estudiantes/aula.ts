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
  /** `null` cuando el docente aún no ha abierto una fila de entrega. */
  estado_entrega: "pendiente" | "entregado" | "calificado" | "tarde" | null;
  fecha_entrega: Date | null;
  calificacion: number | null;
  comentario_profesor: string | null;
  /** Lo calcula la base: vencida y sin entregar. */
  vencida: boolean;
};

/**
 * Asignaciones de las materias en las que el estudiante está inscrito ahora.
 *
 * Solo `inscripcion.estado = 'activa'`: las tareas de una materia que retiró
 * ya no son suyas, y las de un período cerrado solo servirían para llenar la
 * pantalla de pendientes imposibles de entregar.
 */
export async function asignacionesDelEstudiante(
  estudianteId: string,
): Promise<AsignacionDelEstudiante[]> {
  return consultar<AsignacionDelEstudiante>(
    `SELECT a.id,
            a.titulo,
            a.descripcion,
            a.tipo::text AS tipo,
            a.archivo_url,
            a.fecha_publicacion,
            a.fecha_vencimiento,
            m.nombre AS materia,
            m.codigo AS materia_codigo,
            e.estado::text AS estado_entrega,
            e.fecha_entrega,
            e.calificacion::float8 AS calificacion,
            e.comentario_profesor,
            (a.fecha_vencimiento IS NOT NULL
             AND a.fecha_vencimiento < now()
             AND coalesce(e.estado::text, 'pendiente') = 'pendiente') AS vencida
       FROM asignacion a
       JOIN materia m ON m.id = a.materia_id
       JOIN inscripcion i
         ON i.materia_id = a.materia_id
        AND i.estudiante_id = $1
        AND i.estado = 'activa'
       LEFT JOIN entrega_estudiante e
         ON e.asignacion_id = a.id
        AND e.estudiante_id = $1
      ORDER BY a.fecha_vencimiento ASC NULLS LAST, a.fecha_publicacion DESC`,
    [estudianteId],
  );
}
