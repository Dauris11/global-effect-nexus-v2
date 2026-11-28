import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getLocale } from "next-intl/server";

import { redirigir } from "@/i18n/navigation";
import { consultar, consultarUna } from "@/lib/db";
import {
  esPermiso,
  esRol,
  PORTAL_POR_ROL,
  permisosEfectivos,
  usuarioTienePermiso,
  type ExcepcionPermiso,
  type Permiso,
  type Rol,
  esRolTotal,
} from "@/lib/rbac";
import { puedeVerComo } from "@/lib/roles";
import {
  COOKIE_SUPLANTACION_CONFIRMADA,
  COOKIE_VER_COMO_USUARIO,
  leerSuplantacion,
  PARAM_SUPLANTACION_BLOQUEADA,
  PARAM_SUPLANTACION_CONFIRMAR,
  secretoSuplantacion,
} from "@/lib/suplantacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { usuarioSesionDe } from "@/server/prioridades/suplantar";
import { impersonationWriteActivo } from "@/server/parametros/tecnicos";

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
  /**
   * Quién está de verdad detrás de la sesión. Coincide con `id`/`nombre` salvo en «Ver como usuario…»
   * (`suplantando`), donde `id`, `rol` y permisos son los de la persona suplantada. Toda auditoría de una
   * escritura debe usar `realId`, no `id`.
   */
  realId: string;
  realNombre: string;
  /** `true` solo mientras un developer actúa como UNA persona concreta (cookie firmada `ge_ver_como_usuario`). */
  suplantando: boolean;
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
  /** Permisos del rol efectivo según `rol_permiso` (editables por el owner). */
  permisosRol: Permiso[];
  /** Rol más excepciones, ya resuelto: lo que el menú puede mostrar. */
  permisos: Permiso[];
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
  permisos_rol: string[];
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
 * Solo se honra si el rol REAL de la cuenta es `owner`: a cualquier otra
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
            ), '[]'::json) AS excepciones,
            -- Lo mismo para el reparto del rol: la base manda, no el código.
            coalesce((
              SELECT json_agg(p.codigo)
                FROM rol_permiso rp
                JOIN permiso p ON p.id = rp.permiso_id
               WHERE rp.rol_id = u.rol_id
            ), '[]'::json) AS permisos_rol
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE u.auth_user_id = $1`,
    [user.id],
  );

  if (!fila || !fila.activo || !esRol(fila.rol_nombre)) return null;

  const rolReal = fila.rol_nombre;
  let rol: Rol = rolReal;
  let excepciones = fila.excepciones;
  let permisosRol = fila.permisos_rol;

  // «Ver como usuario…»: solo un developer REAL, con la cookie firmada para ESTA cuenta y a una persona activa
  // que no sea otro developer. Gana sobre «Ver como rol»: la sesión es la de la persona, con su rol y permisos.
  if (rolReal === "developer") {
    const suplantada = await sesionSuplantada(fila.id);

    if (suplantada) {
      return {
        ...suplantada,
        rolReal,
        realId: fila.id,
        realNombre: fila.nombre,
        // La identidad de acceso es la real: es la que firma el JWT y la que se audita.
        authUserId: user.id,
        suplantando: true,
      };
    }
  }

  if (esRolTotal(rolReal)) {
    const verComo = (await cookies()).get(COOKIE_VER_COMO)?.value;

    // `puedeVerComo` es la lista permitida: el owner no se «ve como» owner (ya lo es); el developer sí.
    if (esRol(verComo) && verComo !== rolReal && puedeVerComo(rolReal, verComo)) {
      rol = verComo;
      // Las excepciones son de la cuenta del administrador, no del rol que se
      // está mirando: mezclarlas enseñaría una pantalla que nadie de ese rol ve.
      excepciones = [];
      permisosRol = await permisosDeRol(verComo);
    }
  }

  const permisosRolValidos = permisosRol.filter(esPermiso);
  const excepcionesValidas = excepciones.flatMap((e) =>
    esPermiso(e.permiso) ? [{ permiso: e.permiso, concedido: e.concedido }] : [],
  );

  return {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    idioma: fila.idioma === "en" ? "en" : "es",
    rol,
    rolReal,
    realId: fila.id,
    realNombre: fila.nombre,
    suplantando: false,
    authUserId: user.id,
    fotoUrl: fila.foto_url,
    excepciones: excepcionesValidas,
    permisosRol: permisosRolValidos,
    permisos: permisosEfectivos({
      rol,
      excepciones: excepcionesValidas,
      permisosRol: permisosRolValidos,
    }),
  };
}

/** La persona a la que el developer `realId` está suplantando, o `null` si no hay cookie válida. */
async function sesionSuplantada(realId: string): Promise<UsuarioSesion | null> {
  let carga;

  try {
    carga = leerSuplantacion((await cookies()).get(COOKIE_VER_COMO_USUARIO)?.value, secretoSuplantacion());
  } catch {
    // Sin secreto configurado no se puede validar nada: se trata como si no hubiera cookie.
    return null;
  }

  if (!carga || carga.realId !== realId || carga.objetivoId === realId) return null;

  const objetivo = await usuarioSesionDe(carga.objetivoId, { soloActivo: true });

  // Suplantar a otro developer sería escalar a sus permisos técnicos sin ser él.
  if (!objetivo || objetivo.rol === "developer") return null;

  return objetivo;
}

/** Permisos que `rol_permiso` concede a un rol (para «ver como»). */
async function permisosDeRol(rol: Rol): Promise<string[]> {
  const filas = await consultar<{ codigo: string }>(
    `SELECT p.codigo
       FROM rol_permiso rp
       JOIN permiso p ON p.id = rp.permiso_id
       JOIN rol r ON r.id = rp.rol_id
      WHERE r.nombre = $1`,
    [rol],
  );
  return filas.map((f) => f.codigo);
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

  // Punto central de las pantallas y acciones (`requerirPermiso`, `requerirRol`, `requerirDocencia` pasan por
  // aquí): si un developer suplanta a alguien, una acción que ESCRIBE se bloquea antes de hacer nada.
  await exigirSinSuplantacion(usuario);

  return usuario;
}

/**
 * Guard de escritura de «Ver como usuario…». Solo hace algo con `usuario.suplantando`.
 *
 * Distingue acción de lectura por la cabecera `next-action` que Next pone en toda invocación de server action
 * (las pantallas son GET y pasan). Una acción se BLOQUEA y se devuelve a quien la lanzó a la misma página con
 * `?suplantacion_bloqueada=1` (la UI muestra «Estás actuando como {nombre}: las acciones que escriben están
 * bloqueadas»); no se lanza un error porque en producción Next oculta su mensaje al navegador.
 *
 * Si el parámetro técnico `tecnico.impersonation_write` está activo, la escritura se permite SOLO tras una
 * confirmación de la sesión (`confirmarEscrituraSuplantada`, cookie de 8 h ligada a la persona suplantada); sin
 * ella se devuelve con `?suplantacion_confirmar=1`. Cada bloqueo queda en `audit_log` a nombre del developer REAL.
 *
 * Cómo adoptarlo: toda acción nueva que escriba debe empezar por `requerirUsuario/requerirPermiso/requerirRol`
 * (ya lo hace). Las que usan `obtenerUsuarioActual()` a pelo o los route handlers POST/PUT/DELETE NO pasan por
 * aquí: deben llamar `await exigirSinSuplantacion(usuario)` a mano.
 */
export async function exigirSinSuplantacion(usuario: UsuarioSesion): Promise<void> {
  if (!usuario.suplantando) return;

  const cabeceras = await headers();

  if (!cabeceras.get("next-action")) return;

  const escrituraPermitida = await impersonationWriteActivo();
  const confirmada = (await cookies()).get(COOKIE_SUPLANTACION_CONFIRMADA)?.value === usuario.id;

  if (escrituraPermitida && confirmada) return;

  const { registrar } = await import("@/lib/auditoria");
  const referer = cabeceras.get("referer");
  const motivo = escrituraPermitida ? "sin_confirmar" : "bloqueada";
  let destino = "/";
  let desde: string | null = null;

  try {
    const url = new URL(referer ?? "", `https://${cabeceras.get("host") ?? "localhost"}`);

    desde = url.pathname;

    if (url.host === cabeceras.get("host")) {
      url.searchParams.set(motivo === "bloqueada" ? PARAM_SUPLANTACION_BLOQUEADA : PARAM_SUPLANTACION_CONFIRMAR, "1");
      destino = `${url.pathname}${url.search}`;
    }
  } catch {
    // Sin referer válido se cae a la raíz: el middleware de idioma la lleva al inicio.
  }

  await registrar({
    usuarioId: usuario.realId,
    accion: motivo === "bloqueada" ? "sesion.ver_como_escritura_bloqueada" : "sesion.ver_como_escritura_sin_confirmar",
    entidad: "sesion",
    entidadId: usuario.id,
    datos: { suplantado: usuario.id, suplantadoNombre: usuario.nombre, desde },
  });

  redirect(destino);
}

