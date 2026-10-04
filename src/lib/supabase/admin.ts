/**
 * API de administración de Supabase Auth (GoTrue), desde el servidor.
 *
 * Se llama por REST con `fetch` y no con `supabase-js` por lo mismo que el
 * script de sembrado: su cliente arrastra Realtime, que exige WebSocket nativo.
 *
 * NUNCA importar esto desde un componente cliente. Usa `SUPABASE_SECRET_KEY`,
 * que es la clave con la que se puede crear, borrar y cambiar la contraseña de
 * cualquier cuenta del proyecto. Vive solo en archivos de servidor y en Server
 * Actions, y por eso este módulo no exporta nada que no sea una función `async`
 * de servidor: si acabara en un bundle de cliente, el error salta al construir.
 */

function credenciales() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreto = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secreto) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SECRET_KEY: sin ellas no se pueden gestionar cuentas.",
    );
  }

  return { url, secreto };
}

async function admin<T>(
  ruta: string,
  init: RequestInit = {},
): Promise<{ ok: true; datos: T } | { ok: false; estado: number; mensaje: string }> {
  const { url, secreto } = credenciales();

  const res = await fetch(`${url}/auth/v1/admin${ruta}`, {
    ...init,
    headers: {
      apikey: secreto,
      Authorization: `Bearer ${secreto}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    // Nunca cachear una respuesta de la API de cuentas.
    cache: "no-store",
  });

  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => ({}))) as {
      msg?: string;
      message?: string;
      error_description?: string;
    };

    return {
      ok: false,
      estado: res.status,
      mensaje: cuerpo.msg ?? cuerpo.message ?? cuerpo.error_description ?? "",
    };
  }

  return { ok: true, datos: (await res.json()) as T };
}

export type IdentidadAuth = {
  id: string;
  email: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

/**
 * Todas las identidades del proyecto, indexadas por correo.
 *
 * La API de administración no filtra por email, así que se pide la lista y se
 * indexa aquí. Se pagina de 200 en 200 por si el equipo crece.
 *
 * Lo que aporta que no esté en nuestra tabla `usuario` es el último acceso: eso
 * lo sabe Supabase Auth, no nosotros, y es el dato que dice si una cuenta
 * invitada llegó a usarse alguna vez.
 */
export async function identidadesPorCorreo(): Promise<Map<string, IdentidadAuth>> {
  const porCorreo = new Map<string, IdentidadAuth>();

  for (let pagina = 1; ; pagina++) {
    const res = await admin<{ users: IdentidadAuth[] }>(
      `/users?page=${pagina}&per_page=200`,
    );

    if (!res.ok) {
      // Sin la lista de identidades la pantalla sigue sirviendo: se pierde el
      // último acceso, no la gestión. Mejor eso que un error en toda la página.
      console.error("[auth] no se pudo listar identidades:", res.mensaje);
      return porCorreo;
    }

    for (const identidad of res.datos.users) {
      if (identidad.email) {
        porCorreo.set(identidad.email.toLowerCase(), identidad);
      }
    }

    if (res.datos.users.length < 200) return porCorreo;
  }
}

/**
 * Crea la identidad de acceso de una cuenta ya invitada.
 *
 * `email_confirm: true` porque la invita administración, no se registra sola: no
 * hay a quién pedirle que confirme un correo que él no ha pedido.
 *
 * Devuelve el id de la identidad para enlazarlo en `usuario.auth_user_id`. Si el
 * correo ya tiene identidad, lo dice en vez de crear una segunda.
 */
export async function crearIdentidad(
  email: string,
  nombre: string,
  contrasena: string,
): Promise<{ ok: true; id: string } | { ok: false; motivo: "existe" | "error" }> {
  const res = await admin<{ id: string }>("/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: contrasena,
      email_confirm: true,
      user_metadata: { nombre },
    }),
  });

  if (res.ok) return { ok: true, id: res.datos.id };

  // GoTrue responde 422 cuando el correo ya está registrado.
  const existe =
    res.estado === 422 || /already been registered|already exists/i.test(res.mensaje);

  console.error("[auth] no se pudo crear la identidad:", res.estado, res.mensaje);

  return { ok: false, motivo: existe ? "existe" : "error" };
}

/** Cambia la contraseña de una identidad. Para reiniciar un acceso perdido. */
export async function reiniciarContrasena(
  authUserId: string,
  contrasena: string,
): Promise<boolean> {
  const res = await admin(`/users/${authUserId}`, {
    method: "PUT",
    body: JSON.stringify({ password: contrasena, email_confirm: true }),
  });

  return res.ok;
}
