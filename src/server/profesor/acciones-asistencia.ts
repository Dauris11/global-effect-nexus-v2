"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna } from "@/lib/db";
import { esDiaValido } from "@/lib/periodos";
import { usuarioTienePermiso } from "@/lib/rbac";

/**
 * Sesiones y asistencia de las clases de Global Effect 360.
 *
 * DOS PUERTAS con el mismo alcance que las tareas y las notas:
 *
 *   · `academico.escribir` (`admin` y `super_admin`) sobre cualquier clase.
 *   · `docencia.impartir` (`docente` o quien dé clases por excepción) sobre SUS
 *     propias clases (`materia_360.docente_id`), comprobado dentro del SQL.
 *
 * Permitir al docente programar y ajustar sesiones en su propia clase evita que
 * se quede bloqueado al pasar lista si coordinación aún no había pre-creado la
 * fecha del día.
 */

export type EstadoSesion360 =
  | "ok"
  | "no_permitido"
  | "invalido"
  | "fuera_de_periodo"
  | "sin_inscritos"
  | "horas_invalidas"
  | "duplicada"
  | "no_encontrado"
  | "error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const VIOLACION_UNICA = "23505";

export type DatosSesion360 = {
  /** Con `id` es edición: la materia y el período no cambian. */
  id?: string;
  materiaId: string;
  periodoId: string;
  fecha: string;
  horaInicio?: string | null;
  horaFin?: string | null;
};

/** Programa una sesión o edita la fecha y hora de una existente. */
export async function guardarSesion360(
  datos: DatosSesion360,
): Promise<{ estado: EstadoSesion360 }> {
  const usuario = await requerirUsuario();
  const administra = usuarioTienePermiso(usuario, "academico.escribir");
  if (!administra && !usuarioTienePermiso(usuario, "docencia.impartir")) {
    return { estado: "no_permitido" };
  }

  const { id, materiaId, periodoId, fecha } = datos;
  const horaInicio = datos.horaInicio?.trim() || null;
  const horaFin = datos.horaFin?.trim() || null;

  if (!UUID.test(materiaId) || !UUID.test(periodoId) || (id && !UUID.test(id))) {
    return { estado: "invalido" };
  }
  if (!esDiaValido(fecha)) return { estado: "invalido" };
  if ((horaInicio && !HORA.test(horaInicio)) || (horaFin && !HORA.test(horaFin))) {
    return { estado: "horas_invalidas" };
  }
  // Una hora de fin sin inicio no dice nada, y el CHECK de la tabla la dejaría pasar.
  if (horaFin && (!horaInicio || horaFin <= horaInicio)) {
    return { estado: "horas_invalidas" };
  }

  try {
    // Si no tiene permiso global (`academico.escribir`), el propio SELECT exige
    // que `materia_360.docente_id` sea este usuario.
    const contexto = await consultarUna<{ dentro: boolean; inscritos: number }>(
      `SELECT ($3::date BETWEEN p.fecha_inicio AND p.fecha_fin) AS dentro,
              (SELECT count(*)::int FROM inscripcion_360 i
                WHERE i.materia_id = $1 AND i.periodo_id = p.id
                  AND i.estado <> 'retirada') AS inscritos
         FROM periodo p
        WHERE p.id = $2
          AND EXISTS (SELECT 1 FROM materia_360 m
                       WHERE m.id = $1
                         AND ($4::uuid IS NULL OR m.docente_id = $4))`,
      [materiaId, periodoId, fecha, administra ? null : usuario.id],
    );
    if (!contexto) return { estado: "no_encontrado" };
    if (!contexto.dentro) return { estado: "fuera_de_periodo" };
    if (contexto.inscritos === 0) return { estado: "sin_inscritos" };

    let sesionId: string | undefined;

    if (id) {
      const editada = await consultarUna<{ id: string }>(
        `UPDATE sesion_360
            SET fecha = $2::date, hora_inicio = $3::time, hora_fin = $4::time
          WHERE id = $1 AND materia_360_id = $5 AND periodo_id = $6
        RETURNING id`,
        [id, fecha, horaInicio, horaFin, materiaId, periodoId],
      );
      sesionId = editada?.id;
    } else {
      const creada = await consultarUna<{ id: string }>(
        `INSERT INTO sesion_360
           (materia_360_id, periodo_id, fecha, hora_inicio, hora_fin, creado_por)
         VALUES ($1, $2, $3::date, $4::time, $5::time, $6)
         RETURNING id`,
        [materiaId, periodoId, fecha, horaInicio, horaFin, usuario.id],
      );
      sesionId = creada?.id;
    }

    if (!sesionId) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "sesion_360.editada" : "sesion_360.programada",
      entidad: "sesion_360",
      entidadId: sesionId,
      datos: { materia_360_id: materiaId, periodo_id: periodoId, fecha },
    });
  } catch (error) {
    if (esViolacionUnica(error)) return { estado: "duplicada" };
    console.error("[360] no se pudo guardar la sesión", error);
    return { estado: "error" };
  }

  refrescar();
  return { estado: "ok" };
}

