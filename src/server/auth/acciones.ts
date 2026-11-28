"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirigir } from "@/i18n/navigation";
import { registrar } from "@/lib/auditoria";
import { COOKIE_VER_COMO, obtenerUsuarioActual } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { destinoSeguro } from "@/lib/destino-seguro";
import { ipDeCabeceras, permitirFrecuencia } from "@/lib/frecuencia";
import { esRol, esRolTotal, PORTAL_POR_ROL } from "@/lib/rbac";
import { puedeVerComo } from "@/lib/roles";
import {
  COOKIE_SUPLANTACION_CONFIRMADA,
  COOKIE_VER_COMO_USUARIO,
  DURACION_SUPLANTACION_S,
  firmarSuplantacion,
  secretoSuplantacion,
} from "@/lib/suplantacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { motivoSinAcceso } from "@/server/auth/sin-acceso";
import { impersonationWriteActivo } from "@/server/parametros/tecnicos";

/** Claves de `messages.auth` que puede devolver el login. */
export type ErrorLogin =
  | "required"
  | "invalidCredentials"
  | "notRegistered"
  | "inactive"
  | "unconfirmed"
  | "tooManyAttempts"
  | "offline";

/**
 * Estado que la acción de inicio de sesión devuelve al formulario.
 *
 * `error` es una CLAVE de `messages.auth`, no un mensaje: los textos los
 * traduce el cliente. Nunca lleva el mensaje crudo de Supabase, que distingue
 * "contraseña incorrecta" de "usuario inexistente" y con eso permitiría
 * averiguar qué correos están registrados.
 *
 * `intento` cambia en cada respuesta: así el cliente repite la sacudida y el foco
 * aunque el error sea el mismo que el anterior (el objeto de estado ya es nuevo,
 * pero esto lo hace explícito y sirve de `key`).
 */
export type EstadoLogin = { error?: ErrorLogin; intento?: number; esperaS?: number };

/** Cupo de intentos por IP + correo y su ventana (punto 5 del rediseño del login). */
const INTENTOS_POR_VENTANA = 5;
const VENTANA_MS = 60_000;

/**
 * Inicia sesión con correo y contraseña.
 *
 * Autenticarse no basta para entrar: el acceso es solo por invitación, así que
 * después se comprueba que exista fila en `usuario`, esté activa y tenga un rol
 * conocido. Si no la hay se cierra la sesión recién abierta —dejarla viva
 * daría una sesión de Supabase válida sin sitio al que ir— y se responde con
 * `notRegistered` o `inactive`; esos dos solo salen tras una contraseña correcta.
 *
 * El límite de tasa va ANTES de hablar con Supabase y cuenta todos los intentos de la
 * misma IP + correo: frena la fuerza bruta sobre una cuenta sin bloquear a una oficina
 * entera detrás de una IP compartida. Es en memoria (`permitirFrecuencia`): protege por
 * instancia del servidor, no es un contador global.
 */
export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");
  const destino = destinoSeguro(String(datos.get("next") ?? ""));
  const intento = Date.now();

  if (!email || !password) return { error: "required", intento };

  const ip = ipDeCabeceras(await headers());

  if (!permitirFrecuencia(`login:${ip}:${email.toLowerCase()}`, INTENTOS_POR_VENTANA, VENTANA_MS)) {
    return { error: "tooManyAttempts", intento, esperaS: VENTANA_MS / 1000 };
  }

  const locale = await getLocale();
  const supabase = await crearClienteServidor();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Sin conexión con Supabase no hay veredicto sobre la contraseña: no es «credenciales inválidas».
    if (error.name === "AuthRetryableFetchError" || error.status === 0) return { error: "offline", intento };

    // Supabase solo da este código con la contraseña ya validada, así que no revela cuentas ajenas.
    if (error.code === "email_not_confirmed") return { error: "unconfirmed", intento };

    // El límite propio de Supabase se muestra igual que el nuestro.
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return { error: "tooManyAttempts", intento, esperaS: VENTANA_MS / 1000 };
    }

    // Sin cuenta no hay autor: queda el correo intentado, recortado. Sirve para
    // ver quién prueba claves, y solo lo ve quien audita.
    await registrar({
      usuarioId: null,
      accion: "sesion.fallida",
      entidad: "sesion",
      datos: { email: email.slice(0, 80).toLowerCase() },
    });

    return { error: "invalidCredentials", intento };
  }

  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    const { data } = await supabase.auth.getUser();
    const motivo = data.user ? await motivoSinAcceso(data.user.id) : "notRegistered";

    await supabase.auth.signOut();
    return { error: motivo, intento };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "sesion.iniciada",
    entidad: "sesion",
    datos: { rol: usuario.rol },
  });

  // Sin `?next=` el destino lo decide el rol, no la puerta por la que se entró.
  revalidatePath("/", "layout");
  redirigir(destino === "/inicio" ? PORTAL_POR_ROL[usuario.rol] : destino, locale);
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
  const almacenSalida = await cookies();
  almacenSalida.delete(COOKIE_VER_COMO);
  almacenSalida.delete(COOKIE_VER_COMO_USUARIO);
  almacenSalida.delete(COOKIE_SUPLANTACION_CONFIRMADA);

  revalidatePath("/", "layout");
  redirigir("/login", locale);
}

const OPCIONES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DURACION_SUPLANTACION_S,
};

