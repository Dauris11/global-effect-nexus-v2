"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { NOTA_APROBADA } from "@/lib/notas";
import { tienePermiso } from "@/lib/rbac";

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
    | "invalido"
    | "error";
};

/** Publica una tarea o un examen en una clase de 360. */
export async function publicarTarea(
  _previo: EstadoAcademico,
  datos: FormData,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();

  const puedeTodo = tienePermiso(usuario.rol, "academico.escribir");

  if (!puedeTodo && usuario.rol !== "docente") {
    return { estado: "no_permitido" };
  }

  const materiaId = String(datos.get("materia") ?? "");
  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 160);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 900);
  const tipo = String(datos.get("tipo") ?? "tarea");
  const vence = String(datos.get("vence") ?? "").trim();
  const limiteMb = Math.max(1, Math.min(100, Number(datos.get("limite_mb") || 15)));
  const formatosRaw = String(datos.get("formatos_permitidos") || "pdf, docx, zip");
  const formatosPermitidos = formatosRaw
    .split(",")
    .map((f) => f.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);
  const puntajeMaximo = Math.max(1, Math.min(1000, Number(datos.get("puntaje_maximo") || 100)));
  const permiteTardias = datos.get("permite_entregas_tardias") !== "false";
  const instrucciones = String(datos.get("instrucciones_entrega") ?? "").trim().slice(0, 2000);

  if (!titulo) return { estado: "nombre_vacio" };
  if (tipo !== "tarea" && tipo !== "examen") return { estado: "invalido" };

  if (!esUuid(materiaId)) return { estado: "invalido" };

  try {
    /*
     * El INSERT lleva la comprobación de que la clase es de este docente en un
     * SELECT: si no es suya, no hay fila que seleccionar y no se escribe nada.
     * Con el permiso general, la condición se anula.
     */
    const creada = await consultarUna<{ id: string }>(
      `INSERT INTO asignacion (
         titulo, descripcion, tipo, materia_360_id, fecha_vencimiento, creada_por_id,
         limite_mb, formatos_permitidos, puntaje_maximo, permite_entregas_tardias, instrucciones_entrega
       )
       SELECT $1, NULLIF($2, ''), $3::tipo_asignacion, m.id,
              NULLIF($4, '')::timestamptz, $5,
              $8, $9, $10, $11, NULLIF($12, '')
         FROM materia_360 m
        WHERE m.id = $6
          AND ($7::uuid IS NULL OR m.docente_id = $7)
       RETURNING id`,
      [titulo, descripcion, tipo, vence, usuario.id, materiaId,
       puedeTodo ? null : usuario.id, limiteMb, formatosPermitidos, puntajeMaximo, permiteTardias, instrucciones],
    );

    if (!creada) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.publicada",
      entidad: "asignacion",
      entidadId: creada.id,
      datos: { titulo, materia_360_id: materiaId },
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

  const puedeTodo = tienePermiso(usuario.rol, "academico.escribir");
  const puedeCalificar = tienePermiso(usuario.rol, "calificaciones.registrar");

  if (!puedeTodo && !puedeCalificar && usuario.rol !== "docente") {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  const nota = String(datos.get("nota") ?? "").trim();
  const comentario = String(datos.get("comentario") ?? "").trim().slice(0, 900);

  if (!esUuid(id)) return { estado: "no_encontrado" };

  const valor = nota === "" ? null : Number(nota);

  if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor > 100)) {
    return { estado: "nota_invalida" };
  }

  try {
    // La entrega tiene que ser de una clase de este docente. Las dos vías, en
    // el WHERE, igual que en la consulta que las lista.
    const revisada = await consultarUna<{ id: string }>(
      `UPDATE entrega_estudiante d
          SET estado = CASE WHEN $2::numeric IS NULL THEN d.estado ELSE 'calificado' END,
              calificacion = $2::numeric,
              comentario_profesor = NULLIF($3, ''),
              revisada_por_id = $4,
              revisada_en = now()
         FROM asignacion a
         LEFT JOIN materia     mu ON mu.id = a.materia_id
         LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
        WHERE d.id = $1
          AND a.id = d.asignacion_id
          AND ($5::uuid IS NULL
               OR mu.profesor_usuario_id = $5
               OR m3.docente_id          = $5)
      RETURNING d.id`,
      [id, valor, comentario, usuario.id, puedeTodo ? null : usuario.id],
    );

    if (!revisada) return { estado: "no_encontrado" };

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
 * Pide `calificaciones.registrar` —`docente` y `super_admin`— y no
 * `academico.escribir`: coordinación monta el programa pero no pone notas, y eso
 * está así en `rbac.ts` a propósito. El docente, además, solo en sus clases.
 */
export async function calificarInscripcion360(
  _previo: EstadoAcademico,
  datos: FormData,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "calificaciones.registrar")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  const nota = String(datos.get("nota") ?? "").trim();

  if (!esUuid(id)) return { estado: "no_encontrado" };

  const valor = nota === "" ? null : Number(nota);

  if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor > 100)) {
    return { estado: "nota_invalida" };
  }

  const estado =
    valor === null ? "cursando" : valor >= NOTA_APROBADA ? "aprobada" : "reprobada";

  try {
    // Una inscripción retirada no se califica: el estudiante no terminó la clase.
    const calificada = await consultarUna<{ id: string }>(
      `UPDATE inscripcion_360 i
          SET nota = $2::numeric, estado = $3
         FROM materia_360 m
        WHERE i.id = $1
          AND m.id = i.materia_id
          AND i.estado <> 'retirada'
          AND ($4::uuid IS NULL OR m.docente_id = $4)
      RETURNING i.id`,
      [id, valor, estado, usuario.rol === "docente" ? usuario.id : null],
    );

    if (!calificada) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "inscripcion_360.calificada",
      entidad: "inscripcion_360",
      entidadId: calificada.id,
      datos: { nota: valor, estado },
    });
  } catch (error) {
    console.error("[academico] no se pudo calificar la inscripción de 360", error);
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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
