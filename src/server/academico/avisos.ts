import { consultar } from "@/lib/db";
import { notificarUsuario } from "@/server/compartidos/notificaciones";

export type RiesgoAcademico = { estudianteId: string; nombre: string; tipo: "periodo" | "acumulado"; indice: number; umbral: number };

/**
 * Avisar a administración cuando un estudiante cae en riesgo académico: llega a la
 * campana de cada administrativo (admin y super_admin) con un enlace al expediente, sin
 * que nadie tenga que abrir ficha por ficha.
 *
 * No se repite: si ese administrativo ya recibió el mismo aviso del mismo estudiante en
 * los últimos 7 días, no se vuelve a mandar (subir las notas de varios cuatrimestres
 * seguidos llenaría la campana). Un fallo aquí nunca debe impedir guardar las notas.
 */
export async function avisarRiesgoAcademico(riesgos: readonly RiesgoAcademico[]): Promise<void> {
  if (riesgos.length === 0) return;

  try {
    const admins = await consultar<{ id: string }>(
      `SELECT u.id FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.activo AND r.nombre IN ('admin', 'super_admin')`,
    );

    for (const r of riesgos) {
      const enlace = `/expedientes/${r.estudianteId}`;
      const titulo = r.tipo === "periodo" ? "Índice del período por debajo del mínimo" : "Índice acumulado por debajo del mínimo";
      const mensaje = `${r.nombre}: índice ${r.indice.toFixed(2)}, el mínimo es ${r.umbral.toFixed(2)}. Conviene hablar con el estudiante.`;

      for (const a of admins) {
        const ya = await consultar(
          `SELECT 1 FROM notificacion WHERE usuario_id = $1 AND enlace = $2 AND titulo = $3 AND created_at > now() - interval '7 days' LIMIT 1`,
          [a.id, enlace, titulo],
        );

        if (ya.length === 0) await notificarUsuario({ usuarioId: a.id, titulo, mensaje, tipo: "alerta", enlace });
      }
    }
  } catch (error) {
    console.error("[academico] no se pudo avisar del riesgo académico", error);
  }
}
