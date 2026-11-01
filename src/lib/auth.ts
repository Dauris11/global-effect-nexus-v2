import { cookies } from "next/headers";
import { cache } from "react";
import { getLocale } from "next-intl/server";

import { redirigir } from "@/i18n/navigation";
import { consultarUna } from "@/lib/db";
import {
  esPermiso,
  esRol,
  PORTAL_POR_ROL,
  usuarioTienePermiso,
  type ExcepcionPermiso,
  type Permiso,
  type Rol,
} from "@/lib/rbac";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Identidad de quien está usando el sistema.
 *
 * Se compone de dos fuentes: Supabase Auth dice *quién* es (credenciales,
 * sesión) y la tabla `usuario` dice *qué puede hacer* (rol, idioma, si sigue
 * activo). El enlace entre ambas es `usuario.auth_user_id`, que rellena el
 * trigger `handle_new_auth_user` de la migración 0016.
 *
 * Ese trigger solo *enlaza*, nunca crea: los usuarios se invitan desde
 * administración. Quien tenga sesión en Supabase pero ninguna fila en
 * `usuario` está autenticado y aun así no puede entrar.
 */

export type UsuarioSesion = {
  id: string;
  email: string;
  nombre: string;
  idioma: "es" | "en";
  /**
   * Rol EFECTIVO: el que decide menús, pantallas y permisos. Coincide con
   * `rolReal` salvo cuando el administrador maestro está «viendo como» otro rol.
   */
  rol: Rol;
  /** Rol que la cuenta tiene de verdad en la tabla `usuario`. */
  rolReal: Rol;
  authUserId: string;
  /**
   * RUTA de la foto en el bucket `avatares`, no una URL. Se convierte a URL con
   * `urlDeAvatar` en el servidor, donde se vaya a pintar. Viaja en la sesión
   * porque el armazón la necesita en TODAS las pantallas internas, y era una
   * columna más en una consulta que ya se hace en cada petición.
   */
  fotoUrl: string | null;
  /**
   * Excepciones de `usuario_permiso`. Viajan en la sesión porque el
   * permiso de contabilidad es de la persona, no del rol: un auxiliar con
   * `registrar` y sin `aprobar` tiene el mismo rol que quien aprueba.
   */
  excepciones: ExcepcionPermiso[];
};

type FilaUsuario = {
  id: string;
  email: string;
  nombre: string;
  idioma: string;
  activo: boolean;
  rol_nombre: string;
  foto_url: string | null;
  excepciones: { permiso: string; concedido: boolean }[];
};

/**
 * Devuelve al usuario actual, o `null` si no hay sesión válida.
 *
 * `null` cubre cuatro casos distintos a propósito: sin sesión, sin fila en
 * `usuario`, cuenta desactivada, o rol desconocido. Ninguno debe dar acceso,
 * y distinguirlos en la interfaz solo serviría para decirle a un desconocido
 * qué correos existen.
 */
/**
 * Cookie con la que el administrador maestro se pone en el lugar de otro rol.
 *
 * Solo se honra si el rol REAL de la cuenta es `super_admin`: a cualquier otra
 * persona la cookie no le hace nada, así que falsificarla no sube privilegios.
 * Y como el rol efectivo pasa a ser el de menos permisos, mientras se «ve como»
 * también se ACTÚA como ese rol: lo que no podría hacer él, tampoco aquí.
 */
export const COOKIE_VER_COMO = "ge_ver_como";

export const obtenerUsuarioActual = cache(obtenerUsuarioSinCache);

async function obtenerUsuarioSinCache(): Promise<UsuarioSesion | null> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const fila = await consultarUna<FilaUsuario>(
    `SELECT u.id,
            u.email::text AS email,
            u.nombre,
            u.idioma,
            u.activo,
            u.foto_url,
            r.nombre AS rol_nombre,
            -- En la misma consulta que ya se hace en cada petición, para
            -- no sumar un viaje a la base por las excepciones.
            coalesce((
              SELECT json_agg(json_build_object('permiso', p.codigo,
                                                'concedido', up.concedido))
                FROM usuario_permiso up
                JOIN permiso p ON p.id = up.permiso_id
               WHERE up.usuario_id = u.id
            ), '[]'::json) AS excepciones
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE u.auth_user_id = $1`,
    [user.id],
  );

  if (!fila || !fila.activo || !esRol(fila.rol_nombre)) return null;

  const rolReal = fila.rol_nombre;
  let rol: Rol = rolReal;
  let excepciones = fila.excepciones;

  if (rolReal === "super_admin") {
    const verComo = (await cookies()).get(COOKIE_VER_COMO)?.value;

    if (esRol(verComo) && verComo !== "super_admin") {
      rol = verComo;
      // Las excepciones son de la cuenta del administrador, no del rol que se
      // está mirando: mezclarlas enseñaría una pantalla que nadie de ese rol ve.
      excepciones = [];
    }
  }

  return {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    idioma: fila.idioma === "en" ? "en" : "es",
    rol,
    rolReal,
    authUserId: user.id,
    fotoUrl: fila.foto_url,
    excepciones: excepciones.flatMap((e) =>
      esPermiso(e.permiso) ? [{ permiso: e.permiso, concedido: e.concedido }] : [],
    ),
  };
}

/**
 * Exige sesión válida; si no la hay, manda al login.
 *
 * Redirige con el `redirect` de `@/i18n/navigation`, no con el de
 * `next/navigation`: el segundo pierde el prefijo de idioma y dejaría a quien
 * navega en inglés en un login en español.
 */
export async function requerirUsuario(): Promise<UsuarioSesion> {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    redirigir("/login", await getLocale());
  }

  return usuario;
}

/**
 * Exige un permiso concreto, no un rol.
 *
 * Es lo que necesitan los módulos compartidos: `/contabilidad` no es "de
 * contabilidad", es de quien tenga `finanzas.leer`, que hoy son ese rol y
 * `super_admin` y mañana puede ser otro. Comprobar el rol en esas pantallas
 * obligaría a repasarlas todas cada vez que cambie la tabla `rol_permiso`.
 *
 * A quien no lo tiene se le lleva a su portal, igual que en `requerirRol`: la
 * entrada del menú ya está filtrada por permiso, así que llegar aquí sin él
 * significa haber escrito la URL a mano.
 */
export async function requerirPermiso(
  permiso: Permiso,
): Promise<UsuarioSesion> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, permiso)) {
    redirigir(PORTAL_POR_ROL[usuario.rol], await getLocale());
  }

  return usuario;
}

/**
 * Exige que el rol sea uno de los admitidos.
 *
 * A quien tiene sesión pero no el rol no se le muestra un error: se le lleva
 * a su propio portal. Equivocarse de URL no es un fallo del que informar.
 */
export async function requerirRol(
  admitidos: readonly Rol[],
): Promise<UsuarioSesion> {
  const usuario = await requerirUsuario();

  if (!admitidos.includes(usuario.rol)) {
    redirigir(PORTAL_POR_ROL[usuario.rol], await getLocale());
  }

  return usuario;
}
