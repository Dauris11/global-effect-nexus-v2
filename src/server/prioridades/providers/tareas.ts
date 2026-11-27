import { consultar } from "@/lib/db";
import type { PrioridadTarea } from "@/lib/prioridades/types";

import { diaComoFecha, type ItemCrudo, type Proveedor } from "../tipos";

type Fila = {
  id: string;
  titulo: string;
  prioridad: string | null;
  limite: string;
  creada: string;
  proyecto: string | null;
  usuario_id: string;
  asignado: string | null;
};

const PRIORIDADES: readonly PrioridadTarea[] = ["urgente", "alta", "media", "baja"];

/**
 * Tareas asignadas a mí (vencidas, de hoy y de los próximos 30 días). Dirección recibe además las de
 * OTRAS personas con más de 3 días de atraso, para que el motor las escale.
 */
export const proveedorTareas: Proveedor = {
  nombre: "tareas",
  tipos: ["tarea_vencida", "tarea_hoy", "tarea_semana"],
  async getItems({ userId, rol, hoy }) {
    const filas = await consultar<Fila>(
      `SELECT t.id, t.titulo, t.prioridad, t.fecha_limite::text AS limite, t.created_at::text AS creada,
              p.nombre AS proyecto, ta.usuario_id, u.nombre AS asignado
         FROM tarea t
         JOIN tarea_asignado ta ON ta.tarea_id = t.id
         JOIN usuario u ON u.id = ta.usuario_id
         LEFT JOIN proyecto p ON p.id = t.proyecto_id
        WHERE t.estado NOT IN ('completada', 'cancelada')
          AND t.fecha_limite IS NOT NULL
          AND (
                (ta.usuario_id = $1 AND t.fecha_limite <= $3::date + 30)
             OR ($2 AND t.fecha_limite < $3::date - 3)
              )
        ORDER BY t.fecha_limite
        LIMIT 300`,
      [userId, rol === "super_admin", hoy],
    );

    // Una tarea con varias personas asignadas sale una vez; si una soy yo, gana la mía.
    const porId = new Map<string, Fila>();
    for (const f of filas) if (!porId.has(f.id) || f.usuario_id === userId) porId.set(f.id, f);

    return [...porId.values()].map((f): ItemCrudo => {
      const tipo = f.limite < hoy ? "tarea_vencida" : f.limite === hoy ? "tarea_hoy" : "tarea_semana";
      const mia = f.usuario_id === userId;
      const prioridad = PRIORIDADES.find((p) => p === f.prioridad);

      return {
        id: `${tipo}:${f.id}`,
        tipo,
        titulo: `Terminar «${f.titulo}»`,
        contexto: [f.proyecto ?? "Tarea", mia ? null : f.asignado].filter(Boolean).join(" · "),
        modulo: "tareas",
        href: "/administrativo/tareas",
        venceEn: diaComoFecha(f.limite),
        creadoEn: new Date(f.creada),
        prioridadTarea: prioridad,
        responsableId: f.usuario_id,
        accion: { label: "Marcar hecha", kind: "inline", action: "tarea:hecha" },
        accionSecundaria: { label: "Posponer", action: "posponer" },
      };
    });
  },
};
