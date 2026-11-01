"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario, type UsuarioSesion } from "@/lib/auth";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  ESTADOS_TAREA_COLABORADOR,
  PRIORIDADES_TAREA,
  type ComentarioTarea,
  type EstadoTareaColaborador,
} from "@/lib/torre-control";

/**
 * Acciones de la torre de control.
 *
 * DOS NIVELES DE MANO. Quien tiene la tarea asignada puede moverla (estado,
 * avance, comentarios): es su trabajo y tiene que poder decir cómo va sin
 * pedírselo a nadie. Lo que cambia el REPARTO —a quién, cuándo, con qué
 * prioridad— es de `operaciones.escribir`, porque reasignarse una tarea o
 * correrse la fecha uno mismo es justo lo que una torre de control vigila.
 */

export type ResultadoTorre = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function puedeCoordinar(usuario: UsuarioSesion): boolean {
  return usuarioTienePermiso(usuario, "operaciones.escribir");
}

/** Asignado o coordinador: la misma regla para avanzar y para comentar. */
async function puedeTocarTarea(usuario: UsuarioSesion, tareaId: string) {
  return consultarUna<{ id: string; titulo: string }>(
    `SELECT t.id, t.titulo FROM tarea t
      WHERE t.id = $1
        AND ($2::boolean OR EXISTS (SELECT 1 FROM tarea_asignado ta
                                     WHERE ta.tarea_id = t.id AND ta.usuario_id = $3))`,
    [tareaId, puedeCoordinar(usuario), usuario.id],
  );
}

/**
 * Cambia el estado o el avance de una tarea, y los mantiene coherentes.
 *
 * Estado y porcentaje dicen lo mismo de dos maneras, así que no se dejan
 * contradecirse: completar pone 100, llegar a 100 completa, y empezar a
 * avanzar algo que estaba "por hacer" lo pasa a "en progreso". Sin esto la
 * torre de administración enseñaría tareas completadas al 25 %.
 */
export async function avanzarTarea(datos: {
  id: string;
  estado?: string;
  progreso?: number;
}): Promise<ResultadoTorre> {
  const usuario = await requerirUsuario();

  if (!UUID.test(datos.id)) return { ok: false, error: "no_encontrado" };

  let estado = datos.estado as EstadoTareaColaborador | undefined;
  let progreso =
    typeof datos.progreso === "number" && Number.isFinite(datos.progreso)
      ? Math.round(Math.min(100, Math.max(0, datos.progreso)))
      : undefined;

  if (estado && !ESTADOS_TAREA_COLABORADOR.includes(estado)) {
    return { ok: false, error: "invalido" };
  }
  if (!estado && progreso === undefined) return { ok: false, error: "invalido" };

  if (estado === "completada") progreso = 100;
  if (!estado && progreso === 100) estado = "completada";

  const tarea = await puedeTocarTarea(usuario, datos.id);
  if (!tarea) return { ok: false, error: "no_permitido" };

  try {
    await enTransaccion(async (cliente) => {
      await cliente.query(
        `UPDATE tarea
            SET estado = CASE
                  WHEN $2::text IS NOT NULL THEN $2::text
                  WHEN $3::int > 0 AND estado IN ('por_hacer', 'pendiente') THEN 'en_progreso'
                  WHEN $3::int < 100 AND estado = 'completada' THEN 'en_progreso'
                  ELSE estado END,
                progreso = coalesce($3::int, progreso)
          WHERE id = $1`,
        [datos.id, estado ?? null, progreso ?? null],
      );
      await cliente.query(
        `UPDATE evento
            SET estado = CASE WHEN t.estado = 'completada' THEN 'completado' ELSE 'programado' END
           FROM tarea t
          WHERE t.id = $1 AND evento.tarea_id = t.id`,
        [datos.id],
      );
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.avance",
      entidad: "tarea",
      entidadId: datos.id,
      datos: { estado: estado ?? null, progreso: progreso ?? null },
    });
  } catch (error) {
    console.error("[torre] no se pudo avanzar la tarea", error);
    return { ok: false, error: "error" };
  }

  refrescar();
  return { ok: true };
}

/** Los comentarios de una tarea, para el panel que se abre desde la fila. */
export async function comentariosDeTarea(
  tareaId: string,
): Promise<ComentarioTarea[] | null> {
  const usuario = await requerirUsuario();
  if (!UUID.test(tareaId)) return null;
  if (!(await puedeTocarTarea(usuario, tareaId))) return null;

  return consultar<ComentarioTarea>(
    `SELECT c.id, u.nombre AS autor, c.texto, c.created_at::text AS creado_en
       FROM tarea_comentario c
       LEFT JOIN usuario u ON u.id = c.usuario_id
      WHERE c.tarea_id = $1
      ORDER BY c.created_at`,
    [tareaId],
  );
}

