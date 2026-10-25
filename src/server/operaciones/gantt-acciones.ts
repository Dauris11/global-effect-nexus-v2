"use server";

import { revalidatePath } from "next/cache";
import { requerirPermiso } from "@/lib/auth";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";

/**
 * Actualiza la reprogramación de fechas de una tarea (arrastrar o redimensionar en Gantt).
 */
export async function actualizarFechasTareaGantt(datos: {
  tareaId: string;
  fechaInicio: string;
  fechaFin: string;
  progreso?: number;
}): Promise<{ ok: boolean; error?: string }> {
  await requerirPermiso("operaciones.escribir");

  if (!datos.tareaId || !datos.fechaInicio || !datos.fechaFin) {
    return { ok: false, error: "Fechas inválidas" };
  }

  await consultar(
    `UPDATE public.tarea
        SET fecha_inicio = $1,
            fecha_limite = $2,
            progreso = coalesce($3, progreso),
            updated_at = now()
      WHERE id = $4`,
    [datos.fechaInicio, datos.fechaFin, datos.progreso ?? null, datos.tareaId],
  );

  revalidatePath("/administrativo/proyectos");
  return { ok: true };
}

/**
 * Agrega una dependencia Fin-Inicio entre dos tareas.
 */
export async function agregarDependenciaTarea(datos: {
  tareaOrigenId: string;
  tareaDestinoId: string;
  tipo?: "FS" | "SS" | "FF" | "SF";
}): Promise<{ ok: boolean; error?: string }> {
  await requerirPermiso("operaciones.escribir");

  if (datos.tareaOrigenId === datos.tareaDestinoId) {
    return { ok: false, error: "Una tarea no puede depender de sí misma" };
  }

  try {
    await consultar(
      `INSERT INTO public.tarea_dependencia (tarea_origen_id, tarea_destino_id, tipo)
       VALUES ($1, $2, $3)
       ON CONFLICT (tarea_origen_id, tarea_destino_id) DO UPDATE
          SET tipo = EXCLUDED.tipo`,
      [datos.tareaOrigenId, datos.tareaDestinoId, datos.tipo ?? "FS"],
    );
  } catch (error) {
    return { ok: false, error: "No se pudo registrar la dependencia" };
  }

  revalidatePath("/administrativo/proyectos");
  return { ok: true };
}

/**
 * Elimina una dependencia entre dos tareas.
 */
export async function eliminarDependenciaTarea(
  tareaOrigenId: string,
  tareaDestinoId: string,
): Promise<{ ok: boolean }> {
  await requerirPermiso("operaciones.escribir");

  await consultar(
    `DELETE FROM public.tarea_dependencia
      WHERE tarea_origen_id = $1 AND tarea_destino_id = $2`,
    [tareaOrigenId, tareaDestinoId],
  );

  revalidatePath("/administrativo/proyectos");
  return { ok: true };
}

/**
 * Crea una nueva fase dentro de un proyecto.
 */
export async function crearFaseProyecto(datos: {
  proyectoId: string;
  nombre: string;
  orden?: number;
}): Promise<{ ok: boolean; faseId?: string; error?: string }> {
  await requerirPermiso("operaciones.escribir");

  if (!datos.proyectoId || !datos.nombre.trim()) {
    return { ok: false, error: "Datos incompletos para crear la fase" };
  }

  const fila = await consultarUna<{ id: string }>(
    `INSERT INTO public.proyecto_fase (proyecto_id, nombre, orden)
     VALUES ($1, $2, coalesce($3, (SELECT coalesce(max(orden), 0) + 1 FROM public.proyecto_fase WHERE proyecto_id = $1)))
     RETURNING id`,
    [datos.proyectoId, datos.nombre.trim(), datos.orden ?? null],
  );

  revalidatePath("/administrativo/proyectos");
  return { ok: true, faseId: fila?.id };
}