/** Borra una sesión. Sus marcas se van con ella (ON DELETE CASCADE). */
export async function borrarSesion360(
  id: string,
): Promise<{ estado: EstadoSesion360 }> {
  const usuario = await requerirUsuario();
  const administra = usuarioTienePermiso(usuario, "academico.escribir");
  if (!administra && !usuarioTienePermiso(usuario, "docencia.impartir")) {
    return { estado: "no_permitido" };
  }
  if (!UUID.test(id)) return { estado: "invalido" };

  try {
    const borrada = await consultarUna<{ id: string }>(
      `DELETE FROM sesion_360 s
        USING materia_360 m
        WHERE s.id = $1
          AND m.id = s.materia_360_id
          AND ($2::uuid IS NULL OR m.docente_id = $2)
        RETURNING s.id`,
      [id, administra ? null : usuario.id],
    );
    if (!borrada) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "sesion_360.borrada",
      entidad: "sesion_360",
      entidadId: borrada.id,
    });
  } catch (error) {
    console.error("[360] no se pudo borrar la sesión", error);
    return { estado: "error" };
  }

  refrescar();
  return { estado: "ok" };
}

/**
 * Marca presente o ausente. Con `inscripcionIds` marca esas; sin ellos marca a
 * TODOS los inscritos de la sesión de una vez.
 *
 * Es idempotente (UPSERT): repetir la misma marca no cambia nada, y marcar al
 * revés la corrige. Solo entran inscripciones del período de la sesión y no
 * retiradas; cualquier otro id se ignora en silencio porque el JOIN no lo
 * encuentra.
 */
export async function marcarAsistencia360(datos: {
  sesionId: string;
  presente: boolean;
  inscripcionIds?: string[];
}): Promise<{ estado: EstadoSesion360 }> {
  const usuario = await requerirUsuario();

  const administra = usuarioTienePermiso(usuario, "academico.escribir");
  if (!administra && !usuarioTienePermiso(usuario, "docencia.impartir")) {
    return { estado: "no_permitido" };
  }

  const { sesionId, presente, inscripcionIds } = datos;
  if (!UUID.test(sesionId) || typeof presente !== "boolean") {
    return { estado: "invalido" };
  }
  if (inscripcionIds && (inscripcionIds.length === 0 || !inscripcionIds.every((x) => UUID.test(x)))) {
    return { estado: "invalido" };
  }

  try {
    const marcadas = await consultar<{ inscripcion_id: string }>(
      `INSERT INTO asistencia_360 (sesion_id, inscripcion_id, presente, marcado_por, marcado_en)
       SELECT s.id, i.id, $2, $3, now()
         FROM sesion_360 s
         JOIN materia_360 m ON m.id = s.materia_360_id
         JOIN inscripcion_360 i
              ON i.materia_id = s.materia_360_id
             AND i.periodo_id = s.periodo_id
        WHERE s.id = $1
          AND i.estado <> 'retirada'
          AND ($4::uuid[] IS NULL OR i.id = ANY($4::uuid[]))
          AND ($5::uuid IS NULL OR m.docente_id = $5)
       ON CONFLICT (sesion_id, inscripcion_id)
       DO UPDATE SET presente = EXCLUDED.presente,
                     marcado_por = EXCLUDED.marcado_por,
                     marcado_en = now()
       RETURNING inscripcion_id`,
      [sesionId, presente, usuario.id, inscripcionIds ?? null, administra ? null : usuario.id],
    );

    if (marcadas.length === 0) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "asistencia_360.marcada",
      entidad: "sesion_360",
      entidadId: sesionId,
      datos: { presente, marcadas: marcadas.length },
    });
  } catch (error) {
    console.error("[360] no se pudo marcar la asistencia", error);
    return { estado: "error" };
  }

  refrescar();
  return { estado: "ok" };
}

function refrescar() {
  revalidatePath("/[locale]/academico/clases-360", "page");
  revalidatePath("/[locale]/portal/profesor", "page");
  revalidatePath("/[locale]/portal/estudiante/global-360", "page");
}

function esViolacionUnica(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === VIOLACION_UNICA
  );
}
