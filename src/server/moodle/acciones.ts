"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso, requerirRol } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { usuarioTienePermiso } from "@/lib/rbac";
import { MAXIMO_ENTREGA, subirEntrega } from "@/lib/supabase/almacen";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";

export type ResultadoMoodle = {
  ok: boolean;
  mensaje?: string;
};

/*
 * La matrícula en Global Effect 360 NO vive aquí: está en
 * `@/server/global360/acciones` (`prematricular`), que es la única vía. Había
 * una segunda copia en este archivo que aceptaba la tanda del navegador; se
 * retiró para que la regla de una materia por tanda tenga un solo dueño.
 */

/**
 * Formatos que el servidor sabe guardar, con el tipo que debe traer el archivo.
 * Lista CERRADA a propósito: aunque una tarea anuncie otros (`zip`), un bucket
 * donde se pueda subir cualquier cosa es donde alguien sube un ejecutable. Lo
 * que la tarea permita se cruza con esta lista, nunca la amplía.
 */
const FORMATOS_ENTREGA: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const MAXIMO_TEXTO_ENTREGA = 20000;

/**
 * Entrega de una tarea por el estudiante: un documento, texto escrito o ambos.
 *
 * Qué garantiza, y por qué cada cosa:
 *   · El estudiante sale de la SESIÓN y debe tener el rol `estudiante`: con un
 *     id del formulario se entregaría en nombre de otro.
 *   · La tarea tiene que ser de una clase donde está inscrito (carrera o 360):
 *     con el id de una tarea ajena no se puede entregar. Si no encaja, se
 *     responde igual que si no existiera.
 *   · El archivo SE SUBE AQUÍ, a Storage, con una ruta hecha de ids. Antes el
 *     navegador mandaba una URL inventada y el docente nunca podía abrirla.
 *   · Tamaño, formato y plazo se comprueban contra el archivo real y contra
 *     lo que la tarea permite, no contra lo que declare el cliente.
 *   · Una entrega nueva anula la revisión anterior: la nota vieja ya no
 *     corresponde a lo que hay.
 */
