"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { tienePermiso } from "@/lib/rbac";

/**
 * Operaciones: crear tareas, moverlas por el tablero y gestionar proyectos.
 *
 * UNA TAREA NUEVA TOCA CUATRO TABLAS Y ES UNA SOLA COSA. Crear la tarea, decir
 * quién la lleva, ponerla en el calendario y avisar a esa gente no son cuatro
 * operaciones que casualmente van juntas: es una. Si la tarea se crea y el
 * aviso no, alguien tiene trabajo asignado y no se ha enterado; si el evento no
 * entra, la tarea no aparece en el calendario donde todo el mundo la busca. Por
 * eso va en `enTransaccion()`: o entran las cuatro o no entra ninguna.
 *
 * EL AVISO ES DENTRO DEL SISTEMA, NO POR CORREO. La copia que había escrita
 * decía "se avisa por correo a cada asignado", y este proyecto **no tiene
 * ninguna infraestructura de correo** —ni nodemailer, ni Resend, ni SMTP
 * configurado—. Prometer un correo que nunca sale es peor que no prometer
 * nada: alguien deja de avisar por WhatsApp porque cree que el sistema ya lo
 * hizo. Se escribe en `notificacion`, que es la tabla que existe para esto y
 * que hasta ahora estaba creada y sin usar, y el texto se corrigió para decir
 * lo que de verdad pasa.
 *
 * El evento del calendario solo se crea si la tarea tiene fecha límite:
 * `evento.fecha` es NOT NULL, y una tarea sin fecha no tiene día en el que
 * ponerse.
 */

export type EstadoOperaciones = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "titulo_vacio"
    | "nombre_vacio"
    | "fin_antes_de_inicio"
    | "invalido"
    | "error";
};

const PRIORIDADES = ["baja", "media", "alta", "urgente"];
const VISIBILIDADES = ["todos", "asignados"];
const ESTADOS_TAREA = [
  "por_hacer",
  "pendiente",
  "en_progreso",
  "en_revision",
  "completada",
];
const ESTADOS_PROYECTO = ["planificacion", "en_curso", "completado", "pausado"];

/**
 * Crea una tarea con sus asignados, su evento de calendario y sus avisos.
 *
 * Los asignados llegan como varios campos `asignado` del mismo formulario
 * (`getAll`), que es lo que manda un grupo de casillas sin una línea de
 * JavaScript. Se comprueban contra `usuario` dentro de la transacción: un id
 * inventado en el navegador no debe crear una fila en `tarea_asignado`.
 */
