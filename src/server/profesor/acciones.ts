"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { tienePermiso } from "@/lib/rbac";

/**
 * Gestión académica: cursos técnicos, tareas y revisión de entregas.
 *
 * QUIÉN PUEDE. Dos puertas, y las dos valen:
 *
 *   · `academico.escribir` —`admin` y `super_admin`— sobre cualquier curso.
 *   · el rol `docente` sobre SUS cursos, comprobado en el propio WHERE con
 *     `docente_usuario_id`.
 *
 * La segunda es la que pedía la especificación: las materias de los cursos
 * técnicos se gestionan desde el portal del profesor. Y no basta con mirar el
 * rol: un docente con el id de un curso ajeno no debe poder editarlo, así que la
 * condición va dentro de la escritura y no en un `if` previo.
 *
 * Global Effect 360 es distinto y aquí solo aparece para PONER TAREAS. El
 * catálogo —crear una materia, marcarla obligatoria, retirarla— vive en
 * `/academico/prematricula` con `academico.escribir`. Un docente puede poner
 * tarea en su clase de 360; no puede tocar el programa.
 */

export type EstadoAcademico = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "nombre_vacio"
    | "tiene_datos"
    | "nota_invalida"
    | "invalido"
    | "error";
};

const MODALIDADES = ["presencial", "virtual", "mixto"];
const ESTADOS_CURSO = ["activo", "finalizado", "planificado"];

