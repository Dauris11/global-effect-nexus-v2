import type { DatosDeClase } from "@/lib/clase-docente";
import type { OrigenClase } from "@/lib/clases";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { diaEnRD } from "@/lib/fechas";
import {
  claseDelDocente,
  estudiantesParaAsistencia,
  pendientesPorTarea,
  sesionesDeLaClase,
} from "@/server/profesor/clases";
import {
  asignacionesDeClases360,
  asignacionesDeMaterias,
  inscritosDeClase360,
  inscritosDeMateria,
} from "@/server/profesor/consultas";

/**
 * Todo lo que necesita la pantalla de una clase, ya en forma serializable.
 * Devuelve `null` si la clase no es de este docente: la página lo convierte en
 * 404, igual que una clase que no existe.
 */
export async function datosDeClase(
  docenteId: string | null,
  origen: OrigenClase,
  id: string,
): Promise<DatosDeClase | null> {
  const clase = await claseDelDocente(docenteId, origen, id);

  if (!clase) return null;
  const g = origen === "g360";

  const [inscritos, asignaciones, sesiones, roster, sinCalificar] = await Promise.all([
    g ? inscritosDeClase360(id) : inscritosDeMateria(id),
    g ? asignacionesDeClases360(docenteId) : asignacionesDeMaterias(docenteId),
    sesionesDeLaClase(clase),
    estudiantesParaAsistencia(clase),
    pendientesPorTarea(clase),
  ]);

  const publicaciones = await Promise.all(
    (asignaciones[id] ?? []).map(async (a) => ({
      id: a.id,
      titulo: a.titulo,
      tipo: a.tipo,
      vence: a.fecha_vencimiento,
      puntaje: a.puntaje_maximo,
      entregas: a.entregas,
      sinCalificar: sinCalificar[a.id] ?? 0,
      enlace:
        a.archivo_url && !a.archivo_url.startsWith("http")
          ? await enlaceDeDocumento(a.archivo_url)
          : a.archivo_url,
    })),
  );

  return {
    origen,
    id,
    periodoId: clase.periodo_id,
    nombre: clase.nombre,
    estudiantes: inscritos.map((i) => ({
      inscripcionId: i.id,
      nombre: i.nombre,
      estado: i.estado,
      periodo: i.periodo,
      entregadas: i.entregadas,
      tareas: i.tareas,
      nota: "nota" in i ? i.nota : i.nota_final,
      propuesta: i.notaPropuesta,
      asistencia: "asistenciaPorcentaje" in i ? i.asistenciaPorcentaje : null,
    })),
    publicaciones,
    sesiones,
    roster: roster.map((r) => ({
      inscripcionId: r.inscripcion_id,
      nombre: r.nombre,
      marcaHoy: r.marca_hoy,
    })),
    hoyYaPasada: sesiones.some((s) => s.fecha === diaEnRD()),
  };
}
