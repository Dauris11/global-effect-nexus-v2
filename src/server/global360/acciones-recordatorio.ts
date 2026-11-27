"use server";

import { requerirPermiso } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { notificarUsuario } from "@/server/compartidos/notificaciones";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * «Recordar»: avisa al estudiante (campana y push) que la prematrícula sigue abierta y aún no eligió.
 * Solo a quien tiene cuenta, y solo si la ventana está abierta de verdad (no se manda un aviso que ya no sirve).
 */
export async function recordarPrematricula(estudianteId: string): Promise<{ ok: boolean; error?: "sin_cuenta" | "sin_ventana" | "invalido" }> {
  await requerirPermiso("academico.escribir");
  if (!UUID.test(estudianteId)) return { ok: false, error: "invalido" };

  const fila = await consultarUna<{ usuario_id: string | null; cierra: string | null }>(
    `SELECT e.usuario_id,
            (SELECT to_char(v.cierra AT TIME ZONE 'America/Santo_Domingo', 'DD/MM HH24:MI')
               FROM ventana_prematricula v WHERE v.activa AND now() BETWEEN v.abre AND v.cierra
              ORDER BY v.cierra LIMIT 1) AS cierra
       FROM estudiante e WHERE e.id = $1`,
    [estudianteId],
  );
  if (!fila?.usuario_id) return { ok: false, error: "sin_cuenta" };
  if (!fila.cierra) return { ok: false, error: "sin_ventana" };

  await notificarUsuario({
    usuarioId: fila.usuario_id,
    titulo: "Elige tus materias",
    mensaje: `La prematrícula cierra el ${fila.cierra} y aún no has elegido.`,
    tipo: "aviso",
    enlace: "/portal/estudiante/prematricula",
  });

  return { ok: true };
}