export async function entregarTareaMoodleAction(
  datos: FormData,
): Promise<ResultadoMoodle> {
  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante.id) {
    return { ok: false, mensaje: "sin_ficha" };
  }

  const asignacionId = String(datos.get("asignacion_id") ?? "").trim();
  const archivo = datos.get("archivo");
  const texto = String(datos.get("texto_respuesta") ?? "").trim();
  const comentarioEstudiante =
    String(datos.get("comentario_estudiante") ?? "").trim().slice(0, 900) || null;

  if (!UUID.test(asignacionId)) return { ok: false, mensaje: "no_es_tuya" };
  if (texto.length > MAXIMO_TEXTO_ENTREGA) return { ok: false, mensaje: "texto_largo" };

  const hayArchivo = archivo instanceof File && archivo.size > 0;

  try {
    const asignacion = await consultarUna<{
      id: string;
      titulo: string;
      limite_mb: number;
      formatos_permitidos: string[];
      fecha_vencimiento: string | null;
      permite_entregas_tardias: boolean;
      ya_entregada: boolean;
    }>(
      `SELECT a.id, a.titulo, coalesce(a.limite_mb, 10)::int AS limite_mb,
              coalesce(a.formatos_permitidos, ARRAY['pdf', 'docx'])::text[] AS formatos_permitidos,
              a.fecha_vencimiento::text,
              coalesce(a.permite_entregas_tardias, true) AS permite_entregas_tardias,
              EXISTS (SELECT 1 FROM public.entrega_estudiante e
                       WHERE e.asignacion_id = a.id AND e.estudiante_id = $2
                         AND (e.archivo_url IS NOT NULL OR e.texto_respuesta IS NOT NULL)) AS ya_entregada
         FROM public.asignacion a
        WHERE a.id = $1
          AND (
            EXISTS (SELECT 1 FROM public.inscripcion i
                     WHERE i.materia_id = a.materia_id
                       AND i.estudiante_id = $2 AND i.estado = 'activa')
            OR EXISTS (SELECT 1 FROM public.inscripcion_360 t
                        WHERE t.materia_id = a.materia_360_id
                          AND t.estudiante_id = $2
                          AND t.estado IN ('prematriculada', 'cursando'))
          )`,
      [asignacionId, estudiante.id],
    );

    if (!asignacion) return { ok: false, mensaje: "no_es_tuya" };

    // Sin archivo nuevo ni texto, solo vale si ya había una entrega que corregir.
    if (!hayArchivo && !texto && !asignacion.ya_entregada) {
      return { ok: false, mensaje: "sin_contenido" };
    }

    let ruta: string | null = null;
    let nombre: string | null = null;
    let formato: string | null = null;
    let tamanoMb: number | null = null;

    if (hayArchivo) {
      const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
      const permitidos = asignacion.formatos_permitidos
        .map((f) => f.toLowerCase().trim())
        .filter((f) => f in FORMATOS_ENTREGA);

      if (!(extension in FORMATOS_ENTREGA) || !permitidos.includes(extension)) {
        return { ok: false, mensaje: "formato_no_admitido" };
      }
      // El tipo declarado por el navegador también tiene que cuadrar con la extensión.
      if (archivo.type && archivo.type !== FORMATOS_ENTREGA[extension]) {
        return { ok: false, mensaje: "formato_no_admitido" };
      }

      const limite = Math.min(asignacion.limite_mb * 1024 * 1024, MAXIMO_ENTREGA);
      if (archivo.size > limite) return { ok: false, mensaje: "muy_grande" };

      // Ruta con ids de la base, nunca con el nombre que eligió el estudiante.
      const subida = await subirEntrega(
        `entregas/${asignacionId}/${estudiante.id}.${extension === "jpeg" ? "jpg" : extension}`,
        archivo,
      );
      if (!subida.ok) return { ok: false, mensaje: "error" };

      ruta = subida.ruta;
      nombre = archivo.name.slice(0, 200);
      formato = extension;
      tamanoMb = Math.round((archivo.size / (1024 * 1024)) * 100) / 100;
    }

    const vencida = asignacion.fecha_vencimiento
      ? new Date(asignacion.fecha_vencimiento) < new Date()
      : false;

    if (vencida && !asignacion.permite_entregas_tardias) {
      return { ok: false, mensaje: "plazo_vencido" };
    }

    const estadoFinal = vencida ? "tarde" : "entregado";

    await enTransaccion(async (cliente) => {
      await cliente.query(
        `INSERT INTO public.entrega_estudiante (
           asignacion_id, estudiante_id, estado, archivo_url, archivo_nombre,
           archivo_tamano_mb, archivo_formato, texto_respuesta, fecha_entrega,
           comentario_estudiante
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), now(), $9)
         ON CONFLICT (asignacion_id, estudiante_id)
         DO UPDATE SET
           estado = EXCLUDED.estado,
           -- Sin archivo nuevo se conserva el que había.
           archivo_url = coalesce(EXCLUDED.archivo_url, entrega_estudiante.archivo_url),
           archivo_nombre = coalesce(EXCLUDED.archivo_nombre, entrega_estudiante.archivo_nombre),
           archivo_tamano_mb = coalesce(EXCLUDED.archivo_tamano_mb, entrega_estudiante.archivo_tamano_mb),
           archivo_formato = coalesce(EXCLUDED.archivo_formato, entrega_estudiante.archivo_formato),
           -- Sin texto nuevo se conserva el escrito antes.
           texto_respuesta = coalesce(EXCLUDED.texto_respuesta, entrega_estudiante.texto_respuesta),
           fecha_entrega = now(),
           comentario_estudiante = EXCLUDED.comentario_estudiante,
           -- Una entrega nueva anula la revisión anterior.
           calificacion = NULL,
           comentario_profesor = NULL,
           revisada_por_id = NULL,
           revisada_en = NULL,
           updated_at = now()`,
        [
          asignacionId,
          estudiante.id,
          estadoFinal,
          ruta,
          nombre,
          tamanoMb,
          formato,
          texto,
          comentarioEstudiante,
        ],
      );
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.entregada",
      entidad: "entrega_estudiante",
      entidadId: asignacionId,
      datos: { titulo: asignacion.titulo, conArchivo: hayArchivo, conTexto: Boolean(texto), estado: estadoFinal },
    });

    revalidatePath("/portal/estudiante/aula-virtual");
    revalidatePath("/portal/profesor");

    return { ok: true, mensaje: vencida ? "entregada_tarde" : "entregada" };
  } catch (error) {
    console.error("[moodle] Error al entregar tarea:", error);
    return { ok: false, mensaje: "error" };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Calificación con feedback por el docente en el buzón virtual.
 */
export async function calificarEntregaMoodleAction(
  datos: FormData,
): Promise<ResultadoMoodle> {
  const usuario = await requerirPermiso("calificaciones.registrar");

  const entregaId = String(datos.get("entrega_id") ?? "").trim();
  const calificacion = parseFloat(String(datos.get("calificacion") ?? "0"));
  const comentarioProfesor = String(datos.get("comentario_profesor") ?? "").trim();

  if (!entregaId) {
    return { ok: false, mensaje: "Identificador de entrega inválido." };
  }

  if (isNaN(calificacion) || calificacion < 0 || calificacion > 100) {
    return { ok: false, mensaje: "La calificación debe ser una nota numérica entre 0 y 100." };
  }

  try {
    const actualizada = await consultarUna<{ id: string; estudiante_id: string }>(
      `UPDATE public.entrega_estudiante
          SET calificacion = $2,
              comentario_profesor = $3,
              estado = 'calificado',
              revisada_por_id = $4,
              revisada_en = now(),
              updated_at = now()
        FROM public.asignacion a
        LEFT JOIN public.materia     mu ON mu.id = a.materia_id
        LEFT JOIN public.materia_360 m3 ON m3.id = a.materia_360_id
       WHERE entrega_estudiante.id = $1
         AND a.id = entrega_estudiante.asignacion_id
         -- Solo se califica lo que el estudiante entregó.
         AND entrega_estudiante.estado IN ('entregado', 'tarde', 'calificado')
         -- Y solo de la propia clase, salvo quien administra lo académico.
         AND ($5::uuid IS NULL OR mu.profesor_usuario_id = $5 OR m3.docente_id = $5)
        RETURNING entrega_estudiante.id, entrega_estudiante.estudiante_id`,
      [
        entregaId,
        calificacion,
        comentarioProfesor || null,
        usuario.id,
        usuarioTienePermiso(usuario, "academico.escribir") ? null : usuario.id,
      ],
    );

    if (!actualizada) {
      return { ok: false, mensaje: "La entrega especificada no existe." };
    }

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.calificada",
      entidad: "entrega_estudiante",
      entidadId: entregaId,
      datos: { calificacion, tieneFeedback: !!comentarioProfesor },
    });

    revalidatePath("/portal/profesor");
    revalidatePath("/portal/estudiante/aula-virtual");

    return { ok: true, mensaje: "Calificación y feedback guardados exitosamente." };
  } catch (error) {
    console.error("[moodle] Error al calificar entrega:", error);
    return { ok: false, mensaje: "Error al registrar la calificación de la entrega." };
  }
}
