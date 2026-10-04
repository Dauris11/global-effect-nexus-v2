import { consultar } from "@/lib/db";

/**
 * Calendario del estudiante: qué le toca y cuándo.
 *
 * Reúne tres orígenes en una sola lista ordenada por día, porque para el
 * estudiante son lo mismo —cosas que pasan en una fecha— y tenerlos en tres
 * tarjetas separadas le obligaría a cruzarlos de cabeza:
 *
 *   · `evento`      — actos institucionales, los mismos que ve todo el mundo.
 *   · `asignacion`  — vencimiento de tareas y exámenes de sus materias activas.
 *   · `solicitud`   — sus propios trámites que tienen fecha: la cita con
 *     administración y el permiso, sobre todo. Los rechazados y cancelados no
 *     salen: en el calendario solo está lo que va a pasar.
 *
 * El día lo compone la base con `to_char`, no Node: es la misma referencia que
 * usa el resto del sistema y así el mes que se pinta no depende de la zona
 * horaria del proceso que renderiza. Por eso los TIMESTAMPTZ de `asignacion`
 * pasan por `to_char` en vez de convertirse a `Date` aquí.
 */

export type EntradaAgenda = {
  origen: "evento" | "asignacion" | "solicitud";
  id: string;
  titulo: string;
  /** Tipo de evento, materia de la asignación o tipo de trámite, según el origen. */
  detalle: string | null;
  /** `YYYY-MM-DD`, ya resuelto en la base. */
  dia: string;
  hora: string | null;
  estado: string;
  ubicacion: string | null;
};

/**
 * Entradas de un mes concreto.
 *
 * `mes` llega como `YYYY-MM` desde la URL y se compara contra el día ya
 * formateado: es una sola comparación de texto por origen, y evita tener que
 * calcular el primer y el último día del mes en tres sitios distintos.
 */
export async function agendaDelEstudiante(
  estudianteId: string,
  mes: string,
): Promise<EntradaAgenda[]> {
  return consultar<EntradaAgenda>(
    `SELECT 'evento' AS origen,
            e.id,
            e.titulo,
            e.tipo AS detalle,
            to_char(e.fecha, 'YYYY-MM-DD') AS dia,
            e.hora_inicio AS hora,
            e.estado,
            e.ubicacion
       FROM evento e
      WHERE e.estado <> 'cancelado'
        AND to_char(e.fecha, 'YYYY-MM') = $2

      UNION ALL

     SELECT 'asignacion' AS origen,
            a.id,
            a.titulo,
            m.nombre AS detalle,
            to_char(a.fecha_vencimiento, 'YYYY-MM-DD') AS dia,
            to_char(a.fecha_vencimiento, 'HH24:MI') AS hora,
            coalesce(en.estado::text, 'pendiente') AS estado,
            NULL AS ubicacion
       FROM asignacion a
       JOIN materia m ON m.id = a.materia_id
       JOIN inscripcion i
         ON i.materia_id = a.materia_id
        AND i.estudiante_id = $1
        AND i.estado = 'activa'
       LEFT JOIN entrega_estudiante en
         ON en.asignacion_id = a.id
        AND en.estudiante_id = $1
      WHERE a.fecha_vencimiento IS NOT NULL
        AND to_char(a.fecha_vencimiento, 'YYYY-MM') = $2

      UNION ALL

     SELECT 'solicitud' AS origen,
            s.id,
            s.titulo,
            s.tipo AS detalle,
            to_char(s.fecha_requerida, 'YYYY-MM-DD') AS dia,
            s.hora_preferida AS hora,
            s.estado,
            NULL AS ubicacion
       FROM solicitud s
      WHERE s.estudiante_id = $1
        AND s.fecha_requerida IS NOT NULL
        AND s.estado NOT IN ('rechazada', 'cancelada')
        AND to_char(s.fecha_requerida, 'YYYY-MM') = $2

      ORDER BY dia, hora NULLS FIRST`,
    [estudianteId, mes],
  );
}

/**
 * Meses que tienen algo, para que el selector solo ofrezca meses con contenido
 * en vez de dejar al estudiante paseando por meses vacíos.
 *
 * Se limita a los 18 más recientes: la lista es un `select`, no un archivo.
 */
export async function mesesConAgenda(estudianteId: string): Promise<string[]> {
  const filas = await consultar<{ mes: string }>(
    `SELECT DISTINCT mes FROM (
       SELECT to_char(fecha, 'YYYY-MM') AS mes
         FROM evento
        WHERE estado <> 'cancelado'

       UNION ALL

       SELECT to_char(a.fecha_vencimiento, 'YYYY-MM') AS mes
         FROM asignacion a
         JOIN inscripcion i
           ON i.materia_id = a.materia_id
          AND i.estudiante_id = $1
          AND i.estado = 'activa'
        WHERE a.fecha_vencimiento IS NOT NULL

       UNION ALL

       SELECT to_char(fecha_requerida, 'YYYY-MM') AS mes
         FROM solicitud
        WHERE estudiante_id = $1
          AND fecha_requerida IS NOT NULL
          AND estado NOT IN ('rechazada', 'cancelada')
     ) AS meses
     ORDER BY mes DESC
     LIMIT 18`,
    [estudianteId],
  );

  return filas.map((fila) => fila.mes);
}