/**
 * Exige un permiso concreto, no un rol.
 *
 * Es lo que necesitan los módulos compartidos: `/contabilidad` no es "de
 * contabilidad", es de quien tenga `finanzas.leer`, que hoy son ese rol y
 * `owner` y mañana puede ser otro. Comprobar el rol en esas pantallas
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
 * Exige poder dar clases de Global Effect 360: el permiso `docencia.impartir`
 * (nativo de `docente`, concedible a título personal a otro rol) o ser
 * `owner`, que supervisa. Comprueba el permiso y no el rol porque un
 * profesor de Habitudes puede dar una clase de 360 sin dejar de ser de Habitudes.
 */
export async function requerirDocencia(): Promise<UsuarioSesion> {
  const usuario = await requerirUsuario();

  if (
    !esRolTotal(usuario.rol) &&
    !usuarioTienePermiso(usuario, "docencia.impartir")
  ) {
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

  // owner y developer entran a cualquier portal: ven y hacen todo (los datos propios de un rol, como los de un
  // estudiante, salen vacíos porque la cuenta no es de ese rol).
  if (!admitidos.includes(usuario.rol) && !esRolTotal(usuario.rol)) {
    redirigir(PORTAL_POR_ROL[usuario.rol], await getLocale());
  }

  return usuario;
}
