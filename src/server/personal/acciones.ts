"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { esRol, ROLES_ASIGNABLES } from "@/lib/rbac";
import { crearIdentidad, reiniciarContrasena } from "@/lib/supabase/admin";

/**
 * Gestión de cuentas del equipo. Solo `usuarios.administrar`, que en la base lo
 * tiene únicamente `super_admin`.
 *
 * El permiso se exige con `requerirPermiso` y no con una lista de roles: si
 * mañana se crea otro rol de administración, basta con darle el permiso en la
 * base y esto lo respeta sin tocar código. Es además lo que el usuario pidió: un
 * solo portal capaz de crear cuentas.
 *
 * Crear una cuenta son DOS escrituras en dos sistemas: la fila en `usuario` —el
 * perfil y el rol, que es nuestro— y la identidad en Supabase Auth —el correo y
 * la contraseña, que es de ellos—. El orden importa: primero la fila, después la
 * identidad, porque el trigger `handle_new_auth_user` de la 0016 enlaza por
 * correo y solo enlaza si el usuario ya existe. Al revés, la identidad quedaría
 * suelta y su dueño autenticado pero sin acceso a nada.
 *
 * Si la segunda escritura falla, se deshace la primera. Media cuenta creada es
 * peor que ninguna: aparece en la lista, no puede entrar, y nadie sabe por qué.
 */

export type EstadoCuenta = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "correo_invalido"
    | "correo_repetido"
    | "nombre_vacio"
    | "rol_invalido"
    | "no_encontrada"
    | "error";
  /**
   * Contraseña temporal, solo al crear y solo esta vez.
   *
   * No se guarda ni se vuelve a mostrar: la tiene Supabase Auth cifrada y aquí
   * no queda copia. Quien crea la cuenta se la pasa a su dueño por donde
   * corresponda, y esa persona la cambia al entrar.
   */
  contrasena?: string;
};

/**
 * Contraseña temporal legible: cuatro grupos de cuatro caracteres.
 *
 * Legible porque hay que dictarla o pegarla en un mensaje, y `randomBytes` para
 * que no sea adivinable: `Math.random()` no sirve para una credencial. Sin
 * caracteres que se confundan al leerlos en voz alta (l/1, O/0).
 */
