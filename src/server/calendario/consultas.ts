import { consultar } from "@/lib/db";
import type { Rol } from "@/lib/rbac";
import { tienePermiso } from "@/lib/rbac";

/**
 * Calendario de las pantallas internas: qué pasa cada día, según quién mira.
 *
 * Tres orígenes en una sola lista ordenada, porque para quien la mira son lo
 * mismo —cosas que caen en una fecha— y tenerlos en tres tarjetas obligaría a
 * cruzarlos de cabeza:
 *
 *   · `evento`     — actos institucionales. Los ve todo el equipo.
 *   · `tarea`      — solo las asignadas a QUIEN mira, con fecha límite.
 *   · `asignacion` — solo si es docente: lo que vence en SUS clases.
 *   · `solicitud`  — las citas que los estudiantes piden a administración,
 *     solo para quien tiene `solicitudes.gestionar`, que es quien las atiende.
 *
 * El día lo compone la base con `to_char`, no Node: así el mes que se pinta no
 * depende de la zona horaria del proceso.
 */

export type EntradaCalendario = {
  origen: "evento" | "tarea" | "asignacion" | "cita" | "reunion";
  id: string;
  titulo: string;
  /** Tipo del evento, proyecto de la tarea o estado de la cita. */
  detalle: string | null;
  /** `YYYY-MM-DD`, ya resuelto en la base. */
  dia: string;
  hora: string | null;
  estado: string;
  ubicacion: string | null;
  hora_fin: string | null;
  descripcion: string | null;
  prioridad: string | null;
};

/**
 * Entradas de la rejilla de un mes, para un usuario concreto.
 *
 * No trae el mes exacto sino la VENTANA que se dibuja: del lunes de la semana
 * del día 1 al domingo de la semana del último día. Son hasta seis días de más
 * por lado, y sin ellos las casillas vecinas de la rejilla y las semanas que
 * cruzan de mes saldrían vacías teniendo cosas anotadas.
 */
export async function calendarioDelMes({
  usuarioId,
  rol,
  mes,
}: {
  usuarioId: string;
  rol: Rol;
  mes: string;
}): Promise<EntradaCalendario[]> {
  const { desde, hasta } = ventanaDeRejilla(mes);

  const institucional = await consultar<EntradaCalendario>(
    `SELECT 'evento' AS origen,
            e.id,
            e.titulo,
            e.tipo AS detalle,
            to_char(e.fecha, 'YYYY-MM-DD') AS dia,
            e.hora_inicio AS hora,
            e.estado,
            e.ubicacion,
            e.hora_fin,
            e.descripcion,
            'media'::text AS prioridad
       FROM evento e
      WHERE e.estado <> 'cancelado'
        AND e.fecha BETWEEN $2::date AND $3::date

      UNION ALL

     SELECT 'tarea' AS origen,
            t.id,
            t.titulo,
            p.nombre AS detalle,
            to_char(t.fecha_limite, 'YYYY-MM-DD') AS dia,
            NULL AS hora,
            t.estado,
            NULL AS ubicacion,
            NULL AS hora_fin,
            t.descripcion,
            COALESCE(t.prioridad, 'media')::text AS prioridad
       FROM tarea t
       JOIN tarea_asignado ta ON ta.tarea_id = t.id
       LEFT JOIN proyecto  p  ON p.id = t.proyecto_id
      WHERE ta.usuario_id = $1
        AND t.fecha_limite IS NOT NULL
        AND t.estado IN ('pendiente', 'en_progreso')
        AND t.fecha_limite BETWEEN $2::date AND $3::date

      ORDER BY dia, hora NULLS FIRST`,
    [usuarioId, desde, hasta],
  );

  const esAdmin = rol === "super_admin" || rol === "admin";
  const reuniones = await consultar<EntradaCalendario>(
    `SELECT 'reunion' AS origen,
            r.id,
            r.titulo,
            r.tipo AS detalle,
            to_char(r.fecha, 'YYYY-MM-DD') AS dia,
            to_char(r.hora_inicio, 'HH24:MI') AS hora,
            r.estado,
            r.lugar_o_enlace AS ubicacion,
            to_char(r.hora_fin, 'HH24:MI') AS hora_fin,
            r.descripcion,
            (CASE WHEN r.estado = 'programada' THEN 'alta' ELSE 'media' END)::text AS prioridad
       FROM reunion r
      WHERE r.estado <> 'cancelada'
        AND r.fecha BETWEEN $2::date AND $3::date
        AND (
          $4::boolean = true
          OR r.organizador_usuario_id = $1
          OR EXISTS (
            SELECT 1 FROM reunion_participante rp
             WHERE rp.reunion_id = r.id AND rp.usuario_id = $1
          )
        )
      ORDER BY r.fecha, r.hora_inicio`,
    [usuarioId, desde, hasta, esAdmin],
  );

  const baseConReuniones = [...institucional, ...reuniones];

  /*
   * LO QUE VENCE EN SUS CLASES, solo para el docente.
   */
  if (rol === "docente") {
    const clases = await consultar<EntradaCalendario>(
      `SELECT 'asignacion' AS origen,
              a.id,
              a.titulo,
              coalesce(mu.nombre, cu.nombre, m3.nombre) AS detalle,
              to_char(a.fecha_vencimiento, 'YYYY-MM-DD') AS dia,
              to_char(a.fecha_vencimiento, 'HH24:MI') AS hora,
              a.tipo::text AS estado,
              NULL AS ubicacion,
              NULL AS hora_fin,
              a.descripcion,
              (CASE WHEN a.tipo = 'examen' THEN 'alta' ELSE 'media' END)::text AS prioridad
         FROM asignacion a
         LEFT JOIN materia     mu ON mu.id = a.materia_id
         LEFT JOIN curso       cu ON cu.id = a.curso_id
         LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
        WHERE a.fecha_vencimiento IS NOT NULL
          AND a.fecha_vencimiento::date BETWEEN $2::date AND $3::date
          AND (mu.profesor_usuario_id = $1
               OR cu.docente_usuario_id = $1
               OR m3.docente_id = $1)
        ORDER BY a.fecha_vencimiento`,
      [usuarioId, desde, hasta],
    );

    return ordenar([...baseConReuniones, ...clases]);
  }

  // Las citas con administración, solo para quien las atiende. Para
  // cualquier otro rol esta consulta no se lanza.
  if (!tienePermiso(rol, "solicitudes.gestionar")) return ordenar(baseConReuniones);

  /*
   * Las citas son solicitudes `cita_administracion` (0031) que siguen vivas:
   * pedidas, en revisión o ya aprobadas.
   */
  const citas = await consultar<EntradaCalendario>(
    `SELECT 'cita' AS origen,
            s.id,
            coalesce(e.nombre, s.titulo) AS titulo,
            s.estado AS detalle,
            to_char(s.fecha_requerida, 'YYYY-MM-DD') AS dia,
            s.hora_preferida AS hora,
            s.estado,
            NULL AS ubicacion,
            NULL AS hora_fin,
            s.titulo || coalesce(' — ' || s.detalle, '') AS descripcion,
            (CASE WHEN s.estado = 'aprobada' THEN 'alta' ELSE 'media' END)::text AS prioridad
       FROM solicitud s
       LEFT JOIN estudiante e ON e.id = s.estudiante_id
      WHERE s.tipo = 'cita_administracion'
        AND s.estado IN ('enviada', 'en_revision', 'aprobada')
        AND s.fecha_requerida BETWEEN $1::date AND $2::date
      ORDER BY s.fecha_requerida, s.hora_preferida NULLS FIRST`,
    [desde, hasta],
  );

  return ordenar([...baseConReuniones, ...citas]);
}

