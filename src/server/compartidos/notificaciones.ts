import { consultar, consultarUna } from "@/lib/db";

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

/**
 * Guarda o reactiva una suscripción de Web Push para un usuario.
 */
export async function registrarSuscripcionPush(
  usuarioId: string,
  sub: PushSubscriptionInput,
): Promise<void> {
  await consultar(
    `INSERT INTO public.usuario_push_subscription (
       usuario_id, endpoint, p256dh, auth, user_agent, activa
     ) VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (endpoint) DO UPDATE
        SET usuario_id = EXCLUDED.usuario_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            user_agent = coalesce(EXCLUDED.user_agent, usuario_push_subscription.user_agent),
            activa = true,
            updated_at = now()`,
    [usuarioId, sub.endpoint, sub.p256dh, sub.auth, sub.userAgent ?? null],
  );
}

/**
 * Desactiva una suscripción cuando el usuario revoca permisos o el endpoint caduca.
 */
export async function desactivarSuscripcionPush(endpoint: string): Promise<void> {
  await consultar(
    `UPDATE public.usuario_push_subscription
        SET activa = false, updated_at = now()
      WHERE endpoint = $1`,
    [endpoint],
  );
}

/**
 * Envía una notificación interna y la encola para Web Push.
 */
export async function notificarUsuario({
  usuarioId,
  titulo,
  mensaje,
  tipo = "info",
  enlace,
}: {
  usuarioId: string;
  titulo: string;
  mensaje: string;
  tipo?: string;
  enlace?: string | null;
}): Promise<string> {
  const fila = await consultarUna<{ id: string }>(
    `INSERT INTO public.notificacion (usuario_id, titulo, mensaje, tipo, enlace)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [usuarioId, titulo, mensaje, tipo, enlace ?? null],
  );

  return fila?.id ?? "";
}

/**
 * Encola un correo transaccional en la cola asíncrona.
 */
export async function encolarCorreo({
  destinatario,
  asunto,
  cuerpoHtml,
  cuerpoTexto,
  adjuntos,
}: {
  destinatario: string;
  asunto: string;
  cuerpoHtml: string;
  cuerpoTexto?: string;
  adjuntos?: unknown;
}): Promise<string> {
  const fila = await consultarUna<{ id: string }>(
    `INSERT INTO public.correo_cola (
       destinatario, asunto, cuerpo_html, cuerpo_texto, adjuntos
     ) VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      destinatario,
      asunto,
      cuerpoHtml,
      cuerpoTexto ?? null,
      adjuntos ? JSON.stringify(adjuntos) : null,
    ],
  );

  return fila?.id ?? "";
}
