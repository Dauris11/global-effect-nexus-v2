import { claveMes } from "@/lib/fechas";
import { ventanaVigente } from "@/server/global360/consultas";
import { consultar } from "@/lib/db";
import { asignacionesDelEstudiante } from "@/server/estudiantes/aula";
import { condicionEnLaFundacion, estudianteDeUsuario, reunionesEstudiante } from "@/server/estudiantes/portal";

import { diaComoFecha, type ItemCrudo, type Proveedor } from "../tipos";

/** Último día del mes de una clave `YYYY-MM-DD`. */
const finDeMes = (dia: string) => {
  const [a, m] = dia.split("-").map(Number);

  return `${a}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/**
 * Estudiante: tareas por entregar, la materia por elegir mientras la prematrícula está abierta y
 * lo que le falta del mes para conservar la beca (servicio y reunión).
 */
export const proveedorEstudiante: Proveedor = {
  nombre: "estudiante",
  tipos: ["tarea_por_entregar", "materia_por_elegir", "servicio_del_mes", "reunion_del_mes"],
  async getItems({ usuario, userId, hoy }) {
    const estudiante = await estudianteDeUsuario(usuario.id);
    if (!estudiante) return [];

    const mes = claveMes();
    const [filas, condicion, reuniones, ventana] = await Promise.all([
      asignacionesDelEstudiante(estudiante.id),
      condicionEnLaFundacion(estudiante.id, 3),
      reunionesEstudiante(usuario.id, estudiante.id),
      ventanaVigente(),
    ]);
    const items: ItemCrudo[] = [];

    for (const f of filas) {
      if ((f.tipo !== "tarea" && f.tipo !== "examen") || f.estado_entrega !== "pendiente") continue;
      items.push({
        id: `tarea_por_entregar:${f.id}`,
        tipo: "tarea_por_entregar",
        titulo: `Entregar «${f.titulo}»`,
        contexto: f.materia,
        modulo: "estudiante",
        href: "/portal/estudiante/tareas",
        venceEn: f.fecha_vencimiento ?? undefined,
        responsableId: userId,
        accion: { label: "Entregar", kind: "link" },
      });
    }

    // La prematrícula está abierta y todavía no tiene materia en ese período.
    if (ventana?.abierta) {
      const [ya] = await consultar<{ n: number }>(
        `SELECT (SELECT count(*) FROM inscripcion_360 WHERE estudiante_id = $1 AND periodo_id = $2 AND estado <> 'retirada')::int
              + (SELECT count(*) FROM inscripcion WHERE estudiante_id = $1 AND periodo_id = $2 AND estado <> 'retirada')::int AS n`,
        [estudiante.id, ventana.periodo_id],
      );
      if ((ya?.n ?? 0) === 0) {
        items.push({
          id: `materia_por_elegir:${ventana.id}`,
          tipo: "materia_por_elegir",
          titulo: `Elegir tus materias de ${ventana.periodo}`,
          contexto: "Prematrícula abierta",
          modulo: "estudiante",
          href: "/portal/estudiante/prematricula",
          venceEn: diaComoFecha(ventana.cierra.slice(0, 10)),
          responsableId: userId,
          accion: { label: "Elegir ahora", kind: "link" },
        });
      }
    }

    const delMes = condicion.find((m) => m.mes === mes);
    const fin = diaComoFecha(finDeMes(hoy));
    if (!delMes?.hizo_servicio) {
      items.push({
        id: `servicio_del_mes:${estudiante.id}`,
        tipo: "servicio_del_mes",
        titulo: "Cumplir tu servicio del mes",
        contexto: "Requisito de la beca",
        modulo: "estudiante",
        href: "/portal/estudiante/beca",
        venceEn: fin,
        responsableId: userId,
        accion: { label: "Ver detalles", kind: "link" },
      });
    }
    if (!delMes?.asistio_reunion) {
      const programada = reuniones.find((r) => r.fecha.startsWith(mes) && r.fecha >= hoy);
      items.push({
        id: `reunion_del_mes:${estudiante.id}`,
        tipo: "reunion_del_mes",
        titulo: programada ? "Asistir a la reunión del mes" : "Reunión del mes sin programar",
        contexto: "Requisito de la beca",
        modulo: "estudiante",
        href: "/portal/estudiante/beca",
        venceEn: programada ? diaComoFecha(programada.fecha.slice(0, 10)) : fin,
        responsableId: userId,
        accion: { label: "Ver detalles", kind: "link" },
      });
    }

    return items;
  },
};

