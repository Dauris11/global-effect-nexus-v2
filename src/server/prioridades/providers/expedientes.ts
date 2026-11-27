import { consultar } from "@/lib/db";

import type { ItemCrudo, Proveedor } from "../tipos";

/**
 * Expedientes: lo que está incompleto y los becados sin patrocinador. (Las altas por revisar viven
 * en el proveedor de solicitudes; el riesgo académico y la renovación de beca quedan pendientes.)
 */
export const proveedorExpedientes: Proveedor = {
  nombre: "expedientes",
  tipos: ["expediente_incompleto", "becado_sin_patrocinador"],
  async getItems() {
    const [incompletos, sinPatrocinador] = await Promise.all([
      consultar<{ id: string; nombre: string; creado: string; falta: string }>(
        `SELECT id, nombre, created_at::text AS creado,
                concat_ws(', ',
                  CASE WHEN universidad_id IS NULL THEN 'universidad' END,
                  CASE WHEN carrera_id IS NULL THEN 'carrera' END,
                  CASE WHEN usuario_id IS NULL THEN 'cuenta' END) AS falta
           FROM estudiante
          WHERE estado IN ('activo', 'postulado', 'academia_liderazgo')
            AND (universidad_id IS NULL OR carrera_id IS NULL OR usuario_id IS NULL)
          ORDER BY created_at
          LIMIT 50`,
      ),
      consultar<{ id: string; nombre: string; creado: string }>(
        `SELECT id, nombre, created_at::text AS creado
           FROM estudiante
          WHERE estado = 'activo' AND patrocinador_id IS NULL
          ORDER BY created_at
          LIMIT 50`,
      ),
    ]);

    return [
      ...incompletos.map((f): ItemCrudo => ({
        id: `expediente_incompleto:${f.id}`,
        tipo: "expediente_incompleto",
        titulo: `Completar expediente de ${f.nombre}`,
        contexto: `Falta ${f.falta}`,
        modulo: "expedientes",
        href: `/expedientes/${f.id}`,
        creadoEn: new Date(f.creado),
        accion: { label: "Completar", kind: "link" },
      })),
      ...sinPatrocinador.map((f): ItemCrudo => ({
        id: `becado_sin_patrocinador:${f.id}`,
        tipo: "becado_sin_patrocinador",
        titulo: `Asignar patrocinador a ${f.nombre}`,
        contexto: "Becado activo sin patrocinador",
        modulo: "expedientes",
        href: `/expedientes/${f.id}`,
        creadoEn: new Date(f.creado),
        accion: { label: "Asignar patrocinador", kind: "link" },
      })),
    ];
  },
};
