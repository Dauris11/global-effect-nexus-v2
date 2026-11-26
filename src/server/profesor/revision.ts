import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { tipoDeAdjunto, type TareaRevisable } from "@/lib/revision-entregas";

import { entregasDelDocente } from "./consultas";

/**
 * Las tareas del docente con las entregas de cada estudiante, listas para el
 * revisor. Los enlaces se firman en paralelo: son llamadas HTTP a Storage y
 * encadenarlas sumaría una ida y vuelta por entrega.
 */
export async function tareasParaRevisar(docenteId: string | null): Promise<TareaRevisable[]> {
  const filas = await entregasDelDocente(docenteId);
  const enlaces = await Promise.all(filas.map((fila) => enlaceDeDocumento(fila.archivo_url)));

  const porTarea = new Map<string, TareaRevisable>();

  filas.forEach((fila, indice) => {
    const clave = fila.asignacion_id;
    const tarea = porTarea.get(clave) ?? {
      id: clave,
      titulo: fila.asignacion,
      unidad: fila.unidad,
      puntajeMaximo: fila.puntaje_maximo,
      entregas: [],
    };

    tarea.entregas.push({
      id: fila.id,
      estudiante: fila.estudiante,
      estado: fila.estado,
      fechaEntrega: fila.fecha_entrega ? fila.fecha_entrega.toISOString() : null,
      textoRespuesta: fila.texto_respuesta,
      enlace: enlaces[indice],
      tipoAdjunto: tipoDeAdjunto(fila.archivo_url),
      calificacion: fila.calificacion,
      comentario: fila.comentario_profesor,
    });
    porTarea.set(clave, tarea);
  });

  // Primero las tareas que aún esperan nota: es lo que el docente viene a hacer.
  const pendientes = (tarea: TareaRevisable) =>
    tarea.entregas.filter((entrega) => entrega.estado !== "calificado").length;

  return [...porTarea.values()].sort((a, b) => pendientes(b) - pendientes(a));
}
