/**
 * Destino de después del acceso, tomado de `?next=`.
 *
 * El valor llega de la URL, o sea que es texto ajeno: solo se acepta una ruta interna.
 * Sin esto `?next=https://otro-sitio` convertiría el login en un salto abierto
 * (phishing con el dominio real de la Fundación delante). Se rechazan también `//host`
 * y `/\host`, que el navegador lee como un host externo, y cualquier carácter de control.
 */
export function destinoSeguro(pedido: string | null | undefined, porDefecto = "/inicio"): string {
  if (!pedido || typeof pedido !== "string") return porDefecto;
  if (!pedido.startsWith("/") || pedido.startsWith("//") || pedido.startsWith("/\\")) return porDefecto;
  if (/[\u0000-\u001f\u007f\\]/.test(pedido)) return porDefecto;

  // Volver al login con sesión abierta sería un bucle.
  if (/^\/(en\/)?(login|recuperar)(\/|\?|#|$)/.test(pedido)) return porDefecto;

  return pedido;
}