/**
 * Comenta una tarea y avisa a los demás asignados. Al autor no: ya sabe lo
 * que acaba de escribir.
 */
export async function comentarTarea(datos: {
  id: string;
  texto: string;
}): Promise<ResultadoTorre> {
  const usuario = await requerirUsuario();
  const texto = String(datos.texto ?? "").trim().slice(0, 2000);

  if (!UUID.test(datos.id)) return { ok: false, error: "no_encontrado" };
  if (!texto) return { ok: false, error: "vacio" };

  const tarea = await puedeTocarTarea(usuario, datos.id);
  if (!tarea) return { ok: false, error: "no_permitido" };

  try {
    await enTransaccion(async (cliente) => {
      await cliente.query(
        `INSERT INTO tarea_comentario (tarea_id, usuario_id, texto) VALUES ($1, $2, $3)`,
        [datos.id, usuario.id, texto],
      );
      await cliente.query(
        `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
         SELECT ta.usuario_id, $2, $3, 'tarea', '/administrativo/torre-control'
           FROM tarea_asignado ta
          WHERE ta.tarea_id = $1 AND ta.usuario_id <> $4`,
        [datos.id, tarea.titulo, texto.slice(0, 280), usuario.id],
      );
    });
  } catch (error) {
    console.error("[torre] no se pudo comentar la tarea", error);
    return { ok: false, error: "error" };
  }

  refrescar();
  return { ok: true };
}

/**
 * Edición completa de una tarea desde coordinación: responsables, prioridad,
 * fechas, estado y avance.
 *
 * Los asignados se REEMPLAZAN (es un formulario con la lista entera) y solo
 * se avisa a los que entran nuevos: a quien ya la tenía no le llega un aviso
 * cada vez que alguien corrige una fecha.
 */
export async function editarTareaTorre(datos: FormData): Promise<ResultadoTorre> {
  const usuario = await requerirUsuario();
  if (!puedeCoordinar(usuario)) return { ok: false, error: "no_permitido" };

  const id = String(datos.get("id") ?? "");
  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 160);
  const prioridad = String(datos.get("prioridad") ?? "media");
  const estado = String(datos.get("estado") ?? "por_hacer");
  const inicio = String(datos.get("inicio") ?? "").trim();
  const limite = String(datos.get("limite") ?? "").trim();
  const progreso = Math.round(Math.min(100, Math.max(0, Number(datos.get("progreso") ?? 0) || 0)));
  const horas = Math.max(0, Number(datos.get("horas") ?? 0) || 0);
  const asignados = datos.getAll("asignado").map(String).filter((v) => UUID.test(v));

  if (!UUID.test(id)) return { ok: false, error: "no_encontrado" };
  if (!titulo) return { ok: false, error: "titulo_vacio" };
  if (!PRIORIDADES_TAREA.includes(prioridad as never)) return { ok: false, error: "invalido" };
  if (!ESTADOS_TAREA_COLABORADOR.includes(estado as never)) return { ok: false, error: "invalido" };
  if ((inicio && !FECHA.test(inicio)) || (limite && !FECHA.test(limite))) {
    return { ok: false, error: "invalido" };
  }
  if (inicio && limite && limite < inicio) return { ok: false, error: "fin_antes_de_inicio" };

  const progresoOk = estado === "completada" ? 100 : progreso;

  try {
    const existe = await enTransaccion(async (cliente) => {
      const { rowCount } = await cliente.query(
        `UPDATE tarea
            SET titulo = $2, prioridad = $3, estado = $4,
                fecha_inicio = NULLIF($5, '')::date,
                fecha_limite = NULLIF($6, '')::date,
                progreso = $7, horas_estimadas = $8
          WHERE id = $1`,
        [id, titulo, prioridad, estado, inicio, limite, progresoOk, horas],
      );
      if (!rowCount) return false;

      const { rows: nuevos } = await cliente.query<{ usuario_id: string }>(
        `INSERT INTO tarea_asignado (tarea_id, usuario_id)
         SELECT $1, u.id FROM usuario u
          WHERE u.id = ANY($2::uuid[]) AND u.activo
         ON CONFLICT DO NOTHING
         RETURNING usuario_id`,
        [id, asignados],
      );
      await cliente.query(
        `DELETE FROM tarea_asignado WHERE tarea_id = $1 AND NOT (usuario_id = ANY($2::uuid[]))`,
        [id, asignados],
      );
      if (nuevos.length > 0) {
        await cliente.query(
          `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
           SELECT unnest($1::uuid[]), $2, $2, 'tarea', '/administrativo/torre-control'`,
          [nuevos.map((n) => n.usuario_id), titulo],
        );
      }

      // El calendario sigue a la tarea: misma fecha y mismo estado.
      if (limite) {
        await cliente.query(
          `UPDATE evento SET fecha = $2::date, titulo = $3,
                  estado = CASE WHEN $4 = 'completada' THEN 'completado' ELSE 'programado' END
            WHERE tarea_id = $1`,
          [id, limite, titulo, estado],
        );
      }
      return true;
    });

    if (!existe) return { ok: false, error: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.editada",
      entidad: "tarea",
      entidadId: id,
      datos: { prioridad, estado, limite: limite || null, asignados: asignados.length },
    });
  } catch (error) {
    console.error("[torre] no se pudo editar la tarea", error);
    return { ok: false, error: "error" };
  }

  refrescar();
  return { ok: true };
}

