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
    revalidatePath("/academico/cursos");
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

    revalidatePath("/academico/cursos");
    revalidatePath("/portal/profesor");
    revalidatePath("/portal/estudiante/aula-virtual");

    return { ok: true, mensaje: "Calificación y feedback guardados exitosamente." };
  } catch (error) {
    console.error("[moodle] Error al calificar entrega:", error);
    return { ok: false, mensaje: "Error al registrar la calificación de la entrega." };
  }
}

/**
 * Matrícula en materia de Global 360 con control de cupos y rondas cuatrimestrales.
 */
export async function matricularMateria360Action(
  materiaId: string,
  ronda: number,
): Promise<ResultadoMoodle> {
  const usuario = await requerirUsuario();
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante || estudiante.tipo !== "becado") {
    return {
      ok: false,
      mensaje: "Solo los becados universitarios tienen acceso al programa Global Effect 360.",
    };
  }

  try {
    const res = await enTransaccion(async (cliente) => {
      // 1. Verificar ventana activa
      const { rows: ventanas } = await cliente.query<{ id: string; periodo_id: string; ronda: number }>(
        `SELECT id, periodo_id, coalesce(ronda, 1) AS ronda
           FROM public.ventana_prematricula
          WHERE activa = true AND now() >= abre AND now() <= cierra
          LIMIT 1`,
      );

      if (ventanas.length === 0) {
        return { ok: false, mensaje: "El período de matrícula cuatrimestral no está abierto en este momento." };
      }

      const ventana = ventanas[0];
      const periodoId = ventana.periodo_id;

      // 2. Verificar cupo disponible en la materia
      const { rows: materias } = await cliente.query<{
        id: string;
        nombre: string;
        cupo_maximo: number;
        cupo_ocupado: number;
      }>(
        `SELECT m.id, m.nombre, coalesce(m.cupo_maximo, 30)::int AS cupo_maximo,
                (SELECT count(*)::int
                   FROM public.inscripcion_360 i
                  WHERE i.materia_id = m.id AND i.estado IN ('prematriculada', 'cursando')) AS cupo_ocupado
           FROM public.materia_360 m
          WHERE m.id = $1 AND m.activa = true`,
        [materiaId],
      );

      if (materias.length === 0) {
        return { ok: false, mensaje: "La materia solicitada no está activa en el catálogo." };
      }

      const materia = materias[0];
      if (materia.cupo_ocupado >= materia.cupo_maximo) {
        return {
          ok: false,
          mensaje: `No hay cupos disponibles en ${materia.nombre} (${materia.cupo_ocupado}/${materia.cupo_maximo}).`,
        };
      }

      // 3. Registrar o reactivar matrícula
      await cliente.query(
        `INSERT INTO public.inscripcion_360 (estudiante_id, materia_id, periodo_id, estado, ronda)
         VALUES ($1, $2, $3, 'prematriculada', $4)
         ON CONFLICT (estudiante_id, materia_id, periodo_id)
         DO UPDATE SET estado = 'prematriculada', ronda = EXCLUDED.ronda, updated_at = now()`,
        [estudiante.id, materiaId, periodoId, ronda || ventana.ronda || 1],
      );

      return {
        ok: true,
        mensaje: `Te has matriculado exitosamente en ${materia.nombre} para la Ronda ${ronda || ventana.ronda || 1}.`,
      };
    });

    if (res.ok) {
      await registrar({
        usuarioId: usuario.id,
        accion: "materia_360.matricula",
        entidad: "materia_360",
        entidadId: materiaId,
        datos: { ronda },
      });

      revalidatePath("/portal/estudiante/global-360");
      revalidatePath("/academico/prematricula");
    }

    return res;
  } catch (error) {
    console.error("[moodle] Error en matrícula 360:", error);
    return { ok: false, mensaje: "Error al procesar la matrícula de la asignatura." };
  }
}

/**
 * Retiro voluntario de asignatura durante la ventana de matrícula.
 */
export async function retirarMateria360Action(
  inscripcionId: string,
): Promise<ResultadoMoodle> {
  const usuario = await requerirUsuario();
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante) {
    return { ok: false, mensaje: "No tienes una ficha de estudiante activa." };
  }

  try {
    const eliminada = await consultarUna<{ id: string; materia_id: string }>(
      `DELETE FROM public.inscripcion_360
        WHERE id = $1 AND estudiante_id = $2
        RETURNING id, materia_id`,
      [inscripcionId, estudiante.id],
    );

    if (!eliminada) {
      return { ok: false, mensaje: "La inscripción no existe o ya no puede modificarse." };
    }

    revalidatePath("/portal/estudiante/global-360");
    return { ok: true, mensaje: "Materia retirada del período cuatrimestral." };
  } catch (error) {
    console.error("[moodle] Error al retirar materia 360:", error);
    return { ok: false, mensaje: "No se pudo retirar la materia." };
  }
}
