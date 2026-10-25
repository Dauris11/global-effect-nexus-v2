import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { refrescarSesion } from "@/lib/supabase/proxy";

/**
 * Proxy de Next.js 16 (lo que hasta la 15 era `middleware.ts`).
 *
 * Hace dos cosas, en este orden:
 *   1. next-intl resuelve el idioma y, si hace falta, redirige.
 *   2. Supabase refresca la sesión sobre esa misma respuesta.
 *
 * El orden importa: si Supabase escribiera cookies en una respuesta que
 * next-intl luego reemplaza por una redirección, la sesión renovada se
 * perdería.
 *
 * Aquí no se decide quién entra a dónde. Proteger rutas en el proxy es
 * frágil —depende de leer bien la URL— así que cada layout de portal valida
 * el rol contra la base de datos.
 */
const manejarIdioma = createMiddleware(routing);

export default async function proxy(original: NextRequest) {
  // La ruta viaja como cabecera para que el layout del portal pueda aplicar los
  // bloqueos de visibilidad: un layout no sabe en qué ruta está. No decide nada
  // aquí; solo la anota.
  const cabeceras = new Headers(original.headers);

  cabeceras.set("x-ruta", original.nextUrl.pathname);

  const request = new NextRequest(original, { headers: cabeceras });
  const respuesta = manejarIdioma(request);

  return refrescarSesion(request, respuesta);
}

export const config = {
  /**
   * Todo menos las rutas de API, los assets internos de Next y cualquier
   * archivo con extensión (imágenes, fuentes, favicon…).
   */
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
