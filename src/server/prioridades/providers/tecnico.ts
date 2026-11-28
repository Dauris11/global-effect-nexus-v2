import { consultar } from "@/lib/db";

import type { ItemCrudo, Proveedor } from "../tipos";

/**
 * Pendientes TÉCNICOS: solo los recibe el developer (ver `TIPOS_TECNICOS` y `esVisible`).
 *
 *   · job_fallido: correos que la cola no pudo enviar (`correo_cola.estado = 'fallido'`, últimos 14 días).
 *   · error_produccion: PENDIENTE DE FUENTE. Hoy el sistema no guarda errores de producción en ninguna tabla
 *     (solo salen a `console.error`/logs de Vercel), así que no hay de dónde leer: devuelve vacío. Cuando exista
 *     un registro de errores (p. ej. `error_log`), se lee aquí sin tocar el motor.
 *   · integracion_caida: PENDIENTE DE FUENTE, igual: no hay una tabla de salud de integraciones (Resend,
 *     Supabase, proveedores de IA) que consultar. Devuelve vacío.
 */
export const proveedorTecnico: Proveedor = {
  nombre: "tecnico",
  tipos: ["error_produccion", "job_fallido", "integracion_caida"],
  async getItems({ rol }) {
    // No se consulta nada para quien no es developer: la visibilidad ya lo filtraría, pero así ni se lee la cola.
    if (rol !== "developer") return [];

    const fallidos = await consultar<{ id: string; destinatario: string; asunto: string; error: string | null; creado: string }>(
      `SELECT id, destinatario, asunto, ultimo_error AS error, created_at::text AS creado
         FROM public.correo_cola
        WHERE estado = 'fallido' AND created_at > now() - interval '14 days'
        ORDER BY created_at DESC
        LIMIT 20`,
    );

    return fallidos.map<ItemCrudo>((f) => ({
      id: `job_fallido:${f.id}`,
      tipo: "job_fallido",
      titulo: `Correo sin enviar a ${f.destinatario}`,
      contexto: f.error ? `${f.asunto} · ${f.error.slice(0, 80)}` : f.asunto,
      modulo: "tecnico",
      href: "/configuracion/actividad",
      creadoEn: new Date(f.creado),
      accion: { label: "Revisar", kind: "link" },
    }));
  },
};
