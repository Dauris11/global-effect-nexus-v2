import { consultar, consultarUna } from "@/lib/db";
import type {
  CandidatoParticipante,
  MetricasReuniones,
  Reunion,
  ReunionParticipante,
} from "@/lib/reuniones";
import type { Rol } from "@/lib/rbac";

/**
 * Métricas globales del módulo de reuniones institucionales.
 */
export async function metricasReuniones(): Promise<MetricasReuniones> {
  const metrica = await consultarUna<{
    total_reuniones: string;
    programadas: string;
    realizadas_mes: string;
    total_participantes: string;
  }>(
    `SELECT
       count(*)::text AS total_reuniones,
       count(*) FILTER (WHERE estado = 'programada')::text AS programadas,
       count(*) FILTER (
         WHERE estado = 'realizada'
           AND to_char(fecha, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
       )::text AS realizadas_mes,
       (SELECT count(*)::text FROM reunion_participante) AS total_participantes
     FROM reunion`
  );

  return {
    total_reuniones: Number(metrica?.total_reuniones ?? 0),
    programadas: Number(metrica?.programadas ?? 0),
    realizadas_mes: Number(metrica?.realizadas_mes ?? 0),
    total_participantes: Number(metrica?.total_participantes ?? 0),
  };
}

/**
 * Lista las reuniones según el usuario y su rol.
 *
 * Los administradores y super_admins ven todas las reuniones de la Fundación.
 * Los demás roles (docentes, contabilidad, Habitudes, estudiantes) ven las
 * reuniones donde son organizadores o están convocados como participantes.
 */
export async function listarReuniones({
  usuarioId,
  rol,
  estudianteId,
  mes,
}: {
  usuarioId: string;
  rol: Rol;
  estudianteId?: string | null;
  mes?: string;
}): Promise<Reunion[]> {
  const esAdmin = rol === "super_admin" || rol === "admin";

  let sql = `
    SELECT
      r.id,
      r.folio,
      r.titulo,
      r.descripcion,
      r.tipo,
      r.modalidad,
      r.lugar_o_enlace,
      to_char(r.fecha, 'YYYY-MM-DD') AS fecha,
      to_char(r.hora_inicio, 'HH24:MI') AS hora_inicio,
      to_char(r.hora_fin, 'HH24:MI') AS hora_fin,
      r.organizador_usuario_id,
      uo.nombre AS organizador_nombre,
      uo.email AS organizador_email,
      r.estudiante_id,
      e.nombre AS estudiante_nombre,
      r.estado,
      r.conclusiones_o_minuta,
      to_char(r.creado_en, 'YYYY-MM-DD HH24:MI') AS creado_en,
      to_char(r.actualizado_en, 'YYYY-MM-DD HH24:MI') AS actualizado_en
    FROM reunion r
    JOIN usuario uo ON uo.id = r.organizador_usuario_id
    LEFT JOIN estudiante e ON e.id = r.estudiante_id
    WHERE 1=1
  `;

  const parametros: unknown[] = [];

  if (mes) {
    parametros.push(mes);
    sql += ` AND to_char(r.fecha, 'YYYY-MM') = $${parametros.length}`;
  }

  if (!esAdmin) {
    parametros.push(usuarioId);
    const posUsuario = parametros.length;

    if (estudianteId) {
      parametros.push(estudianteId);
      const posEst = parametros.length;
      sql += ` AND (
        r.organizador_usuario_id = $${posUsuario}
        OR r.estudiante_id = $${posEst}
        OR EXISTS (
          SELECT 1 FROM reunion_participante rp
          WHERE rp.reunion_id = r.id
            AND (rp.usuario_id = $${posUsuario} OR rp.estudiante_id = $${posEst})
        )
      )`;
    } else {
      sql += ` AND (
        r.organizador_usuario_id = $${posUsuario}
        OR EXISTS (
          SELECT 1 FROM reunion_participante rp
          WHERE rp.reunion_id = r.id AND rp.usuario_id = $${posUsuario}
        )
      )`;
    }
  }

  sql += ` ORDER BY r.fecha DESC, r.hora_inicio DESC LIMIT 100`;

  const filas = await consultar<Reunion>(sql, parametros);
  if (filas.length === 0) return [];

  const reunionIds = filas.map((f) => f.id);
  const participantes = await consultar<ReunionParticipante>(
    `SELECT
       rp.id,
       rp.reunion_id,
       rp.usuario_id,
       rp.estudiante_id,
       rp.rol_en_reunion,
       rp.asistencia,
       rp.nota,
       coalesce(u.nombre, e.nombre, 'Sin nombre') AS nombre,
       coalesce(u.email, e.email, '') AS email,
       CASE WHEN rp.usuario_id IS NOT NULL THEN 'personal' ELSE 'estudiante' END AS tipo_participante
     FROM reunion_participante rp
     LEFT JOIN usuario u ON u.id = rp.usuario_id
     LEFT JOIN estudiante e ON e.id = rp.estudiante_id
     WHERE rp.reunion_id = ANY($1::uuid[])
     ORDER BY rp.rol_en_reunion ASC`,
    [reunionIds]
  );

  const participantesPorReunion = new Map<string, ReunionParticipante[]>();
  for (const p of participantes) {
    const arr = participantesPorReunion.get(p.reunion_id) ?? [];
    arr.push(p);
    participantesPorReunion.set(p.reunion_id, arr);
  }

  return filas.map((r) => ({
    ...r,
    participantes: participantesPorReunion.get(r.id) ?? [],
  }));
}

