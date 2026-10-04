"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador.
 *
 * Solo usa la clave publicable, que es de exposición pública por diseño; la
 * clave secreta (`SUPABASE_SECRET_KEY`) jamás debe aparecer en un módulo
 * cliente. Sirve para iniciar sesión y para cerrar sesión desde la interfaz;
 * los datos se leen en el servidor.
 */
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
