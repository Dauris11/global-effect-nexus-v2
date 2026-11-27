import { consultar } from "@/lib/db";

import { diaComoFecha, type ItemCrudo, type Proveedor } from "../tipos";

/**
 * Habitudes (facilitadores y dirección):
 *   · visita_hoy: visitas que dejé en borrador y hay que cerrar.
 *   · visita_semana: liceos que tengo asignados y aún no visité esta semana (vence el viernes).
 *   · evidencia_faltante: visitas registradas sin fotos. Dirección ve las de todo el equipo.
 */
export const proveedorHabitudes: Proveedor = {
  nombre: "habitudes",
  tipos: ["visita_hoy", "visita_semana", "evidencia_faltante"],
  async getItems({ userId, rol, hoy }) {
    const dirige = rol === "dir_habitudes" || rol === "super_admin";
    const [borradores, sinVisitar, sinFotos] = await Promise.all([
      consultar<{ id: string; liceo: string; creado: string }>(
        `SELECT v.id, l.nombre AS liceo, v.creado_en::text AS creado
           FROM habitudes_visita_evidencia v JOIN habitudes_liceo l ON l.id = v.liceo_id
          WHERE v.estado = 'borrador' AND v.facilitador_id = $1 ORDER BY v.creado_en LIMIT 20`,
        [userId],
      ),
      consultar<{ id: string; liceo: string; viernes: string }>(
        `SELECT l.id, l.nombre AS liceo,
                (date_trunc('week', $2::date)::date + 4)::text AS viernes
           FROM habitudes_liceo_profesor hp
           JOIN habitudes_liceo l ON l.id = hp.liceo_id
          WHERE hp.profesor_id = $1 AND hp.activo AND l.activo
            AND NOT EXISTS (SELECT 1 FROM habitudes_visita_evidencia v
                             WHERE v.liceo_id = l.id AND v.facilitador_id = $1 AND v.estado <> 'borrador'
                               AND v.fecha_visita >= date_trunc('week', $2::date)::date)
          ORDER BY l.nombre LIMIT 20`,
        [userId, hoy],
      ),
      consultar<{ id: string; liceo: string; facilitador: string; facilitador_id: string; fecha: string; creado: string }>(
        `SELECT v.id, l.nombre AS liceo, u.nombre AS facilitador, v.facilitador_id, v.fecha_visita::text AS fecha, v.creado_en::text AS creado
           FROM habitudes_visita_evidencia v
           JOIN habitudes_liceo l ON l.id = v.liceo_id JOIN usuario u ON u.id = v.facilitador_id
          WHERE v.estado <> 'borrador' AND coalesce(array_length(v.fotos_urls, 1), 0) = 0
            AND ($2 OR v.facilitador_id = $1)
          ORDER BY v.fecha_visita LIMIT 30`,
        [userId, dirige],
      ),
    ]);

    const items: ItemCrudo[] = [];
    for (const b of borradores) {
      items.push({
        id: `visita_hoy:${b.id}`, tipo: "visita_hoy", titulo: `Terminar la visita a ${b.liceo}`, contexto: "Visita en borrador",
        modulo: "habitudes", href: "/habitudes/visitas/nueva", venceEn: diaComoFecha(hoy), creadoEn: new Date(b.creado),
        responsableId: userId, accion: { label: "Registrar visita", kind: "link" },
      });
    }
    for (const l of sinVisitar) {
      items.push({
        id: `visita_semana:${l.id}`, tipo: "visita_semana", titulo: `Visitar ${l.liceo}`, contexto: "Sin visita esta semana",
        modulo: "habitudes", href: "/habitudes/visitas/nueva", venceEn: diaComoFecha(l.viernes),
        responsableId: userId, accion: { label: "Registrar visita", kind: "link" },
      });
    }
    for (const v of sinFotos) {
      const mia = v.facilitador_id === userId;
      items.push({
        id: `evidencia_faltante:${v.id}`, tipo: "evidencia_faltante",
        titulo: mia ? `Subir fotos de la visita a ${v.liceo}` : `Pedir fotos de la visita a ${v.liceo}`,
        contexto: mia ? `Visita del ${v.fecha}` : `${v.facilitador} · visita del ${v.fecha}`,
        modulo: "habitudes", href: "/habitudes/evidencias", creadoEn: new Date(v.creado), bloquea: !mia,
        // Lo mío es mío; lo del equipo lo atiende quien dirige (sin responsable, rige la casilla).
        responsableId: mia ? userId : undefined,
        accion: { label: mia ? "Subir fotos" : "Revisar", kind: "link" },
      });
    }

    return items;
  },
};
