"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna } from "@/lib/db";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { propuestaDeInscripcion } from "@/server/profesor/consultas";

/**
 * Gestión de las clases de Global Effect 360: tareas, revisión de entregas y
 * nota final. Desde la 0047 360 ocupa el lugar de los cursos técnicos.
 *
 * QUIÉN PUEDE. Dos puertas, y las dos valen:
 *
 *   · `academico.escribir` —`admin` y `super_admin`— sobre cualquier clase.
 *   · el rol `docente` sobre SUS clases, comprobado en el propio WHERE con
 *     `materia_360.docente_id`.
 *
 * No basta con mirar el rol: un docente con el id de una clase ajena no debe
 * poder tocarla, así que la condición va dentro de la escritura y no en un `if`
 * previo.
 *
 * El catálogo —crear una materia, retirarla— vive en `/academico/prematricula`
 * con `academico.escribir`. Un docente trabaja en su clase; no toca el programa.
 */

export type EstadoAcademico = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "nombre_vacio"
    | "nota_invalida"
    | "decision_invalida"
    | "invalido"
    | "error";
};

/** Publica una tarea o un examen en una clase de 360. */
export async function publicarTarea(
  _previo: EstadoAcademico,
  datos: FormData,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();

  const puedeTodo = usuarioTienePermiso(usuario, "academico.escribir");

  if (!puedeTodo && !usuarioTienePermiso(usuario, "docencia.impartir")) {
    return { estado: "no_permitido" };
  }

  const materiaId = String(datos.get("materia") ?? "");
  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 160);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 900);
  const tipo = String(datos.get("tipo") ?? "tarea");
  const vence = String(datos.get("vence") ?? "").trim();
  if (vence && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(vence)) {
    return { estado: "invalido" };
  }
  const limiteMb = Math.max(1, Math.min(100, Number(datos.get("limite_mb") || 15)));
  // Solo formatos que la entrega sabe guardar (`FORMATOS_ENTREGA` de
  // moodle/acciones): un `zip` por defecto anunciaba una subida que siempre fallaba.
  const formatosRaw = String(datos.get("formatos_permitidos") || "pdf, docx, jpg, png");
  const formatosPermitidos = formatosRaw
    .split(",")
    .map((f) => f.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);
  const puntajeMaximo = Math.max(1, Math.min(1000, Number(datos.get("puntaje_maximo") || 100)));
  const permiteTardias = datos.get("permite_entregas_tardias") !== "false";
  const instrucciones = String(datos.get("instrucciones_entrega") ?? "").trim().slice(0, 2000);
  const archivoUrl = String(datos.get("archivo_url") ?? "").trim().slice(0, 500);
  const periodoId = String(datos.get("periodo") ?? "");
  const peso = Number(datos.get("peso") || 1);

  if (!titulo) return { estado: "nombre_vacio" };
  if (
    tipo !== "tarea" &&
    tipo !== "examen" &&
    tipo !== "material" &&
    tipo !== "anuncio"
  ) {
    return { estado: "invalido" };
  }
  if (archivoUrl && !/^https?:\/\/\S+$/i.test(archivoUrl)) {
    return { estado: "invalido" };
  }

  if (!esUuid(materiaId) || !esUuid(periodoId)) return { estado: "invalido" };
  // NUMERIC(5,2) admite hasta 999.99; 100 sobra para un peso relativo.
  if (!Number.isFinite(peso) || peso <= 0 || peso > 100) return { estado: "invalido" };

  try {
    /*
     * El INSERT lleva la comprobación de que la clase es de este docente en un
     * SELECT: si no es suya, no hay fila que seleccionar y no se escribe nada.
     * Con el permiso general, la condición se anula.
     */
    const creada = await consultarUna<{ id: string; materia: string }>(
      `INSERT INTO asignacion (
         titulo, descripcion, tipo, materia_360_id, fecha_vencimiento, creada_por_id,
         limite_mb, formatos_permitidos, puntaje_maximo, permite_entregas_tardias, instrucciones_entrega,
         periodo_id, peso, archivo_url
       )
       SELECT $1, NULLIF($2, ''), $3::tipo_asignacion, m.id,
              -- datetime-local no trae zona: la hora es la de La Vega, no UTC.
              NULLIF($4, '')::timestamp AT TIME ZONE 'America/Santo_Domingo', $5,
              $8, $9, $10, $11, NULLIF($12, ''),
              $13, $14, NULLIF($15, '')
         FROM materia_360 m
        WHERE m.id = $6
          AND ($7::uuid IS NULL OR m.docente_id = $7)
          -- Una tarea en un período donde nadie cursa no la vería nadie.
          AND EXISTS (SELECT 1 FROM inscripcion_360 i
                       WHERE i.materia_id = m.id
                         AND i.periodo_id = $13
                         AND i.estado <> 'retirada')
       RETURNING id, (SELECT nombre FROM materia_360 WHERE id = $6) AS materia`,
      [titulo, descripcion, tipo, vence, usuario.id, materiaId,
       puedeTodo ? null : usuario.id, limiteMb, formatosPermitidos, puntajeMaximo, permiteTardias, instrucciones, periodoId, peso, archivoUrl],
    );

    if (!creada) return { estado: "no_encontrado" };

    // Avisa en la campana a todos los estudiantes inscritos en esa clase y período
    // que tengan cuenta activa vinculada.
    await consultar(
      `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
       SELECT DISTINCT u.id, $3, $4, 'tarea', '/portal/estudiante/aula-virtual'
         FROM inscripcion_360 i
         JOIN estudiante e ON e.id = i.estudiante_id
         JOIN usuario u ON u.id = e.usuario_id
        WHERE i.materia_id = $1
          AND i.periodo_id = $2
          AND i.estado IN ('prematriculada', 'cursando')
          AND u.activo
          AND u.id <> $5`,
      [
        materiaId,
        periodoId,
        `${creada.materia} · ${titulo}`,
        descripcion || tipo,
        usuario.id,
      ],
    );

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.publicada",
      entidad: "asignacion",
      entidadId: creada.id,
      datos: { titulo, materia_360_id: materiaId, periodo_id: periodoId, peso },
    });
  } catch (error) {
    console.error("[academico] no se pudo publicar la tarea", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Revisa una entrega: nota y comentario.
 *
 * Deja `revisada_por_id` y `revisada_en` (migración 0028). En un sistema donde
 * la nota decide la beca, quién la puso y cuándo tiene que quedar anotado.
 */
export async function revisarEntrega(
  _previo: EstadoAcademico,
  datos: FormData,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();

  const puedeTodo = usuarioTienePermiso(usuario, "academico.escribir");
  const puedeCalificar = usuarioTienePermiso(usuario, "calificaciones.registrar");

  if (
    !puedeTodo &&
    !puedeCalificar &&
    !usuarioTienePermiso(usuario, "docencia.impartir")
  ) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  const nota = String(datos.get("nota") ?? "").trim();
  const comentario = String(datos.get("comentario") ?? "").trim().slice(0, 900);

  if (!esUuid(id)) return { estado: "no_encontrado" };

  const valor = nota === "" ? null : Number(nota);

  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
    return { estado: "nota_invalida" };
  }

  try {
    /*
     * La entrega tiene que ser de una clase de este docente (las dos vías, en
     * el WHERE) y la nota cabe en la escala de ESA tarea: `puntaje_maximo` va
     * de 1 a 1000, así que el tope ya no es 100. Se lee en la misma consulta
     * para no tener una ventana entre comprobar y escribir; el SELECT final
     * distingue "no es tuya" de "nota fuera de escala".
     */
    const revisada = await consultarUna<{
      id: string;
      maximo: number;
      escrita: boolean;
      estudiante_usuario_id: string | null;
      titulo: string;
      materia: string;
    }>(
      `WITH objetivo AS (
         SELECT d.id,
                coalesce(a.puntaje_maximo, 100) AS maximo,
                est.usuario_id AS estudiante_usuario_id,
                a.titulo,
                coalesce(mu.nombre, m3.nombre, 'Asignatura') AS materia
           FROM entrega_estudiante d
           JOIN asignacion a ON a.id = d.asignacion_id
           JOIN estudiante est ON est.id = d.estudiante_id
           LEFT JOIN materia     mu ON mu.id = a.materia_id
           LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
          WHERE d.id = $1
            AND ($5::uuid IS NULL
                 OR mu.profesor_usuario_id = $5
                 OR m3.docente_id          = $5)
       ), escrita AS (
         UPDATE entrega_estudiante d
            SET estado = CASE WHEN $2::numeric IS NULL THEN d.estado ELSE 'calificado' END,
                calificacion = $2::numeric,
                comentario_profesor = NULLIF($3, ''),
                revisada_por_id = $4,
                revisada_en = now()
           FROM objetivo o
          WHERE d.id = o.id
            AND ($2::numeric IS NULL OR $2::numeric <= o.maximo)
        RETURNING d.id
       )
       SELECT o.id, o.maximo::float8 AS maximo,
              o.estudiante_usuario_id,
              o.titulo,
              o.materia,
              EXISTS (SELECT 1 FROM escrita) AS escrita
         FROM objetivo o`,
      [id, valor, comentario, usuario.id, puedeTodo ? null : usuario.id],
    );

    if (!revisada) return { estado: "no_encontrado" };
    if (!revisada.escrita) return { estado: "nota_invalida" };

    // Avisa al estudiante cuando el docente registra nota o comentario en su entrega.
    if (
      revisada.estudiante_usuario_id &&
      revisada.estudiante_usuario_id !== usuario.id &&
      (valor !== null || Boolean(comentario))
    ) {
      const resumenNota = valor !== null ? `${valor}/${revisada.maximo}` : "";
      const mensajeAviso = [resumenNota, comentario].filter(Boolean).join(" — ");
      await consultar(
        `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
         SELECT u.id, $2, $3, 'tarea', '/portal/estudiante/aula-virtual'
           FROM usuario u
          WHERE u.id = $1 AND u.activo`,
        [
          revisada.estudiante_usuario_id,
          `${revisada.materia} · ${revisada.titulo}`,
          mensajeAviso,
        ],
      );
    }

    await registrar({
      usuarioId: usuario.id,
      accion: "entrega.revisada",
      entidad: "entrega_estudiante",
      entidadId: revisada.id,
      // La nota sí, el comentario no: es una devolución a una persona, no un
      // dato de auditoría, y duplicarlo multiplica de dónde se puede filtrar.
      datos: { nota: valor },
    });
  } catch (error) {
    console.error("[academico] no se pudo revisar la entrega", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Nota final de un estudiante en una clase de 360.
 *
 * Es lo que cierra la materia: con la nota, la inscripción pasa a `aprobada` o
 * `reprobada`, y `aprobada` es lo que cuenta como "materia dada" en el avance
 * del programa. Borrar la nota la devuelve a `cursando`.
 *
 * Pide `calificaciones.registrar` —`docente` y `super_admin`— o
 * `docencia.impartir`, y no `academico.escribir`: coordinación monta el
 * programa pero no pone notas, y eso está así en `rbac.ts` a propósito. Quien
 * da una clase por permiso (un profesor de Habitudes) la cierra igual que un
 * docente: sin esto podía poner tareas y revisarlas pero nunca la nota final.
 * Fuera de `academico.escribir`, siempre solo en sus clases.
 */
export async function calificarInscripcion360(
  _previo: EstadoAcademico,
  datos: FormData,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();

  if (
    !usuarioTienePermiso(usuario, "calificaciones.registrar") &&
    !usuarioTienePermiso(usuario, "docencia.impartir")
  ) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  const nota = String(datos.get("nota") ?? "").trim();
  const decision = String(datos.get("decision") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrado" };

  const valor = nota === "" ? null : Number(nota);

  if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor > 100)) {
    return { estado: "nota_invalida" };
  }

  // Sin nota no hay decisión; con nota hace falta que alguien la tome. El
  // umbral solo SUGIERE en la pantalla: aprobar o reprobar es del profesor.
  if (valor !== null && decision !== "aprobada" && decision !== "reprobada") {
    return { estado: "decision_invalida" };
  }

  const estado = valor === null ? "cursando" : decision;

  try {
    const propuesta = await propuestaDeInscripcion(id);

    // Una inscripción retirada no se califica: el estudiante no terminó la clase.
    const calificada = await consultarUna<{
      id: string;
      materia: string;
      estudiante_usuario_id: string | null;
    }>(
      `UPDATE inscripcion_360 i
          SET nota = $2::numeric, estado = $3,
              decidida_por = CASE WHEN $2::numeric IS NULL THEN NULL ELSE $5::uuid END,
              decidida_en  = CASE WHEN $2::numeric IS NULL THEN NULL ELSE now() END
         FROM materia_360 m, estudiante e
        WHERE i.id = $1
          AND m.id = i.materia_id
          AND e.id = i.estudiante_id
          AND i.estado <> 'retirada'
          AND ($4::uuid IS NULL OR m.docente_id = $4)
      RETURNING i.id, m.nombre AS materia, e.usuario_id AS estudiante_usuario_id`,
      // Sin filtro solo quien administra lo académico. Antes dependía de tener
      // `docencia.impartir`: quitárselo a una persona la dejaba calificando
      // cualquier clase en vez de ninguna.
      [id, valor, estado, usuarioTienePermiso(usuario, "academico.escribir") ? null : usuario.id, usuario.id],
    );

    if (!calificada) return { estado: "no_encontrado" };

    // Avisa al estudiante cuando se cierra su nota final de Global Effect 360.
    if (
      valor !== null &&
      calificada.estudiante_usuario_id &&
      calificada.estudiante_usuario_id !== usuario.id
    ) {
      await consultar(
        `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
         SELECT u.id, $2, $3, 'info', '/portal/estudiante/calificaciones'
           FROM usuario u
          WHERE u.id = $1 AND u.activo`,
        [
          calificada.estudiante_usuario_id,
          calificada.materia,
          `${valor}/100 · ${estado}`,
        ],
      );
    }

    await registrar({
      usuarioId: usuario.id,
      accion: "inscripcion_360.calificada",
      entidad: "inscripcion_360",
      entidadId: calificada.id,
      // Si la nota no es la propuesta, queda constancia de que se anuló.
      datos:
        valor !== null && (propuesta === null || Math.abs(valor - propuesta) > 0.005)
          ? { nota: valor, estado, propuesta }
          : { nota: valor, estado },
    });
  } catch (error) {
    console.error("[academico] no se pudo calificar la inscripción de 360", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Elimina una asignación (tarea, examen, material o anuncio) de una clase de
 * Global Effect 360.
 *
 * Respeta el mismo alcance que `publicarTarea`: `academico.escribir` puede
 * borrar sobre cualquier clase, y quien tiene `docencia.impartir` solo sobre
 * las clases donde `materia_360.docente_id = usuario.id`.
 */
export async function borrarAsignacion360(
  id: string,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();
  const puedeTodo = usuarioTienePermiso(usuario, "academico.escribir");

  if (!puedeTodo && !usuarioTienePermiso(usuario, "docencia.impartir")) {
    return { estado: "no_permitido" };
  }

  if (!esUuid(id)) return { estado: "invalido" };

  try {
    const borrada = await consultarUna<{
      id: string;
      titulo: string;
      materia_360_id: string | null;
    }>(
      `DELETE FROM asignacion a
        USING materia_360 m
        WHERE a.id = $1
          AND m.id = a.materia_360_id
          AND ($2::uuid IS NULL OR m.docente_id = $2)
        RETURNING a.id, a.titulo, a.materia_360_id`,
      [id, puedeTodo ? null : usuario.id],
    );

    if (!borrada) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.borrada",
      entidad: "asignacion",
      entidadId: borrada.id,
      datos: {
        titulo: borrada.titulo,
        materia_360_id: borrada.materia_360_id,
      },
    });
  } catch (error) {
    console.error("[academico] no se pudo borrar la asignación de 360", error);
    return { estado: "error" };
  }

  refrescar();
  return { estado: "ok" };
}

function refrescar() {
  revalidatePath("/[locale]/academico/clases-360", "page");
  revalidatePath("/[locale]/portal/profesor", "page");
  revalidatePath("/[locale]/portal/estudiante/global-360", "page");
  revalidatePath("/[locale]/portal/estudiante/aula-virtual", "page");
  revalidatePath("/[locale]/portal/estudiante/calificaciones", "page");
  revalidatePath("/[locale]/portal/estudiante", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
