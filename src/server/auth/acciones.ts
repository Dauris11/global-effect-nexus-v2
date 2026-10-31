"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirigir } from "@/i18n/navigation";
import { registrar } from "@/lib/auditoria";
import { COOKIE_VER_COMO, obtenerUsuarioActual } from "@/lib/auth";
import { esRol, PORTAL_POR_ROL } from "@/lib/rbac";
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

  if (error) {
    // Sin cuenta no hay autor: queda el correo intentado, recortado. Sirve para
    // ver quién prueba claves, y solo lo ve quien audita.
    await registrar({
      usuarioId: null,
      accion: "sesion.fallida",
      entidad: "sesion",
      datos: { email: email.slice(0, 80).toLowerCase() },
    });

    return { error: "invalidCredentials" };
  }

  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    await supabase.auth.signOut();
    return { error: "notRegistered" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "sesion.iniciada",
    entidad: "sesion",
    datos: { rol: usuario.rol },
  });

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
  const usuario = await obtenerUsuarioActual();

  // Antes de cerrar: después ya no se sabe quién era.
  if (usuario) {
    await registrar({ usuarioId: usuario.id, accion: "sesion.cerrada", entidad: "sesion" });
  }

  await supabase.auth.signOut();
  (await cookies()).delete(COOKIE_VER_COMO);

  revalidatePath("/", "layout");
  redirigir("/login", locale);
}

/**
 * El administrador maestro se pone en el lugar de otro rol para revisar lo que
 * ve. Se comprueba el rol REAL: estando ya «como docente», el efectivo es
 * docente y aun así debe poder saltar a otro o volver.
 *
 * Queda en la auditoría, porque mientras dure actúa con la cuenta propia pero
 * con los permisos de otro y conviene poder reconstruirlo.
 */
export async function verComoRol(rol: string) {
  const locale = await getLocale();
  const usuario = await obtenerUsuarioActual();

  if (!usuario || usuario.rolReal !== "super_admin" || !esRol(rol)) {
    redirigir("/login", locale);
  }

  const almacen = await cookies();

  if (rol === "super_admin") {
    almacen.delete(COOKIE_VER_COMO);
  } else {
    // De sesión de navegador y con 8 h de tope: que no se quede olvidado días.
    almacen.set(COOKIE_VER_COMO, rol, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  await registrar({
    usuarioId: usuario.id,
    accion: rol === "super_admin" ? "sesion.ver_como_fin" : "sesion.ver_como",
    entidad: "sesion",
    datos: { rol },
  });

  revalidatePath("/", "layout");
  redirigir(PORTAL_POR_ROL[rol], locale);
}
