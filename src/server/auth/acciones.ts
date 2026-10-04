"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";

import { redirigir } from "@/i18n/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { PORTAL_POR_ROL } from "@/lib/rbac";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Estado que la acción de inicio de sesión devuelve al formulario.
 *
 * `error` es una CLAVE de `messages.auth`, no un mensaje: los textos los
 * traduce el cliente. Nunca lleva el mensaje crudo de Supabase, que distingue
 * "contraseña incorrecta" de "usuario inexistente" y con eso permitiría
 * averiguar qué correos están registrados.
 */
export type EstadoLogin = { error?: string };

/**
 * Inicia sesión con correo y contraseña.
 *
 * Autenticarse no basta para entrar: el acceso es solo por invitación, así que
 * después se comprueba que exista fila en `usuario`, esté activa y tenga un rol
 * conocido. Si no la hay se cierra la sesión recién abierta —dejarla viva
 * daría una sesión de Supabase válida sin sitio al que ir— y se responde con
 * `notRegistered`.
 */
export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");

  if (!email || !password) return { error: "required" };

  const locale = await getLocale();
  const supabase = await crearClienteServidor();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "invalidCredentials" };

  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    await supabase.auth.signOut();
    return { error: "notRegistered" };
  }

  // El portal de destino lo decide el rol, no la puerta por la que se entró.
  revalidatePath("/", "layout");
  redirigir(PORTAL_POR_ROL[usuario.rol], locale);
}

/**
 * Cierra la sesión y devuelve al login.
 *
 * `revalidatePath("/", "layout")` limpia la caché del router: sin ella, volver
 * atrás en el navegador mostraría las páginas del usuario anterior tomadas de
 * la caché de cliente, aunque la sesión ya no valga.
 */
export async function cerrarSesion() {
  const locale = await getLocale();
  const supabase = await crearClienteServidor();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirigir("/login", locale);
}
