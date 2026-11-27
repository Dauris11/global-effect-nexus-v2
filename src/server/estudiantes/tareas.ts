import { claveDeClase, grupoDeTarea, textoDeVencimiento, type TareaVista } from "@/lib/clases";
import { diaEnRD } from "@/lib/fechas";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { asignacionesDelEstudiante } from "@/server/estudiantes/aula";

/**
 * Las tareas, materiales y anuncios del estudiante listos para pintar.
 *
 * Los archivos del bucket privado se firman aquí, en el servidor: la URL firmada
 * caduca y el navegador nunca ve la ruta interna. Solo se firma lo que tiene
 * archivo (una llamada por archivo), y se hace en paralelo.
 */
export async function tareasDelEstudiante(
  estudianteId: string | null,
  idioma: "es" | "en",
): Promise<TareaVista[]> {
  const filas = await asignacionesDelEstudiante(estudianteId);
  const hoy = diaEnRD();

  const firmar = (ruta: string | null | undefined) =>
    ruta && !ruta.startsWith("http")
      ? enlaceDeDocumento(ruta)
      : Promise.resolve(ruta ?? null);

  return Promise.all(
    filas.map(async (fila): Promise<TareaVista> => {
      const [archivoUrl, entregaUrl] = await Promise.all([
        firmar(fila.archivo_url),
        firmar(fila.entrega_archivo_url),
      ]);

      const estado = fila.estado_entrega ?? "pendiente";
      const evaluable = fila.tipo === "tarea" || fila.tipo === "examen";
      // Un material con fecha también cumple `vencida` en SQL, pero no hay nada que entregar.
      const vencida = evaluable && fila.vencida;
      const venceDia = fila.fecha_vencimiento ? diaEnRD(fila.fecha_vencimiento) : null;

      return {
        id: fila.id,
        titulo: fila.titulo,
        descripcion: fila.descripcion,
        tipo: fila.tipo,
        materia: fila.materia,
        origen: fila.origen,
        claveClase: claveDeClase(fila.origen, fila.clase_id),
        vence: fila.fecha_vencimiento?.toISOString() ?? null,
        venceTexto: fila.fecha_vencimiento
          ? textoDeVencimiento(fila.fecha_vencimiento, idioma)
          : null,
        publicadaDia: diaEnRD(fila.fecha_publicacion),
        estado,
        vencida,
        grupo: grupoDeTarea({ ...fila, estado_entrega: estado, vencida }, hoy, venceDia),
        calificacion: fila.calificacion,
        puntaje: fila.puntaje_maximo ?? 100,
        comentarioProfesor: fila.comentario_profesor,
        instrucciones: fila.instrucciones_entrega ?? null,
        limiteMb: fila.limite_mb ?? 10,
        formatos: (fila.formatos_permitidos ?? ["pdf", "docx"]).map((f) => f.toLowerCase().trim()),
        tardiasPermitidas: fila.permite_entregas_tardias ?? true,
        archivoUrl,
        entrega: fila.entrega_id
          ? {
              nombre: fila.entrega_archivo_nombre ?? null,
              url: entregaUrl,
              texto: fila.entrega_texto_respuesta ?? null,
              comentario: fila.entrega_comentario_estudiante ?? null,
            }
          : null,
      };
    }),
  );
}