/**
 * Junta dos orígenes ya ordenados en una sola lista por día y hora.
 */
function ordenar(entradas: EntradaCalendario[]): EntradaCalendario[] {
  return entradas.sort((a, b) =>
    a.dia === b.dia
      ? (a.hora ?? "").localeCompare(b.hora ?? "")
      : a.dia.localeCompare(b.dia),
  );
}

/**
 * Meses que tienen algo, para no ofrecer navegación hacia el vacío.
 */
export async function mesesConAlgo(usuarioId: string): Promise<string[]> {
  const filas = await consultar<{ mes: string }>(
    `SELECT DISTINCT to_char(fecha, 'YYYY-MM') AS mes
       FROM evento
      WHERE estado <> 'cancelado'
        AND fecha BETWEEN CURRENT_DATE - 180 AND CURRENT_DATE + 180

      UNION

     SELECT DISTINCT to_char(t.fecha_limite, 'YYYY-MM') AS mes
       FROM tarea t
       JOIN tarea_asignado ta ON ta.tarea_id = t.id
      WHERE ta.usuario_id = $1
        AND t.fecha_limite BETWEEN CURRENT_DATE - 180 AND CURRENT_DATE + 180

      UNION

     SELECT DISTINCT to_char(r.fecha, 'YYYY-MM') AS mes
       FROM reunion r
      WHERE r.estado <> 'cancelada'
        AND r.fecha BETWEEN CURRENT_DATE - 180 AND CURRENT_DATE + 180

      ORDER BY mes`,
    [usuarioId],
  );

  return filas.map((fila) => fila.mes);
}

/**
 * Del lunes de la semana del día 1 al domingo de la semana del último día.
 *
 * Todo con `Date.UTC` y devuelto como `YYYY-MM-DD`: el proceso puede correr en
 * cualquier zona y el día tiene que salir igual. Coincide a propósito con la
 * rejilla del componente, que también empieza en lunes.
 */
function ventanaDeRejilla(mes: string): { desde: string; hasta: string } {
  const [anio, numero] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(anio, numero - 1, 1));
  const ultimo = new Date(Date.UTC(anio, numero, 0));

  const lunes = new Date(primero);
  lunes.setUTCDate(primero.getUTCDate() - ((primero.getUTCDay() + 6) % 7));

  const domingo = new Date(ultimo);
  domingo.setUTCDate(ultimo.getUTCDate() + (6 - ((ultimo.getUTCDay() + 6) % 7)));

  return {
    desde: lunes.toISOString().slice(0, 10),
    hasta: domingo.toISOString().slice(0, 10),
  };
}
