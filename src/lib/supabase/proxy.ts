import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Refresca la sesión de Supabase en cada petición.
 *
 * Los tokens de acceso caducan en minutos. Sin este paso, un usuario con la
 * pestaña abierta un rato aparecería como no autenticado en el siguiente
 * Server Component. `getUser()` fuerza la renovación y `setAll` devuelve las
 * cookies nuevas al navegador a través de la respuesta que ya generó next-intl.
 *
 * Devuelve la misma respuesta recibida, con las cookies actualizadas.
 */
export async function refrescarSesion(
  request: NextRequest,
  respuesta: NextResponse,
): Promise<NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas) {
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();

  return respuesta;
}