export async function crearTarea(
  _previo: EstadoOperaciones,
  datos: FormData,
): Promise<EstadoOperaciones> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 160);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 900);
  const proyectoId = String(datos.get("proyecto") ?? "").trim();
  const prioridad = String(datos.get("prioridad") ?? "media");
  const visibilidad = String(datos.get("visibilidad") ?? "asignados");
  const limite = String(datos.get("limite") ?? "").trim();

  const asignados = datos
    .getAll("asignado")
    .map((valor) => String(valor))
    .filter(esUuid);

  if (!titulo) return { estado: "titulo_vacio" };
  if (proyectoId && !esUuid(proyectoId)) return { estado: "invalido" };

  const prioridadOk = PRIORIDADES.includes(prioridad) ? prioridad : "media";
  const visibilidadOk = VISIBILIDADES.includes(visibilidad)
    ? visibilidad
    : "asignados";

  try {
    const creada = await enTransaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO tarea
                (titulo, descripcion, proyecto_id, visibilidad, prioridad, fecha_limite)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, '')::uuid, $4, $5, NULLIF($6, '')::date)
         RETURNING id`,
        [titulo, descripcion, proyectoId, visibilidadOk, prioridadOk, limite],
      );

      const tareaId = rows[0]?.id;

      if (!tareaId) throw new Error("la tarea no devolvió id");

      if (asignados.length > 0) {
        /*
         * `SELECT ... FROM usuario WHERE id = ANY($2) AND activo` en vez de un
         * INSERT con la lista tal cual: así un id que no existe, o el de una
         * cuenta desactivada, simplemente no produce fila. Sin esto, un
         * formulario manipulado dejaría asignaciones apuntando a nadie.
         */
        await cliente.query(
          `INSERT INTO tarea_asignado (tarea_id, usuario_id)
           SELECT $1, u.id FROM usuario u
            WHERE u.id = ANY($2::uuid[]) AND u.activo
           ON CONFLICT DO NOTHING`,
          [tareaId, asignados],
        );

        // Un aviso por persona, con el enlace al tablero. `notificacion`
        // llevaba creada desde la 0009 sin que nadie escribiera en ella.
        await cliente.query(
          `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
           SELECT u.id, $2, $3, 'tarea', '/administrativo/tareas'
             FROM usuario u
            WHERE u.id = ANY($1::uuid[]) AND u.activo`,
          [asignados, titulo, descripcion || titulo],
        );
      }

      // El evento solo si hay fecha: `evento.fecha` es NOT NULL y una tarea sin
      // fecha límite no tiene día en el calendario.
      if (limite) {
        await cliente.query(
          `INSERT INTO evento (titulo, descripcion, tipo, fecha, estado, tarea_id)
           VALUES ($1, NULLIF($2, ''), 'administrativo', $3::date, 'programado', $4)`,
          [titulo, descripcion, limite, tareaId],
        );
      }

      return tareaId;
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.creada",
      entidad: "tarea",
      entidadId: creada,
      datos: { titulo, asignados: asignados.length, prioridad: prioridadOk },
    });
  } catch (error) {
    console.error("[operaciones] no se pudo crear la tarea", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Mueve una tarea de columna.
 *
 * Es la acción del arrastre, y también la del menú de la tarjeta: la misma
 * escritura para las dos formas de hacerlo, porque arrastrar no es una
 * operación distinta de elegir el estado — es otra manera de decir lo mismo, y
 * quien navegue con teclado tiene que poder hacerla.
 *
 * El evento asociado se mueve con ella si cambia a completada: se marca
 * `completado` para que el calendario no siga anunciando algo ya hecho.
 */
export async function moverTarea(
  _previo: EstadoOperaciones,
  datos: FormData,
): Promise<EstadoOperaciones> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  const estado = String(datos.get("estado") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (!ESTADOS_TAREA.includes(estado)) return { estado: "invalido" };

  try {
    const movida = await enTransaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string; titulo: string }>(
        `UPDATE tarea SET estado = $2 WHERE id = $1 RETURNING id, titulo`,
        [id, estado],
      );

      if (rows.length === 0) return null;

      await cliente.query(
        `UPDATE evento
            SET estado = CASE WHEN $2 = 'completada' THEN 'completado' ELSE 'programado' END
          WHERE tarea_id = $1`,
        [id, estado],
      );

      return rows[0];
    });

    if (!movida) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.movida",
      entidad: "tarea",
      entidadId: movida.id,
      datos: { estado },
    });
  } catch (error) {
    console.error("[operaciones] no se pudo mover la tarea", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Cambia la fecha límite de una tarea y la de su evento de calendario.
 *
 * Es la acción de "reprogramar": la fecha de la tarea y la del evento tienen
 * que moverse juntas o el calendario y el Gantt dirían cosas distintas. Se
 * puede dejar la fecha vacía para quitarla; el evento se conserva con su día.
 */
export async function reprogramarTarea(
  _previo: EstadoOperaciones,
  datos: FormData,
): Promise<EstadoOperaciones> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  const fecha = String(datos.get("fecha") ?? "").trim();

  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { estado: "invalido" };

  try {
    const movida = await enTransaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `UPDATE tarea SET fecha_limite = $2::date WHERE id = $1 RETURNING id`,
        [id, fecha],
      );

      if (rows.length === 0) return null;

      await cliente.query(`UPDATE evento SET fecha = $2::date WHERE tarea_id = $1`, [
        id,
        fecha,
      ]);

      return rows[0];
    });

    if (!movida) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.reprogramada",
      entidad: "tarea",
      entidadId: movida.id,
      datos: { fecha },
    });
  } catch (error) {
    console.error("[operaciones] no se pudo reprogramar la tarea", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/** Alta y edición de un proyecto. Con `id` vacío, es un alta. */
export async function guardarProyecto(
  _previo: EstadoOperaciones,
  datos: FormData,
): Promise<EstadoOperaciones> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "operaciones.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 160);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 900);
  const responsable = String(datos.get("responsable") ?? "").trim().slice(0, 120);
  const estado = String(datos.get("estado") ?? "planificacion");
  const inicio = String(datos.get("inicio") ?? "").trim();
  const fin = String(datos.get("fin") ?? "").trim();

  if (!nombre) return { estado: "nombre_vacio" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };

  // Las dos fechas son opcionales, pero si están las dos tienen que tener
  // sentido. Un proyecto que termina antes de empezar rompe el Gantt y no
  // significa nada.
  if (inicio && fin && fin < inicio) return { estado: "fin_antes_de_inicio" };

  const estadoOk = ESTADOS_PROYECTO.includes(estado) ? estado : "planificacion";

  try {
    const guardado = id
      ? await consultarUna<{ id: string }>(
          `UPDATE proyecto
              SET nombre = $2, descripcion = NULLIF($3, ''),
                  responsable = NULLIF($4, ''), estado = $5,
                  fecha_inicio = NULLIF($6, '')::date,
                  fecha_fin    = NULLIF($7, '')::date
            WHERE id = $1
          RETURNING id`,
          [id, nombre, descripcion, responsable, estadoOk, inicio, fin],
        )
      : await consultarUna<{ id: string }>(
          `INSERT INTO proyecto
                  (nombre, descripcion, responsable, estado, fecha_inicio, fecha_fin)
           VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4,
                   NULLIF($5, '')::date, NULLIF($6, '')::date)
           RETURNING id`,
          [nombre, descripcion, responsable, estadoOk, inicio, fin],
        );

    if (!guardado) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "proyecto.editado" : "proyecto.creado",
      entidad: "proyecto",
      entidadId: guardado.id,
      datos: { nombre, estado: estadoOk },
    });
  } catch (error) {
    console.error("[operaciones] no se pudo guardar el proyecto", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Lo que cambia al tocar una tarea o un proyecto.
 *
 * El calendario y el panel entran en la lista porque los dos leen `tarea` y
 * `evento`: una tarea nueva con fecha aparece en los dos al momento, y si no se
 * refrescan, el usuario la crea y no la ve donde la va a buscar.
 */
function refrescar() {
  revalidatePath("/[locale]/administrativo/tareas", "page");
  revalidatePath("/[locale]/administrativo/proyectos", "page");
  revalidatePath("/[locale]/calendario", "page");
  revalidatePath("/[locale]/calendario/gantt", "page");
  revalidatePath("/[locale]/dashboard", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
