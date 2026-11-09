import { consultar } from "@/lib/db";
import { proyectarClasesEnRango } from "@/lib/horarios";
import type { Rol } from "@/lib/rbac";

/**
 * Calendario de las pantallas internas: qué pasa cada día, según quién mira.
 *
 * Tres orígenes en una sola lista ordenada, porque para quien la mira son lo
 * mismo —cosas que caen en una fecha— y tenerlos en tres tarjetas obligaría a
 * cruzarlos de cabeza:
 *
 *   · `evento`     — actos institucionales. Los ve todo el equipo.
 *   · `tarea`      — solo las asignadas a QUIEN mira, con fecha límite.
 *   · `asignacion` — tareas y exámenes que vencen en sus materias.
 *   · `clase`      — clases regulares proyectadas en sus días de semana según horario.
 *   · `cita`       — citas agendadas por ese usuario (o atendidas por el personal).
 *   · `reunion`    — reuniones donde el usuario es organizador o participante convocado.
 *
 * El día lo compone la base con `to_char`, no Node: así el mes que se pinta no
 * depende de la zona horaria del proceso.
 */

export type EntradaCalendario = {
  origen: "evento" | "tarea" | "asignacion" | "cita" | "reunion" | "clase";
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
  /** Solo en las reuniones: decide si quien mira puede moverla. */
  organizador_id?: string | null;
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
  imparteDocencia,
  atiendeCitas,
  mes,
}: {
  usuarioId: string;
  rol: Rol;
  /** `docencia.impartir`: ve sus clases aunque su rol no sea `docente`. */
  imparteDocencia: boolean;
  /** `solicitudes.gestionar`: atiende las citas de los demás. */
  atiendeCitas: boolean;
  mes: string;
}): Promise<EntradaCalendario[]> {
  const { desde, hasta } = ventanaDeRejilla(mes);

  // 1. Eventos institucionales (públicos de la Fundación) y tareas asignadas a este usuario
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
        AND t.estado IN ('por_hacer', 'en_progreso', 'en_revision')
        AND t.fecha_limite BETWEEN $2::date AND $3::date

      ORDER BY dia, hora NULLS FIRST`,
    [usuarioId, desde, hasta],
  );

  // 2. Reuniones institucionales:
  // Administradores supervisan la agenda general.
  // Demás roles (estudiantes, docentes) ven ÚNICAMENTE donde están convocados o son anfitriones.
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
            (CASE WHEN r.estado = 'programada' THEN 'alta' ELSE 'media' END)::text AS prioridad,
            r.organizador_usuario_id AS organizador_id
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
          OR EXISTS (
            SELECT 1 FROM estudiante e
             WHERE e.usuario_id = $1
               AND (r.estudiante_id = e.id OR EXISTS (
                 SELECT 1 FROM reunion_participante rpe WHERE rpe.reunion_id = r.id AND rpe.estudiante_id = e.id
               ))
          )
        )
      ORDER BY r.fecha, r.hora_inicio`,
    [usuarioId, desde, hasta, esAdmin],
  );

  const baseConReuniones = [...institucional, ...reuniones];

  // 3. Clases y asignaciones del Estudiante
  let clasesYAsignacionesEstudiante: EntradaCalendario[] = [];
  if (rol === "estudiante") {
    // A. Clases inscritas proyectadas en sus días de la semana durante el cuatrimestre
    const clasesRows = await consultar<{
      id: string;
      nombre: string;
      codigo: string | null;
      horario: string | null;
      aula: string | null;
      profesor: string | null;
      fecha_inicio: string;
      fecha_fin: string;
    }>(
      `SELECT m.id, m.nombre, m.codigo, m.horario, m.aula, m.profesor_nombre AS profesor,
              p.fecha_inicio::text AS fecha_inicio, p.fecha_fin::text AS fecha_fin
         FROM inscripcion i
         JOIN materia m ON m.id = i.materia_id
         JOIN periodo p ON p.id = i.periodo_id
         JOIN estudiante e ON e.id = i.estudiante_id
        WHERE e.usuario_id = $1
          AND i.estado = 'activa'
          AND m.horario IS NOT NULL

        UNION ALL

       SELECT m360.id, m360.nombre, m360.codigo, m360.horario, m360.aula, u.nombre AS profesor,
              p.fecha_inicio::text AS fecha_inicio, p.fecha_fin::text AS fecha_fin
         FROM inscripcion_360 i360
         JOIN materia_360 m360 ON m360.id = i360.materia_id
         JOIN periodo p ON p.id = i360.periodo_id
         JOIN estudiante e ON e.id = i360.estudiante_id
         LEFT JOIN usuario u ON u.id = m360.docente_id
        WHERE e.usuario_id = $1
          AND i360.estado IN ('cursando', 'prematriculada')
          AND m360.horario IS NOT NULL`,
      [usuarioId],
    );

    const proyectadas = proyectarClasesEnRango({
      clases: clasesRows.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        codigo: c.codigo,
        horario: c.horario,
        aula: c.aula,
        profesor: c.profesor,
        fechaInicio: c.fecha_inicio,
        fechaFin: c.fecha_fin,
      })),
      desde,
      hasta,
    });

    const entradasClases: EntradaCalendario[] = proyectadas.map((cp) => ({
      origen: "clase",
      id: cp.id,
      titulo: cp.titulo,
      detalle: cp.detalle,
      dia: cp.dia,
      hora: cp.hora,
      hora_fin: cp.horaFin,
      estado: "activa",
      ubicacion: cp.ubicacion,
      descripcion: null,
      prioridad: "media",
    }));

    // B. Asignaciones que vencen en sus materias inscritas
    const asignacionesEstudiante = await consultar<EntradaCalendario>(
      `SELECT 'asignacion' AS origen,
              a.id,
              a.titulo,
              coalesce(m.nombre, m360.nombre, 'Asignatura') AS detalle,
              to_char(a.fecha_vencimiento, 'YYYY-MM-DD') AS dia,
              to_char(a.fecha_vencimiento, 'HH24:MI') AS hora,
              coalesce(ee.estado::text, 'pendiente') AS estado,
              NULL AS ubicacion,
              NULL AS hora_fin,
              a.descripcion,
              (CASE WHEN a.tipo = 'examen' THEN 'alta' ELSE 'media' END)::text AS prioridad
         FROM asignacion a
         LEFT JOIN materia m ON m.id = a.materia_id
         LEFT JOIN materia_360 m360 ON m360.id = a.materia_360_id
         JOIN estudiante e ON e.usuario_id = $1
         LEFT JOIN entrega_estudiante ee
           ON ee.asignacion_id = a.id
          AND ee.estudiante_id = e.id
        WHERE a.fecha_vencimiento IS NOT NULL
          AND a.fecha_vencimiento::date BETWEEN $2::date AND $3::date
          AND (
            a.materia_id IN (SELECT i.materia_id FROM inscripcion i WHERE i.estudiante_id = e.id AND i.estado = 'activa')
            OR
            -- Una tarea con período solo es de las inscripciones de ESE período
            -- (nula = anterior a la 0069, visible para todas).
            EXISTS (SELECT 1 FROM inscripcion_360 i360
                     WHERE i360.materia_id = a.materia_360_id
                       AND i360.estudiante_id = e.id
                       AND i360.estado IN ('cursando', 'prematriculada')
                       AND (a.periodo_id IS NULL OR a.periodo_id = i360.periodo_id))
          )
        ORDER BY a.fecha_vencimiento`,
      [usuarioId, desde, hasta],
    );

    clasesYAsignacionesEstudiante = [...entradasClases, ...asignacionesEstudiante];
  }

  // 4. Clases y asignaciones del Docente
  let clasesYAsignacionesDocente: EntradaCalendario[] = [];
  if (imparteDocencia) {
    const clasesDocenteRows = await consultar<{
      id: string;
      nombre: string;
      codigo: string | null;
      horario: string | null;
      aula: string | null;
      fecha_inicio: string;
      fecha_fin: string;
    }>(
      `SELECT m.id, m.nombre, m.codigo, m.horario, m.aula,
              p.fecha_inicio::text AS fecha_inicio, p.fecha_fin::text AS fecha_fin
         FROM materia m
         JOIN periodo p ON p.id = m.periodo_id
        WHERE m.profesor_usuario_id = $1
          AND m.estado = 'activa'
          AND m.horario IS NOT NULL

        UNION ALL

       SELECT m360.id, m360.nombre, m360.codigo, m360.horario, m360.aula,
              p.fecha_inicio::text AS fecha_inicio, p.fecha_fin::text AS fecha_fin
         FROM materia_360 m360
         JOIN periodo p ON p.estado = 'activo'
        WHERE m360.docente_id = $1
          AND m360.activa = true
          AND m360.horario IS NOT NULL`,
      [usuarioId],
    );

    const proyectadasDoc = proyectarClasesEnRango({
      clases: clasesDocenteRows.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        codigo: c.codigo,
        horario: c.horario,
        aula: c.aula,
        profesor: null,
        fechaInicio: c.fecha_inicio,
        fechaFin: c.fecha_fin,
      })),
      desde,
      hasta,
    });

    const entradasClasesDoc: EntradaCalendario[] = proyectadasDoc.map((cp) => ({
      origen: "clase",
      id: cp.id,
      titulo: cp.titulo,
      detalle: cp.detalle,
      dia: cp.dia,
      hora: cp.hora,
      hora_fin: cp.horaFin,
      estado: "activa",
      ubicacion: cp.ubicacion,
      descripcion: null,
      prioridad: "media",
    }));

    const asignacionesDocente = await consultar<EntradaCalendario>(
      `SELECT 'asignacion' AS origen,
              a.id,
              a.titulo,
              coalesce(mu.nombre, m3.nombre) AS detalle,
              to_char(a.fecha_vencimiento, 'YYYY-MM-DD') AS dia,
              to_char(a.fecha_vencimiento, 'HH24:MI') AS hora,
              a.tipo::text AS estado,
              NULL AS ubicacion,
              NULL AS hora_fin,
              a.descripcion,
              (CASE WHEN a.tipo = 'examen' THEN 'alta' ELSE 'media' END)::text AS prioridad
         FROM asignacion a
         LEFT JOIN materia     mu ON mu.id = a.materia_id
         LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
        WHERE a.fecha_vencimiento IS NOT NULL
          AND a.fecha_vencimiento::date BETWEEN $2::date AND $3::date
          AND (mu.profesor_usuario_id = $1
               OR m3.docente_id = $1)
        ORDER BY a.fecha_vencimiento`,
      [usuarioId, desde, hasta],
    );

    clasesYAsignacionesDocente = [...entradasClasesDoc, ...asignacionesDocente];
  }

  // 5. Citas con administración:
  // Personal con 'solicitudes.gestionar' atiende las citas solicitadas.
  // Demás usuarios ven EXCLUSIVAMENTE SUS PROPIAS CITAS / SOLICITUDES con fecha.
  let citas: EntradaCalendario[] = [];
  if (atiendeCitas) {
    citas = await consultar<EntradaCalendario>(
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
  } else {
    citas = await consultar<EntradaCalendario>(
      `SELECT 'cita' AS origen,
              s.id,
              s.titulo,
              s.tipo AS detalle,
              to_char(s.fecha_requerida, 'YYYY-MM-DD') AS dia,
              s.hora_preferida AS hora,
              s.estado,
              NULL AS ubicacion,
              NULL AS hora_fin,
              s.titulo || coalesce(' — ' || s.detalle, '') AS descripcion,
              (CASE WHEN s.estado = 'aprobada' THEN 'alta' ELSE 'media' END)::text AS prioridad
         FROM solicitud s
         LEFT JOIN estudiante e ON e.usuario_id = $1
        WHERE (s.solicitante_id = $1 OR (e.id IS NOT NULL AND s.estudiante_id = e.id))
          AND s.fecha_requerida IS NOT NULL
          AND s.estado NOT IN ('rechazada', 'cancelada')
          AND s.fecha_requerida BETWEEN $2::date AND $3::date
        ORDER BY s.fecha_requerida, s.hora_preferida NULLS FIRST`,
      [usuarioId, desde, hasta],
    );
  }

  return ordenar([
    ...baseConReuniones,
    ...clasesYAsignacionesEstudiante,
    ...clasesYAsignacionesDocente,
    ...citas,
  ]);
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
