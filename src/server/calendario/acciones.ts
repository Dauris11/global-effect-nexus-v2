"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";

/**
 * Escrituras del calendario.
 *
 * Dos clases de entrada y dos reglas distintas, y no se pueden mezclar:
 *
 *   · `evento` — institucional. Lo crea, edita, mueve y borra quien tenga
 *     `operaciones.escribir`. Sale en el calendario de todo el equipo.
 *
 *   · cita con administración — es una `solicitud` (0031). Solo la mueve quien
 *     tenga `solicitudes.gestionar`, y solo mientras siga viva. No se crea ni se
 *     borra desde aquí: para eso está la bandeja de solicitudes, y moverla deja
 *     un paso en su línea de tiempo para que el estudiante vea la hora nueva.
 *
 * Mover algo arrastrándolo es una escritura como cualquier otra: se comprueba el
 * permiso y queda en `audit_log`. Un calendario donde se arrastra sin rastro es
 * un calendario donde nadie sabe quién cambió la reunión.
 */

export type EstadoCalendario = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "solo_lectura"
    | "invalido"
    | "error";
};

const TIPOS = ["academico", "administrativo", "social", "reunion", "otro"];

/** Alta y edición de un evento institucional. Con `id` vacío, es un alta. */
export async function guardarEvento(
  _previo: EstadoCalendario,
  datos: FormData,
): Promise<EstadoCalendario> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 160);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 600);
  const tipo = String(datos.get("tipo") ?? "otro");
  const fecha = String(datos.get("fecha") ?? "");
  const horaInicio = String(datos.get("hora_inicio") ?? "").trim();
  const horaFin = String(datos.get("hora_fin") ?? "").trim();
  const ubicacion = String(datos.get("ubicacion") ?? "").trim().slice(0, 160);

  if (!titulo) return { estado: "invalido" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { estado: "invalido" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };

  // El tipo llega de un desplegable, y un desplegable del navegador se puede
  // manipular: se vuelve a comprobar contra la lista.
  const tipoValido = TIPOS.includes(tipo) ? tipo : "otro";

  try {
    if (id) {
      const editado = await consultarUna<{ id: string }>(
        `UPDATE evento
            SET titulo = $2, descripcion = NULLIF($3, ''), tipo = $4,
                fecha = $5::date, hora_inicio = NULLIF($6, ''),
                hora_fin = NULLIF($7, ''), ubicacion = NULLIF($8, '')
          WHERE id = $1
        RETURNING id`,
        [id, titulo, descripcion, tipoValido, fecha, horaInicio, horaFin, ubicacion],
      );

      if (!editado) return { estado: "no_encontrado" };

      await anotar(usuario.id, "evento.editado", editado.id, { titulo });
    } else {
      const creado = await consultarUna<{ id: string }>(
        `INSERT INTO evento
                (titulo, descripcion, tipo, fecha, hora_inicio, hora_fin, ubicacion, responsable)
         VALUES ($1, NULLIF($2, ''), $3, $4::date, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), $8)
         RETURNING id`,
        [titulo, descripcion, tipoValido, fecha, horaInicio, horaFin, ubicacion, usuario.nombre],
      );

      if (!creado) return { estado: "error" };

      await anotar(usuario.id, "evento.creado", creado.id, { titulo, fecha });
    }
  } catch (error) {
    console.error("[calendario] no se pudo guardar el evento", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Cancela un evento o lo vuelve a programar.
 *
 * Cancelar no borra: el evento queda con estado `cancelado`, que el calendario
 * ya excluye, y se puede revertir. Es lo que el asistente usa para "tachar un
 * evento", porque borrar no tiene vuelta atrás.
 */
export async function cambiarEstadoEvento(
  _previo: EstadoCalendario,
  datos: FormData,
): Promise<EstadoCalendario> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  const estado = String(datos.get("estado") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (estado !== "cancelado" && estado !== "programado") return { estado: "invalido" };

  try {
    const cambiado = await consultarUna<{ id: string }>(
      `UPDATE evento SET estado = $2 WHERE id = $1 AND tarea_id IS NULL RETURNING id`,
      [id, estado],
    );

    // Un evento ligado a una tarea sigue el estado de la tarea: se cambia desde ella.
    if (!cambiado) return { estado: "no_encontrado" };

    await anotar(usuario.id, `evento.${estado}`, cambiado.id);
  } catch (error) {
    console.error("[calendario] no se pudo cambiar el estado del evento", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/** Borra un evento institucional. Las citas no se borran desde aquí. */
export async function eliminarEvento(
  _previo: EstadoCalendario,
  datos: FormData,
): Promise<EstadoCalendario> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrado" };

  const borrado = await consultarUna<{ id: string; titulo: string }>(
    "DELETE FROM evento WHERE id = $1 RETURNING id, titulo",
    [id],
  );

  if (!borrado) return { estado: "no_encontrado" };

  // El título va al registro porque la fila ya no existe para consultarlo.
  await anotar(usuario.id, "evento.eliminado", borrado.id, {
    titulo: borrado.titulo,
  });

  refrescar();

  return { estado: "ok" };
}

/**
 * Mueve una entrada a otro día, y opcionalmente a otra hora.
 *
 * `origen` dice qué se mueve, y cada uno tiene su regla: un evento pide
 * `operaciones.escribir`; una cita, `solicitudes.gestionar`. Una tarea no se mueve desde aquí —su fecha límite la
 * fija quien la asignó— y se responde `solo_lectura` en vez de fallar en
 * silencio.
 *
 * La hora llega solo cuando se suelta en una casilla de las rejillas de semana o
 * de día; en la de mes no hay hora que deducir y se deja la que tenía. Al
 * cambiarla, el evento CONSERVA SU DURACIÓN: se corre la hora de fin el mismo
 * rato que la de inicio, porque una reunión arrastrada de las 9 a las 11 sigue
 * durando lo que duraba. Y el cálculo va en el UPDATE, leyendo la fila vieja, en
 * vez de traerla, restar en Node y volver a escribirla.
 */
export async function moverEntrada(
  _previo: EstadoCalendario,
  datos: FormData,
): Promise<EstadoCalendario> {
  const usuario = await requerirUsuario();

  const origen = String(datos.get("origen") ?? "");
  const id = String(datos.get("id") ?? "");
  const dia = String(datos.get("dia") ?? "");
  const hora = String(datos.get("hora") ?? "").trim();

  if (!esUuid(id) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    return { estado: "invalido" };
  }

  // Una hora con formato raro se descarta en vez de rechazar el movimiento: el
  // día es el dato que se pidió mover, y con `''` el UPDATE deja la hora quieta.
  const horaValida = /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : "";

  try {
    if (origen === "evento") {
      if (!usuarioTienePermiso(usuario, "operaciones.escribir")) {
        return { estado: "no_permitido" };
      }

      const movido = await consultarUna<{ id: string }>(
        `UPDATE evento
            SET fecha = $2::date,
                hora_inicio = COALESCE(NULLIF($3, ''), hora_inicio),
                hora_fin = CASE
                  WHEN NULLIF($3, '') IS NULL THEN hora_fin
                  WHEN hora_inicio IS NULL OR hora_fin IS NULL THEN hora_fin
                  ELSE to_char(
                    $3::time + (hora_fin::time - hora_inicio::time),
                    'HH24:MI'
                  )
                END
          WHERE id = $1
        RETURNING id`,
        [id, dia, horaValida],
      );

      if (!movido) return { estado: "no_encontrado" };

      await anotar(usuario.id, "evento.movido", movido.id, {
        dia,
        hora: horaValida || null,
      });
    } else if (origen === "cita") {
      if (!usuarioTienePermiso(usuario, "solicitudes.gestionar")) {
        return { estado: "no_permitido" };
      }

      // Cambio de fecha, paso en la línea de tiempo y aviso al estudiante: una
      // sola cosa, igual que cualquier paso del flujo de solicitudes.
      const movida = await enTransaccion(async (cliente) => {
        const fila = await cliente.query<{
          id: string;
          folio: number;
          titulo: string;
          estado: string;
          solicitante_id: string | null;
        }>(
          `UPDATE solicitud
              SET fecha_requerida = $2::date,
                  hora_preferida = COALESCE(NULLIF($3, ''), hora_preferida)
            WHERE id = $1
              AND tipo = 'cita_administracion'
              AND estado IN ('enviada', 'en_revision', 'aprobada')
          RETURNING id, folio::int AS folio, titulo, estado, solicitante_id`,
          [id, dia, horaValida],
        );

        const cita = fila.rows[0];
        if (!cita) return null;

        const cuando = [dia, horaValida].filter(Boolean).join(" ");

        await cliente.query(
          `INSERT INTO solicitud_paso
             (solicitud_id, estado_anterior, estado_nuevo, comentario, usuario_id)
           VALUES ($1, $2, $2, $3, $4)`,
          [cita.id, cita.estado, cuando, usuario.id],
        );

        if (cita.solicitante_id) {
          await cliente.query(
            `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
             SELECT u.id, $2, $3, 'solicitud', '/portal/estudiante/solicitudes'
               FROM usuario u
              WHERE u.id = $1 AND u.activo`,
            [cita.solicitante_id, `#${cita.folio} · ${cita.titulo}`, cuando],
          );
        }

        return cita;
      });

      if (!movida) return { estado: "no_encontrado" };

      await registrar({
        usuarioId: usuario.id,
        accion: "cita.movida",
        entidad: "solicitud",
        entidadId: movida.id,
        datos: { dia, hora: horaValida || null },
      });
    } else if (origen === "reunion") {
      const reunion = await consultarUna<{
        id: string;
        organizador_usuario_id: string;
      }>("SELECT id, organizador_usuario_id FROM reunion WHERE id = $1", [id]);

      if (!reunion) return { estado: "no_encontrado" };

      const puedeMover =
        usuarioTienePermiso(usuario, "reuniones.gestionar") ||
        reunion.organizador_usuario_id === usuario.id;

      if (!puedeMover) return { estado: "no_permitido" };

      const movida = await consultarUna<{ id: string }>(
        `UPDATE reunion
            SET fecha = $2::date,
                hora_inicio = COALESCE(NULLIF($3, '')::time, hora_inicio),
                hora_fin = CASE
                  WHEN NULLIF($3, '') IS NULL THEN hora_fin
                  WHEN hora_inicio IS NULL OR hora_fin IS NULL THEN hora_fin
                  ELSE ($3::time + (hora_fin - hora_inicio))
                END,
                actualizado_en = now()
          WHERE id = $1
        RETURNING id`,
        [id, dia, horaValida],
      );

      if (!movida) return { estado: "no_encontrado" };

      await registrar({
        usuarioId: usuario.id,
        accion: "reunion.movida",
        entidad: "reunion",
        entidadId: movida.id,
        datos: { dia, hora: horaValida || null },
      });
    } else {
      return { estado: "solo_lectura" };
    }
  } catch (error) {
    console.error("[calendario] no se pudo mover", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

function anotar(
  usuarioId: string,
  accion: string,
  entidadId: string,
  extra?: Record<string, unknown>,
) {
  return registrar({
    usuarioId,
    accion,
    entidad: "evento",
    entidadId,
    datos: extra,
  });
}

function refrescar() {
  revalidatePath("/[locale]/calendario", "page");
  // El próximo evento sale también en el panel y en la portada pública.
  revalidatePath("/[locale]/bandeja", "page");
  // Una cita movida cambia en la línea de tiempo de su solicitud.
  revalidatePath("/[locale]/administrativo/solicitudes", "page");
  revalidatePath("/[locale]/portal/estudiante/solicitudes", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
