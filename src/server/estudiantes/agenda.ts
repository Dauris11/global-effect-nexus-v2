import { consultar } from "@/lib/db";
import { proyectarClasesEnRango } from "@/lib/horarios";

/**
 * Calendario del estudiante: qué le toca y cuándo.
 *
 * Reúne cinco orígenes en una sola lista ordenada por día, porque para el
 * estudiante son lo mismo —cosas que pasan en una fecha— y tenerlos en tarjetas
 * separadas le obligaría a cruzarlos de cabeza:
 *
 *   · `clase`       — materias inscritas (regulares y 360) proyectadas en sus
 *                     días y horas de cursada durante el período académico.
 *   · `asignacion`  — vencimiento de tareas y exámenes de sus materias activas.
 *   · `reunion`     — citas y reuniones institucionales convocadas con él.
 *   · `evento`      — actos institucionales abiertos a la comunidad.
 *   · `solicitud`   — sus propios trámites que tienen fecha: la cita con
 *                     administración y permisos aprobados/en trámite.
 *
 * Las clases se proyectan a partir de la expresión de horario de cada materia
 * activa y los límites del período lectivo, garantizando que un estudiante solo
 * vea sus propias clases en sus días correspondientes.
 */

export type EntradaAgenda = {
  origen: "evento" | "asignacion" | "solicitud" | "reunion" | "clase";
  id: string;
  titulo: string;
  /** Tipo de evento, materia de la asignación o tipo de trámite, según el origen. */
  detalle: string | null;
  /** `YYYY-MM-DD`, ya resuelto en la base o proyectado según calendario. */
  dia: string;
  hora: string | null;
  estado: string;
  ubicacion: string | null;
};

/**
 * Entradas de un mes concreto.
 *
 * `mes` llega como `YYYY-MM` desde la URL. Se consultan las entradas con fecha
 * fija y se combinan con las clases proyectadas en los días de la semana de ese mes.
 */
export async function agendaDelEstudiante(
  estudianteId: string | null,
  mes: string,
  usuarioId?: string,
): Promise<EntradaAgenda[]> {
  const dummyUuid = "00000000-0000-0000-0000-000000000000";
  const idEst = estudianteId ?? dummyUuid;
  const idUsr = usuarioId ?? dummyUuid;

  const [añoStr, mesStr] = mes.split("-");
  const año = Number(añoStr) || new Date().getFullYear();
  const mesNum = Number(mesStr) || new Date().getMonth() + 1;
  const ultimoDia = new Date(año, mesNum, 0).getDate();
  const desde = `${mes}-01`;
  const hasta = `${mes}-${String(ultimoDia).padStart(2, "0")}`;

  // 1. Clases activas inscritas proyectadas en el mes
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
      WHERE (e.id = $1 OR e.usuario_id = $2)
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
      WHERE (e.id = $1 OR e.usuario_id = $2)
        AND i360.estado IN ('cursando', 'prematriculada')
        AND m360.horario IS NOT NULL`,
    [idEst, idUsr],
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

  const clasesEntradas: EntradaAgenda[] = proyectadas.map((cp) => ({
    origen: "clase",
    id: cp.id,
    titulo: cp.titulo,
    detalle: cp.detalle,
    dia: cp.dia,
    hora: cp.hora,
    estado: "activa",
    ubicacion: cp.ubicacion,
  }));

  // 2. Entradas puntuales (eventos institucionales, tareas/exámenes, citas y reuniones)
  const filasDb = await consultar<EntradaAgenda>(
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
            coalesce(m.nombre, m360.nombre, 'Asignatura') AS detalle,
            to_char(a.fecha_vencimiento, 'YYYY-MM-DD') AS dia,
            to_char(a.fecha_vencimiento, 'HH24:MI') AS hora,
            coalesce(ee.estado::text, 'pendiente') AS estado,
            NULL AS ubicacion
       FROM asignacion a
       LEFT JOIN materia m ON m.id = a.materia_id
       LEFT JOIN materia_360 m360 ON m360.id = a.materia_360_id
       JOIN estudiante e ON (e.id = $1 OR e.usuario_id = $3)
       LEFT JOIN entrega_estudiante ee
         ON ee.asignacion_id = a.id
        AND ee.estudiante_id = e.id
      WHERE a.fecha_vencimiento IS NOT NULL
        AND to_char(a.fecha_vencimiento, 'YYYY-MM') = $2
        AND (
          a.materia_id IN (SELECT i.materia_id FROM inscripcion i WHERE i.estudiante_id = e.id AND i.estado = 'activa')
          OR
          a.materia_360_id IN (SELECT i360.materia_id FROM inscripcion_360 i360 WHERE i360.estudiante_id = e.id AND i360.estado IN ('cursando', 'prematriculada'))
        )

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
      WHERE (s.estudiante_id = $1 OR s.solicitante_id = $3)
        AND s.fecha_requerida IS NOT NULL
        AND s.estado NOT IN ('rechazada', 'cancelada')
        AND to_char(s.fecha_requerida, 'YYYY-MM') = $2

      UNION ALL

     SELECT 'reunion' AS origen,
            r.id,
            r.titulo,
            r.tipo AS detalle,
            to_char(r.fecha, 'YYYY-MM-DD') AS dia,
            to_char(r.hora_inicio, 'HH24:MI') AS hora,
            r.estado,
            r.lugar_o_enlace AS ubicacion
       FROM reunion r
      WHERE r.estado <> 'cancelada'
        AND to_char(r.fecha, 'YYYY-MM') = $2
        AND (
          r.estudiante_id = $1
          OR r.organizador_usuario_id = $3
          OR EXISTS (
            SELECT 1 FROM reunion_participante rp
             WHERE rp.reunion_id = r.id AND (rp.estudiante_id = $1 OR rp.usuario_id = $3)
          )
        )`,
    [idEst, mes, idUsr],
  );

  const todas = [...filasDb, ...clasesEntradas];
  todas.sort((a, b) => {
    const cmpDia = a.dia.localeCompare(b.dia);
    if (cmpDia !== 0) return cmpDia;
    if (!a.hora && !b.hora) return 0;
    if (!a.hora) return -1;
    if (!b.hora) return 1;
    return a.hora.localeCompare(b.hora);
  });

  return todas;
}

