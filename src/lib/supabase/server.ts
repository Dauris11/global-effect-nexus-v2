import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Hay que crearlo por petición (nunca guardarlo en una variable de módulo):
 * lleva las cookies de sesión de quien hace la petición, y compartirlo entre
 * peticiones filtraría la sesión de un usuario a otro.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient(
    requerido("NEXT_PUBLIC_SUPABASE_URL"),
    requerido("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesNuevas) {
          try {
            for (const { name, value, options } of cookiesNuevas) {
              almacenCookies.set(name, value, options);
            }
          } catch {
            // Los Server Components de solo lectura no pueden escribir cookies.
            // No es un fallo: el refresco de sesión ya lo hace `src/proxy.ts`.
          }
        },
      },
    },
  );
}

function requerido(clave: string): string {
  const valor = process.env[clave];

  if (!valor) {
    throw new Error(`Falta la variable de entorno ${clave} (ver .env.example).`);
  }

  return valor;
}
