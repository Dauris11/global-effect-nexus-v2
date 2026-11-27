import { consultar } from "@/lib/db";

import { diaComoFecha, type Proveedor } from "../tipos";

/** Proyecto atrasado: su fecha de fin pasó y el avance no llegó a 100 %. Responsable = quien lo lidera. */
export const proveedorProyectos: Proveedor = {
  nombre: "proyectos",
  tipos: ["proyecto_atrasado"],
  async getItems({ hoy }) {
    const filas = await consultar<{ id: string; nombre: string; fin: string; progreso: number; creado: string; responsable_id: string | null }>(
      `SELECT id, nombre, fecha_fin::text AS fin, coalesce(progreso, 0) AS progreso, created_at::text AS creado, responsable_id
         FROM proyecto
        WHERE fecha_fin < $1::date AND coalesce(progreso, 0) < 100 AND estado <> 'completado'
        ORDER BY fecha_fin
        LIMIT 100`,
      [hoy],
    );

    return filas.map((f) => ({
      id: `proyecto_atrasado:${f.id}`,
      tipo: "proyecto_atrasado" as const,
      titulo: `Reprogramar «${f.nombre}»`,
      contexto: `Proyecto · avance ${f.progreso} %`,
      modulo: "proyectos",
      href: "/administrativo/proyectos",
      venceEn: diaComoFecha(f.fin),
      creadoEn: new Date(f.creado),
      responsableId: f.responsable_id ?? undefined,
      accion: { label: "Abrir proyecto", kind: "link" as const },
    }));
  },
};