/**
 * Meses que tienen algo, para que el selector solo ofrezca meses con contenido
 * en vez de dejar al estudiante paseando por meses vacíos.
 *
 * Incluye meses con eventos institucionales, entregas de asignaciones, citas,
 * reuniones y meses lectivos de materias inscritas.
 */
export async function mesesConAgenda(
  estudianteId: string | null,
  usuarioId?: string,
): Promise<string[]> {
  const dummyUuid = "00000000-0000-0000-0000-000000000000";
  const idEst = estudianteId ?? dummyUuid;
  const idUsr = usuarioId ?? dummyUuid;

  const filas = await consultar<{ mes: string }>(
    `SELECT DISTINCT mes FROM (
       SELECT to_char(fecha, 'YYYY-MM') AS mes
         FROM evento
        WHERE estado <> 'cancelado'

       UNION ALL

       SELECT to_char(a.fecha_vencimiento, 'YYYY-MM') AS mes
         FROM asignacion a
         JOIN estudiante e ON (e.id = $1 OR e.usuario_id = $2)
        WHERE a.fecha_vencimiento IS NOT NULL
          AND (
            a.materia_id IN (SELECT i.materia_id FROM inscripcion i WHERE i.estudiante_id = e.id AND i.estado = 'activa')
            OR
            a.materia_360_id IN (SELECT i360.materia_id FROM inscripcion_360 i360 WHERE i360.estudiante_id = e.id AND i360.estado IN ('cursando', 'prematriculada'))
          )

       UNION ALL

       SELECT to_char(fecha_requerida, 'YYYY-MM') AS mes
         FROM solicitud
        WHERE (estudiante_id = $1 OR solicitante_id = $2)
          AND fecha_requerida IS NOT NULL
          AND estado NOT IN ('rechazada', 'cancelada')

       UNION ALL

       SELECT to_char(fecha, 'YYYY-MM') AS mes
         FROM reunion r
        WHERE r.estado <> 'cancelada'
          AND (
            r.estudiante_id = $1
            OR r.organizador_usuario_id = $2
            OR EXISTS (
              SELECT 1 FROM reunion_participante rp
               WHERE rp.reunion_id = r.id AND (rp.estudiante_id = $1 OR rp.usuario_id = $2)
            )
          )

       UNION ALL

       SELECT DISTINCT to_char(mes_serie, 'YYYY-MM') AS mes
         FROM (
           SELECT p.fecha_inicio, p.fecha_fin
             FROM inscripcion i
             JOIN periodo p ON p.id = i.periodo_id
             JOIN estudiante e ON e.id = i.estudiante_id
            WHERE (e.id = $1 OR e.usuario_id = $2) AND i.estado = 'activa'
           UNION ALL
           SELECT p.fecha_inicio, p.fecha_fin
             FROM inscripcion_360 i360
             JOIN periodo p ON p.id = i360.periodo_id
             JOIN estudiante e ON e.id = i360.estudiante_id
            WHERE (e.id = $1 OR e.usuario_id = $2) AND i360.estado IN ('cursando', 'prematriculada')
         ) periodos_activos,
         generate_series(
           date_trunc('month', fecha_inicio),
           date_trunc('month', fecha_fin),
           '1 month'::interval
         ) AS mes_serie
     ) AS meses
     ORDER BY mes DESC
     LIMIT 18`,
    [idEst, idUsr],
  );

  return filas.map((fila) => fila.mes);
}
