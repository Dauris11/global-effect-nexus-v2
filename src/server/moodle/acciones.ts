"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
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
 * Entrega de tarea por el estudiante con validación Moodle de formato, tamaño y fecha.
 */
export async function entregarTareaMoodleAction(
  datos: FormData,
): Promise<ResultadoMoodle> {
  const usuario = await requerirUsuario();
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante) {
    return { ok: false, mensaje: "No se encontró ficha de estudiante asociada a tu usuario." };
  }

  const asignacionId = String(datos.get("asignacion_id") ?? "").trim();
  const archivoNombre = String(datos.get("archivo_nombre") ?? "").trim();
  const archivoTamanoMb = parseFloat(String(datos.get("archivo_tamano_mb") ?? "0"));
  const archivoFormato = String(datos.get("archivo_formato") ?? "").toLowerCase().replace(".", "");
  const archivoUrl = String(datos.get("archivo_url") ?? "").trim();
  const comentarioEstudiante = String(datos.get("comentario_estudiante") ?? "").trim() || null;

  if (!asignacionId) {
    return { ok: false, mensaje: "Identificador de asignación inválido." };
  }

  if (!archivoUrl || !archivoNombre) {
    return { ok: false, mensaje: "Debes adjuntar el archivo de tu entrega." };
  }

  try {
    const asignacion = await consultarUna<{
      id: string;
      titulo: string;
      limite_mb: number;
      formatos_permitidos: string[];
      fecha_vencimiento: string | null;
      permite_entregas_tardias: boolean;
    }>(
      `SELECT id, titulo, coalesce(limite_mb, 10)::int AS limite_mb,
              coalesce(formatos_permitidos, ARRAY['pdf', 'docx', 'zip'])::text[] AS formatos_permitidos,
              fecha_vencimiento::text, coalesce(permite_entregas_tardias, true) AS permite_entregas_tardias
         FROM public.asignacion
        WHERE id = $1`,
      [asignacionId],
    );

    if (!asignacion) {
      return { ok: false, mensaje: "La tarea solicitada no existe." };
    }

    // Validación Moodle 1: Límite de tamaño en MB
    if (archivoTamanoMb > asignacion.limite_mb) {
      return {
        ok: false,
        mensaje: `El archivo (${archivoTamanoMb.toFixed(1)} MB) supera el límite máximo permitido de ${asignacion.limite_mb} MB.`,
      };
    }

    // Validación Moodle 2: Formatos permitidos
    const formatosLimpios = asignacion.formatos_permitidos.map((f) => f.toLowerCase().trim());
    if (formatosLimpios.length > 0 && !formatosLimpios.includes(archivoFormato)) {
      return {
        ok: false,
        mensaje: `El formato .${archivoFormato} no está admitido. Formatos permitidos: ${formatosLimpios.map((f) => `.${f}`).join(", ")}.`,
      };
    }

    // Validación Moodle 3: Vencimiento y entregas tardías
    const vencida = asignacion.fecha_vencimiento
      ? new Date(asignacion.fecha_vencimiento) < new Date()
      : false;

    if (vencida && !asignacion.permite_entregas_tardias) {
      return {
        ok: false,
        mensaje: "El plazo de entrega ha vencido y esta tarea no acepta entregas tardías.",
      };
    }

    const estadoFinal = vencida ? "tarde" : "entregado";

    await enTransaccion(async (cliente) => {
      await cliente.query(
        `INSERT INTO public.entrega_estudiante (
           asignacion_id, estudiante_id, estado, archivo_url, archivo_nombre,
           archivo_tamano_mb, archivo_formato, fecha_entrega, comentario_estudiante
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
         ON CONFLICT (asignacion_id, estudiante_id)
         DO UPDATE SET
           estado = EXCLUDED.estado,
           archivo_url = EXCLUDED.archivo_url,
           archivo_nombre = EXCLUDED.archivo_nombre,
           archivo_tamano_mb = EXCLUDED.archivo_tamano_mb,
           archivo_formato = EXCLUDED.archivo_formato,
           fecha_entrega = now(),
           comentario_estudiante = EXCLUDED.comentario_estudiante,
           updated_at = now()`,
        [
          asignacionId,
          estudiante.id,
          estadoFinal,
          archivoUrl,
          archivoNombre,
          isNaN(archivoTamanoMb) ? null : archivoTamanoMb,
          archivoFormato,
          comentarioEstudiante,
        ],
      );
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.entregada",
      entidad: "entrega_estudiante",
      entidadId: asignacionId,
      datos: {
        titulo: asignacion.titulo,
        archivo: archivoNombre,
        estado: estadoFinal,
      },
    });

    revalidatePath("/portal/estudiante/aula-virtual");
    revalidatePath("/portal/profesor");

    return {
      ok: true,
      mensaje: vencida
        ? "Tarea entregada con éxito (registrada como entrega tardía)."
        : "Tarea entregada exitosamente en el buzón virtual.",
    };
  } catch (error) {
    console.error("[moodle] Error al entregar tarea:", error);
    return { ok: false, mensaje: "Ocurrió un error al procesar tu entrega." };
  }
}

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
        WHERE id = $1
        RETURNING id, estudiante_id`,
      [entregaId, calificacion, comentarioProfesor || null, usuario.id],
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
