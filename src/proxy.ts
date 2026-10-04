import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

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

export default async function proxy(request: NextRequest) {
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