/**
 * Owner o developer se ponen en el lugar de otro ROL para revisar lo que ve. Se comprueba el rol REAL (estando
 * ya «como docente» el efectivo es docente y aun así debe poder saltar a otro o volver) y la lista permitida
 * `puedeVerComo`: el developer puede ver como Propietario; el owner no (ya lo es) y nadie ve como developer.
 * Pedir el propio rol real equivale a «Volver a mi vista».
 *
 * Queda en la auditoría: inicio (`sesion.ver_como`), cambio de un rol a otro (`sesion.ver_como_cambio`, con
 * desde/hacia) y fin (`sesion.ver_como_fin`), siempre a nombre de la cuenta REAL.
 */
export async function verComoRol(rol: string) {
  const locale = await getLocale();
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !esRolTotal(usuario.rolReal) || !esRol(rol)) {
    redirigir("/login", locale);
  }

  const volver = rol === usuario.rolReal;

  if (!volver && !puedeVerComo(usuario.rolReal, rol)) {
    redirigir(PORTAL_POR_ROL[usuario.rol], locale);
  }

  const almacen = await cookies();
  // Lo que se estaba mirando antes: otro rol, una persona o nada.
  const desde = usuario.suplantando ? { usuario: usuario.id } : usuario.rol !== usuario.rolReal ? { rol: usuario.rol } : null;

  // Un solo modo a la vez: ver como un rol apaga «Ver como usuario…».
  almacen.delete(COOKIE_VER_COMO_USUARIO);
  almacen.delete(COOKIE_SUPLANTACION_CONFIRMADA);

  if (volver) {
    almacen.delete(COOKIE_VER_COMO);
  } else {
    // De sesión de navegador y con 8 h de tope: que no se quede olvidado días.
    almacen.set(COOKIE_VER_COMO, rol, OPCIONES_COOKIE);
  }

  await registrar({
    usuarioId: usuario.realId,
    accion: volver ? "sesion.ver_como_fin" : desde ? "sesion.ver_como_cambio" : "sesion.ver_como",
    entidad: "sesion",
    datos: { rol, desde, rolReal: usuario.rolReal },
  });

  revalidatePath("/", "layout");
  redirigir(PORTAL_POR_ROL[volver ? usuario.rolReal : (rol as keyof typeof PORTAL_POR_ROL)], locale);
}

/**
 * «Ver como usuario…»: solo un developer REAL, a UNA persona activa que no sea developer. Guarda la cookie
 * firmada (`firmarSuplantacion`); `obtenerUsuarioActual` hace el resto. Mientras dura, las acciones que
 * escriben se bloquean (`exigirSinSuplantacion`) salvo que `tecnico.impersonation_write` esté activo y la
 * sesión lo confirme.
 */
export async function verComoUsuario(objetivoId: string) {
  const locale = await getLocale();
  const usuario = await obtenerUsuarioActual();

  if (!usuario || usuario.rolReal !== "developer") redirigir("/login", locale);

  const objetivo = await consultarUna<{ id: string; nombre: string; rol: string }>(
    `SELECT u.id, u.nombre, r.nombre AS rol
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.id = $1 AND u.activo AND r.nombre <> 'developer'`,
    [objetivoId],
  ).catch(() => null);

  if (!objetivo || objetivo.id === usuario.realId) redirigir(PORTAL_POR_ROL[usuario.rol], locale);

  const almacen = await cookies();

  almacen.delete(COOKIE_VER_COMO);
  almacen.delete(COOKIE_SUPLANTACION_CONFIRMADA);
  almacen.set(
    COOKIE_VER_COMO_USUARIO,
    firmarSuplantacion({ objetivoId: objetivo.id, realId: usuario.realId }, secretoSuplantacion()),
    OPCIONES_COOKIE,
  );

  await registrar({
    usuarioId: usuario.realId,
    accion: "sesion.ver_como_usuario",
    entidad: "sesion",
    entidadId: objetivo.id,
    datos: { objetivo: objetivo.id, nombre: objetivo.nombre, rol: objetivo.rol, escrituraPermitida: await impersonationWriteActivo() },
  });

  revalidatePath("/", "layout");
  redirigir("/inicio", locale);
}

/** Termina «Ver como usuario…» y devuelve a la vista propia. Queda en la auditoría. */
export async function salirVerComoUsuario() {
  const locale = await getLocale();
  const usuario = await obtenerUsuarioActual();

  if (!usuario || usuario.rolReal !== "developer") redirigir("/login", locale);

  const almacen = await cookies();

  almacen.delete(COOKIE_VER_COMO_USUARIO);
  almacen.delete(COOKIE_SUPLANTACION_CONFIRMADA);

  if (usuario.suplantando) {
    await registrar({
      usuarioId: usuario.realId,
      accion: "sesion.ver_como_usuario_fin",
      entidad: "sesion",
      entidadId: usuario.id,
      datos: { objetivo: usuario.id, nombre: usuario.nombre },
    });
  }

  revalidatePath("/", "layout");
  redirigir(PORTAL_POR_ROL[usuario.rolReal], locale);
}

/**
 * Con `tecnico.impersonation_write` activo, el developer confirma UNA vez por sesión que quiere que lo que haga
 * como esa persona se guarde (queda a su nombre real en la auditoría). Sin el parámetro no hace nada.
 */
export async function confirmarEscrituraSuplantada(): Promise<{ ok: boolean }> {
  const usuario = await obtenerUsuarioActual();

  if (!usuario?.suplantando || !(await impersonationWriteActivo())) return { ok: false };

  (await cookies()).set(COOKIE_SUPLANTACION_CONFIRMADA, usuario.id, OPCIONES_COOKIE);

  await registrar({
    usuarioId: usuario.realId,
    accion: "sesion.ver_como_escritura_confirmada",
    entidad: "sesion",
    entidadId: usuario.id,
    datos: { objetivo: usuario.id, nombre: usuario.nombre },
  });

  return { ok: true };
}