/**
 * Responsable y miembros de un proyecto.
 *
 * El texto `proyecto.responsable` se reescribe con el nombre de la cuenta
 * elegida: lo siguen leyendo el listado de proyectos y los informes, y no
 * debe quedarse diciendo otro nombre.
 */
export async function guardarEquipoProyecto(datos: FormData): Promise<ResultadoTorre> {
  const usuario = await requerirUsuario();
  if (!puedeCoordinar(usuario)) return { ok: false, error: "no_permitido" };

  const proyectoId = String(datos.get("proyecto") ?? "");
  const responsable = String(datos.get("responsable") ?? "");
  const miembros = datos.getAll("miembro").map(String).filter((v) => UUID.test(v));

  if (!UUID.test(proyectoId)) return { ok: false, error: "no_encontrado" };
  if (responsable && !UUID.test(responsable)) return { ok: false, error: "invalido" };
  if (responsable && !miembros.includes(responsable)) miembros.push(responsable);

  try {
    const existe = await enTransaccion(async (cliente) => {
      const { rowCount } = await cliente.query(
        `UPDATE proyecto
            SET responsable_id = NULLIF($2, '')::uuid,
                responsable = CASE WHEN $2 = '' THEN NULL ELSE coalesce(
                  (SELECT nombre FROM usuario WHERE id = NULLIF($2, '')::uuid), responsable) END
          WHERE id = $1`,
        [proyectoId, responsable],
      );
      if (!rowCount) return false;

      const { rows: nuevos } = await cliente.query<{ usuario_id: string }>(
        `INSERT INTO proyecto_miembro (proyecto_id, usuario_id, asignado_por)
         SELECT $1, u.id, $3 FROM usuario u
          WHERE u.id = ANY($2::uuid[]) AND u.activo
         ON CONFLICT DO NOTHING
         RETURNING usuario_id`,
        [proyectoId, miembros, usuario.id],
      );
      await cliente.query(
        `DELETE FROM proyecto_miembro
          WHERE proyecto_id = $1 AND NOT (usuario_id = ANY($2::uuid[]))`,
        [proyectoId, miembros],
      );
      if (nuevos.length > 0) {
        await cliente.query(
          `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
           SELECT unnest($1::uuid[]), p.nombre, p.nombre, 'proyecto',
                  '/administrativo/proyectos/' || p.id
             FROM proyecto p WHERE p.id = $2`,
          [nuevos.map((n) => n.usuario_id), proyectoId],
        );
      }
      return true;
    });

    if (!existe) return { ok: false, error: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "proyecto.equipo",
      entidad: "proyecto",
      entidadId: proyectoId,
      datos: { responsable: responsable || null, miembros: miembros.length },
    });
  } catch (error) {
    console.error("[torre] no se pudo guardar el equipo del proyecto", error);
    return { ok: false, error: "error" };
  }

  refrescar();
  revalidatePath(`/[locale]/administrativo/proyectos/${proyectoId}`, "page");
  return { ok: true };
}

function refrescar() {
  revalidatePath("/[locale]/administrativo/torre-control", "page");
  revalidatePath("/[locale]/administrativo/torre-control/equipo", "page");
  revalidatePath("/[locale]/administrativo/tareas", "page");
  revalidatePath("/[locale]/administrativo/tareas/hoy", "page");
  revalidatePath("/[locale]/administrativo/proyectos", "page");
  revalidatePath("/[locale]/calendario", "page");
}