/** Alta y edición de un curso técnico. Con `id` vacío, es un alta. */
export async function guardarCurso(
  _previo: EstadoAcademico,
  datos: FormData,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();

  const puedeTodo = tienePermiso(usuario.rol, "academico.escribir");

  if (!puedeTodo && usuario.rol !== "docente") {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 160);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 600);
  const horario = String(datos.get("horario") ?? "").trim().slice(0, 120);
  const modalidad = String(datos.get("modalidad") ?? "presencial");
  const estado = String(datos.get("estado") ?? "activo");
  const capacidad = Number(datos.get("capacidad") ?? 0);
  const periodoId = String(datos.get("periodo") ?? "").trim();

  if (!nombre) return { estado: "nombre_vacio" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };
  if (periodoId && !esUuid(periodoId)) return { estado: "invalido" };

  // Desplegables que se pueden manipular en el navegador: se comprueban aquí.
  const modalidadOk = MODALIDADES.includes(modalidad) ? modalidad : "presencial";
  const estadoOk = ESTADOS_CURSO.includes(estado) ? estado : "activo";
  const capacidadOk = Number.isFinite(capacidad) && capacidad >= 0 ? Math.min(capacidad, 500) : 0;

  try {
    if (id) {
      /*
       * `docente_usuario_id = $9` en el WHERE cuando NO tiene el permiso
       * general: un docente solo edita sus cursos, y si el id es de otro la
       * escritura no encuentra fila. Se responde "no encontrado" y no "no
       * permitido": quien prueba ids ajenos no debe distinguir los dos casos.
       */
      const editado = await consultarUna<{ id: string }>(
        `UPDATE curso
            SET nombre = $2, descripcion = NULLIF($3, ''), horario = NULLIF($4, ''),
                modalidad = $5, estado = $6, capacidad = $7,
                periodo_id = coalesce(NULLIF($8, '')::uuid, periodo_id)
          WHERE id = $1
            AND ($9::uuid IS NULL OR docente_usuario_id = $9)
        RETURNING id`,
        [id, nombre, descripcion, horario, modalidadOk, estadoOk, capacidadOk,
         periodoId, puedeTodo ? null : usuario.id],
      );

      if (!editado) return { estado: "no_encontrado" };

      await anotar(usuario.id, "curso.editado", editado.id, { nombre });
    } else {
      // Un curso que crea un docente queda a su nombre: si no, lo crearía y
      // dejaría de verlo en el mismo instante.
      const creado = await consultarUna<{ id: string }>(
        `INSERT INTO curso
                (nombre, descripcion, horario, modalidad, estado, capacidad,
                 periodo_id, docente, docente_usuario_id)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, $5, $6,
                 NULLIF($7, '')::uuid, $8, $9)
         RETURNING id`,
        [nombre, descripcion, horario, modalidadOk, estadoOk, capacidadOk,
         periodoId, usuario.nombre, usuario.id],
      );

      if (!creado) return { estado: "error" };

      await anotar(usuario.id, "curso.creado", creado.id, { nombre });
    }
  } catch (error) {
    console.error("[academico] no se pudo guardar el curso", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Borra un curso, y solo si está vacío.
 *
 * `calificacion.curso_id` es ON DELETE CASCADE, así que borrar un curso con
 * notas se llevaría por delante el historial académico de sus estudiantes sin
 * avisar. Se comprueba antes y se responde `tiene_datos`: para retirar un curso
 * que ya se dio, está el estado `finalizado`.
 */
export async function eliminarCurso(
  _previo: EstadoAcademico,
  datos: FormData,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();

  const puedeTodo = tienePermiso(usuario.rol, "academico.escribir");

  if (!puedeTodo && usuario.rol !== "docente") {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrado" };

  const ocupado = await consultarUna<{ notas: number; tareas: number }>(
    `SELECT (SELECT count(*)::int FROM calificacion WHERE curso_id = $1) AS notas,
            (SELECT count(*)::int FROM asignacion   WHERE curso_id = $1) AS tareas`,
    [id],
  );

  if ((ocupado?.notas ?? 0) > 0 || (ocupado?.tareas ?? 0) > 0) {
    return { estado: "tiene_datos" };
  }

  const borrado = await consultarUna<{ id: string; nombre: string }>(
    `DELETE FROM curso
      WHERE id = $1
        AND ($2::uuid IS NULL OR docente_usuario_id = $2)
    RETURNING id, nombre`,
    [id, puedeTodo ? null : usuario.id],
  );

  if (!borrado) return { estado: "no_encontrado" };

  await anotar(usuario.id, "curso.eliminado", borrado.id, {
    nombre: borrado.nombre,
  });

  refrescar();

  return { estado: "ok" };
}

/**
 * Publica una tarea o un examen en un curso técnico o en una clase de 360.
 *
 * La unidad llega como `curso:<id>` o `360:<id>`, no como dos campos: el CHECK
 * de la 0028 exige que la tarea cuelgue de EXACTAMENTE una, y un solo campo hace
 * imposible mandar las dos por descuido.
 */
export async function publicarTarea(
  _previo: EstadoAcademico,
  datos: FormData,
): Promise<EstadoAcademico> {
  const usuario = await requerirUsuario();

  const puedeTodo = tienePermiso(usuario.rol, "academico.escribir");

  if (!puedeTodo && usuario.rol !== "docente") {
    return { estado: "no_permitido" };
  }

  const unidad = String(datos.get("unidad") ?? "");
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

  const [clase, idUnidad] = unidad.split(":");

  if (!esUuid(idUnidad ?? "") || (clase !== "curso" && clase !== "360")) {
    return { estado: "invalido" };
  }

  try {
    /*
     * El INSERT lleva la comprobación de que la unidad es de este docente en un
     * SELECT: si el curso o la clase no son suyos, no hay fila que seleccionar y
     * no se escribe nada. Con el permiso general, la condición se anula.
     */
    const creada =
      clase === "curso"
        ? await consultarUna<{ id: string }>(
            `INSERT INTO asignacion (
               titulo, descripcion, tipo, curso_id, fecha_vencimiento, creada_por_id,
               limite_mb, formatos_permitidos, puntaje_maximo, permite_entregas_tardias, instrucciones_entrega
             )
             SELECT $1, NULLIF($2, ''), $3::tipo_asignacion, c.id,
                    NULLIF($4, '')::timestamptz, $5,
                    $8, $9, $10, $11, NULLIF($12, '')
               FROM curso c
              WHERE c.id = $6
                AND ($7::uuid IS NULL OR c.docente_usuario_id = $7)
             RETURNING id`,
            [titulo, descripcion, tipo, vence, usuario.id, idUnidad,
             puedeTodo ? null : usuario.id, limiteMb, formatosPermitidos, puntajeMaximo, permiteTardias, instrucciones],
          )
        : await consultarUna<{ id: string }>(
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
            [titulo, descripcion, tipo, vence, usuario.id, idUnidad,
             puedeTodo ? null : usuario.id, limiteMb, formatosPermitidos, puntajeMaximo, permiteTardias, instrucciones],
          );

    if (!creada) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.publicada",
      entidad: "asignacion",
      entidadId: creada.id,
      datos: { titulo, unidad },
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
    // La entrega tiene que ser de una clase de este docente. Las tres vías, en
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
         LEFT JOIN curso       cu ON cu.id = a.curso_id
         LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
        WHERE d.id = $1
          AND a.id = d.asignacion_id
          AND ($5::uuid IS NULL
               OR mu.profesor_usuario_id = $5
               OR cu.docente_usuario_id  = $5
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

function anotar(
  usuarioId: string,
  accion: string,
  entidadId: string,
  extra?: Record<string, unknown>,
) {
  return registrar({
    usuarioId,
    accion,
    entidad: "curso",
    entidadId,
    datos: extra,
  });
}

function refrescar() {
  revalidatePath("/[locale]/academico/cursos", "page");
  revalidatePath("/[locale]/portal/profesor", "page");
  revalidatePath("/[locale]/portal/estudiante/aula-virtual", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
