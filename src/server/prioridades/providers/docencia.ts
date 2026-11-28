import { entregasDelDocente } from "@/server/profesor/consultas";

import type { Proveedor } from "../tipos";

/**
 * Docencia: las entregas sin nota, agrupadas por tarea («Calificar 5 entregas de X»). Solo las clases
 * de ESTA persona: la coordinación académica tiene su propia lista en «Por calificar».
 */
export const proveedorDocencia: Proveedor = {
  nombre: "docencia",
  tipos: ["entrega_por_calificar"],
  async getItems({ userId }) {
    const filas = await entregasDelDocente(userId);
    const porTarea = new Map<string, { titulo: string; unidad: string; n: number; masVieja: Date | null }>();

    for (const f of filas) {
      if (f.estado === "calificado") continue;
      const g = porTarea.get(f.asignacion_id) ?? { titulo: f.asignacion, unidad: f.unidad, n: 0, masVieja: null };
      g.n += 1;
      if (f.fecha_entrega && (!g.masVieja || f.fecha_entrega < g.masVieja)) g.masVieja = f.fecha_entrega;
      porTarea.set(f.asignacion_id, g);
    }

    return [...porTarea.entries()].map(([id, g]) => ({
      id: `entrega_por_calificar:${id}`,
      tipo: "entrega_por_calificar" as const,
      titulo: `Calificar ${g.n} ${g.n === 1 ? "entrega" : "entregas"} de «${g.titulo}»`,
      contexto: g.unidad,
      modulo: "docencia",
      href: `/portal/profesor/entregas?tarea=${id}`,
      cantidad: g.n,
      grupoClave: g.unidad,
      contextoGrupo: g.unidad,
      creadoEn: g.masVieja ?? undefined,
      bloquea: true,
      responsableId: userId,
      accion: { label: "Calificar", kind: "link" as const },
    }));
  },
};
