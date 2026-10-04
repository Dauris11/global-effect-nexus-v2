import { NextResponse, type NextRequest } from "next/server";

import { obtenerUsuarioActual } from "@/lib/auth";
import { PORTAL_POR_ROL } from "@/lib/rbac";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Vuelta de OAuth: canjea el código por una sesión.
 *
 * Vive fuera de `[locale]` a propósito. La URL de retorno se registra en la
 * consola de Supabase y debe ser una sola y estable; si llevara prefijo de
 * idioma habría que registrar una por idioma.
 *
 * Igual que el login por contraseña, autenticarse no basta: sin fila en
 * `usuario` se cierra la sesión y se vuelve al login con el aviso.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const destinoPedido = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=notRegistered`);
  }

  /*
   * `next` llega de la URL, así que se trata como texto ajeno: solo se acepta
   * una ruta interna. Sin esta comprobación, un `next=https://otro-sitio`
   * convertiría el callback en un salto abierto a cualquier dominio.
   */
  const destino =
    destinoPedido && destinoPedido.startsWith("/") && !destinoPedido.startsWith("//")
      ? destinoPedido
      : PORTAL_POR_ROL[usuario.rol];

  return NextResponse.redirect(`${origin}${destino}`);
}