function contrasenaTemporal(): string {
  const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const cuerpo = [...bytes].map((b) => alfabeto[b % alfabeto.length]).join("");

  return cuerpo.match(/.{1,4}/g)!.join("-");
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function crearCuenta(
  _previo: EstadoCuenta,
  datos: FormData,
): Promise<EstadoCuenta> {
  const admin = await requerirPermiso("usuarios.administrar");

  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 120);
  const rol = String(datos.get("rol") ?? "");

  if (!CORREO.test(email)) return { estado: "correo_invalido" };
  if (!nombre) return { estado: "nombre_vacio" };
  if (!esRol(rol) || !ROLES_ASIGNABLES.includes(rol)) {
    return { estado: "rol_invalido" };
  }

  const contrasena = contrasenaTemporal();

  try {
    // 1. El perfil. `ON CONFLICT DO NOTHING` en vez de UPSERT: si el correo ya
    //    existe se responde "repetido" en lugar de cambiarle el rol a alguien
    //    por error al teclear un correo que ya estaba.
    const creado = await consultarUna<{ id: string }>(
      `INSERT INTO usuario (email, nombre, idioma, activo, rol_id)
       VALUES ($1, $2, 'es', TRUE, (SELECT id FROM rol WHERE nombre = $3))
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, nombre, rol],
    );

    if (!creado) return { estado: "correo_repetido" };

    // 2. La identidad de acceso.
    const identidad = await crearIdentidad(email, nombre, contrasena);

    if (!identidad.ok) {
      // Deshacer el perfil: sin identidad no puede entrar, y dejarlo en la
      // lista solo confunde a quien la mire.
      await consultarUna(`DELETE FROM usuario WHERE id = $1 RETURNING id`, [
        creado.id,
      ]);

      return {
        estado: identidad.motivo === "existe" ? "correo_repetido" : "error",
      };
    }

    await consultarUna(
      `UPDATE usuario SET auth_user_id = $2 WHERE id = $1 RETURNING id`,
      [creado.id, identidad.id],
    );

    await registrar({
      usuarioId: admin.id,
      accion: "cuenta.creada",
      entidad: "usuario",
      entidadId: creado.id,
      // Nunca la contraseña. Que la cuenta se creó y con qué rol es auditoría;
      // la credencial, no.
      datos: { email, rol },
    });
  } catch (error) {
    console.error("[personal] no se pudo crear la cuenta", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok", contrasena };
}

/**
 * Cambia el rol de una cuenta.
 *
 * No se puede cambiar el propio rol, y es a propósito: quitarse sin querer
 * `usuarios.administrar` deja el sistema sin nadie capaz de devolvérselo.
 */
export async function cambiarRol(
  _previo: EstadoCuenta,
  datos: FormData,
): Promise<EstadoCuenta> {
  const admin = await requerirPermiso("usuarios.administrar");

  const id = String(datos.get("id") ?? "");
  const rol = String(datos.get("rol") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrada" };
  if (!esRol(rol) || !ROLES_ASIGNABLES.includes(rol)) {
    return { estado: "rol_invalido" };
  }
  if (id === admin.id) return { estado: "no_permitido" };

  try {
    const cambiado = await consultarUna<{ id: string; antes: string }>(
      `UPDATE usuario u
          SET rol_id = (SELECT id FROM rol WHERE nombre = $2)
        FROM rol viejo
        WHERE u.id = $1
          AND viejo.id = u.rol_id
          AND viejo.nombre <> $2
      RETURNING u.id, viejo.nombre AS antes`,
      [id, rol],
    );

    if (!cambiado) return { estado: "no_encontrada" };

    await registrar({
      usuarioId: admin.id,
      accion: "cuenta.rol_cambiado",
      entidad: "usuario",
      entidadId: cambiado.id,
      datos: { antes: cambiado.antes, despues: rol },
    });
  } catch (error) {
    console.error("[personal] no se pudo cambiar el rol", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Activa o desactiva una cuenta.
 *
 * Desactivar y no borrar: `obtenerUsuarioActual` deja fuera a quien tenga
 * `activo = false`, así que la persona no entra, pero sus tareas, sus notas y su
 * rastro en `audit_log` siguen apuntando a alguien con nombre. Borrar la fila
 * dejaría huérfano todo lo que hizo.
 */
export async function alternarCuenta(
  _previo: EstadoCuenta,
  datos: FormData,
): Promise<EstadoCuenta> {
  const admin = await requerirPermiso("usuarios.administrar");

  const id = String(datos.get("id") ?? "");
  const activar = String(datos.get("activar") ?? "") === "1";

  if (!esUuid(id)) return { estado: "no_encontrada" };
  if (id === admin.id) return { estado: "no_permitido" };

  try {
    const cambiada = await consultarUna<{ id: string; email: string }>(
      `UPDATE usuario
          SET activo = $2
        WHERE id = $1
          AND activo <> $2
      RETURNING id, email::text AS email`,
      [id, activar],
    );

    if (!cambiada) return { estado: "no_encontrada" };

    await registrar({
      usuarioId: admin.id,
      accion: activar ? "cuenta.activada" : "cuenta.desactivada",
      entidad: "usuario",
      entidadId: cambiada.id,
      datos: { email: cambiada.email },
    });
  } catch (error) {
    console.error("[personal] no se pudo alternar la cuenta", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Genera una contraseña temporal nueva para una cuenta que ya existe.
 *
 * Es la salida cuando alguien pierde su acceso y el correo de recuperación no
 * funciona —hoy no funciona: el proyecto no tiene proveedor de correo válido—.
 */
export async function reiniciarAcceso(
  _previo: EstadoCuenta,
  datos: FormData,
): Promise<EstadoCuenta> {
  const admin = await requerirPermiso("usuarios.administrar");

  const id = String(datos.get("id") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrada" };

  const cuenta = await consultarUna<{ auth_user_id: string | null; email: string }>(
    `SELECT auth_user_id, email::text AS email FROM usuario WHERE id = $1`,
    [id],
  );

  if (!cuenta?.auth_user_id) return { estado: "no_encontrada" };

  const contrasena = contrasenaTemporal();

  if (!(await reiniciarContrasena(cuenta.auth_user_id, contrasena))) {
    return { estado: "error" };
  }

  await registrar({
    usuarioId: admin.id,
    accion: "cuenta.acceso_reiniciado",
    entidad: "usuario",
    entidadId: id,
    datos: { email: cuenta.email },
  });

  refrescar();

  return { estado: "ok", contrasena };
}

function refrescar() {
  revalidatePath("/[locale]/administrativo/personal", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