/**
 * Obtiene el detalle de una reunión por su identificador.
 */
export async function obtenerReunion(id: string): Promise<Reunion | null> {
  const reunion = await consultarUna<Reunion>(
    `SELECT
      r.id,
      r.folio,
      r.titulo,
      r.descripcion,
      r.tipo,
      r.modalidad,
      r.lugar_o_enlace,
      to_char(r.fecha, 'YYYY-MM-DD') AS fecha,
      to_char(r.hora_inicio, 'HH24:MI') AS hora_inicio,
      to_char(r.hora_fin, 'HH24:MI') AS hora_fin,
      r.organizador_usuario_id,
      uo.nombre AS organizador_nombre,
      uo.email AS organizador_email,
      r.estudiante_id,
      e.nombre AS estudiante_nombre,
      r.estado,
      r.conclusiones_o_minuta,
      to_char(r.creado_en, 'YYYY-MM-DD HH24:MI') AS creado_en,
      to_char(r.actualizado_en, 'YYYY-MM-DD HH24:MI') AS actualizado_en
    FROM reunion r
    JOIN usuario uo ON uo.id = r.organizador_usuario_id
    LEFT JOIN estudiante e ON e.id = r.estudiante_id
    WHERE r.id = $1`,
    [id]
  );

  if (!reunion) return null;

  const participantes = await consultar<ReunionParticipante>(
    `SELECT
       rp.id,
       rp.reunion_id,
       rp.usuario_id,
       rp.estudiante_id,
       rp.rol_en_reunion,
       rp.asistencia,
       rp.nota,
       coalesce(u.nombre, e.nombre, 'Sin nombre') AS nombre,
       coalesce(u.email, e.email, '') AS email,
       CASE WHEN rp.usuario_id IS NOT NULL THEN 'personal' ELSE 'estudiante' END AS tipo_participante
     FROM reunion_participante rp
     LEFT JOIN usuario u ON u.id = rp.usuario_id
     LEFT JOIN estudiante e ON e.id = rp.estudiante_id
     WHERE rp.reunion_id = $1
     ORDER BY rp.rol_en_reunion ASC`,
    [id]
  );

  return {
    ...reunion,
    participantes,
  };
}

/**
 * Lista usuarios y estudiantes seleccionables para convocar a reuniones.
 */
export async function listarCandidatosParticipantes(): Promise<CandidatoParticipante[]> {
  const [personal, estudiantes] = await Promise.all([
    consultar<{ id: string; nombre: string; email: string; rol: string }>(
      `SELECT u.id, u.nombre, u.email, coalesce(r.nombre, 'personal') AS rol
       FROM usuario u
       LEFT JOIN rol r ON r.id = u.rol_id
       WHERE u.activo = true
       ORDER BY u.nombre ASC`
    ),
    consultar<{ id: string; nombre: string; email: string }>(
      `SELECT id, nombre, coalesce(email, '') AS email
       FROM estudiante
       WHERE estado IN ('activo', 'academia_liderazgo', 'postulado', 'standby_tecnico')
       ORDER BY nombre ASC LIMIT 200`
    ),
  ]);

  const listaPersonal: CandidatoParticipante[] = personal.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    email: p.email,
    tipo: "personal",
    detalle_rol: p.rol,
  }));

  const listaEstudiantes: CandidatoParticipante[] = estudiantes.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    email: e.email,
    tipo: "estudiante",
    detalle_rol: "Estudiante",
  }));

  return [...listaPersonal, ...listaEstudiantes];
}
