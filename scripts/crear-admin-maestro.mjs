/**
 * Creación de la identidad del ADMIN MAESTRO en Supabase Auth.
 *
 * Es el único usuario que no puede invitar nadie: es el primero, el que después
 * invita al resto desde /administrativo/personal. De ahí que exista este script
 * y no un formulario.
 *
 * No se usa `seed-usuarios.mjs` para esto a propósito: ese script siembra las
 * seis cuentas de demostración con una contraseña compartida y conocida
 * (`GlobalEffect2026!`), lo cual está bien para probar los portales en local y
 * mal para la cuenta que gobierna la institución en producción.
 *
 * Orden obligatorio (regla de invitación, migración 0016):
 *   1. Existe la fila en `usuario` con rol `super_admin`  ← la invitación
 *   2. Se crea la identidad en `auth.users`
 *   3. El trigger `trg_auth_user_created` enlaza por email; el script vuelve a
 *      enlazar explícitamente para ser idempotente aunque el trigger no esté.
 *
 * Si se invierte el orden, el trigger no encuentra a quién enlazar y la
 * identidad queda huérfana: entra a Supabase pero no al sistema.
 *
 * Dos modos, según si se da una contraseña:
 *   • Con ADMIN_MAESTRO_PASSWORD → cuenta lista para entrar, email confirmado.
 *   • Sin ella → genera un enlace de invitación para que el admin ponga su
 *     propia contraseña. Preferible en producción: la contraseña no pasa por
 *     el historial del shell ni por el archivo de entorno.
 *
 * Uso:
 *   ADMIN_MAESTRO_EMAIL="dauris@genialsense.com" \
 *   ADMIN_MAESTRO_NOMBRE="Dauris Santana" \
 *   npm run db:admin
 *
 * Es idempotente: si la cuenta ya existe, reafirma el rol y el enlace.
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const email = (process.env.ADMIN_MAESTRO_EMAIL ?? "").trim().toLowerCase();
const nombre = (process.env.ADMIN_MAESTRO_NOMBRE ?? "").trim();
const password = process.env.ADMIN_MAESTRO_PASSWORD ?? "";

if (!email || !nombre) {
  console.error(
    "Faltan datos. Uso:\n" +
      '  ADMIN_MAESTRO_EMAIL="admin@dominio.org" ADMIN_MAESTRO_NOMBRE="Nombre Apellido" npm run db:admin\n' +
      "  (opcional) ADMIN_MAESTRO_PASSWORD=... para crearla ya lista en vez de por invitación",
  );
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env.local");
  process.exit(1);
}

/**
 * API de administración de Supabase Auth (GoTrue) por REST. Igual que en
 * `seed-usuarios.mjs`: `fetch` en vez de `supabase-js` porque su cliente
 * arrastra Realtime, que exige WebSocket nativo (Node >= 22).
 */
async function authApi(ruta, init = {}) {
  const res = await fetch(`${url}/auth/v1${ruta}`, {
    ...init,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${ruta} → ${res.status} ${texto}`);
  }
  return texto ? JSON.parse(texto) : {};
}

/** Busca una identidad de Auth por email (la API admin no filtra por email). */
async function buscarAuthUser(correo) {
  for (let page = 1; ; page++) {
    const data = await authApi(`/admin/users?page=${page}&per_page=200`);
    const encontrado = data.users?.find((u) => u.email?.toLowerCase() === correo);
    if (encontrado) return encontrado;
    if (!data.users || data.users.length < 200) return null;
  }
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  // ── 1. La invitación: perfil de aplicación con rol super_admin ────────────
  const { rows: roles } = await db.query(`SELECT id FROM rol WHERE nombre = 'super_admin'`);
  if (!roles[0]) {
    throw new Error(
      "No existe el rol 'super_admin'. Aplica las migraciones primero: npm run db:migrate",
    );
  }

  await db.query(
    `INSERT INTO usuario (email, nombre, idioma, activo, rol_id)
     VALUES ($1, $2, 'es', TRUE, $3)
     ON CONFLICT (email) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            activo = TRUE,
            rol_id = EXCLUDED.rol_id`,
    [email, nombre, roles[0].id],
  );
  console.log(`✓ Perfil de aplicación (super_admin) — ${email}`);

  // ── 2. La identidad en Supabase Auth ─────────────────────────────────────
  const existente = await buscarAuthUser(email);
  let authId = existente?.id ?? null;
  let enlaceInvitacion = null;

  if (password) {
    const cuenta = existente
      ? await authApi(`/admin/users/${existente.id}`, {
          method: "PUT",
          body: JSON.stringify({ password, email_confirm: true }),
        })
      : await authApi("/admin/users", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { nombre },
          }),
        });
    authId = cuenta.id;
    console.log(`✓ Identidad de Auth con contraseña — ${existente ? "actualizada" : "creada"}`);
  } else if (existente) {
    console.log("✓ Identidad de Auth ya existente — no se toca la contraseña");
  } else {
    // Enlace de invitación: el admin define su propia contraseña. Se usa
    // `generate_link` (no `/invite`) para no depender de que el SMTP del
    // proyecto esté configurado — el enlace se imprime aquí.
    const invitacion = await authApi("/admin/generate_link", {
      method: "POST",
      body: JSON.stringify({ type: "invite", email, data: { nombre } }),
    });
    authId = invitacion.user?.id ?? invitacion.id ?? null;
    enlaceInvitacion = invitacion.action_link ?? null;
    console.log("✓ Invitación generada — el admin define su contraseña");
  }

  // ── 3. Enlace explícito (el trigger 0016 ya lo hace; esto lo hace idempotente)
  if (authId) {
    await db.query(`UPDATE usuario SET auth_user_id = $1 WHERE email = $2`, [authId, email]);
  }

  // ── Verificación: ¿queda realmente utilizable? ───────────────────────────
  const { rows: verif } = await db.query(
    `SELECT u.email, u.nombre, u.activo, u.auth_user_id, r.nombre AS rol
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.email = $1`,
    [email],
  );
  const u = verif[0];

  console.log("\n── Admin maestro ─────────────────────────────");
  console.log(`  correo   ${u.email}`);
  console.log(`  nombre   ${u.nombre}`);
  console.log(`  rol      ${u.rol}`);
  console.log(`  activo   ${u.activo ? "sí" : "no"}`);
  console.log(`  enlazado ${u.auth_user_id ? `sí (${u.auth_user_id})` : "NO"}`);

  if (!u.auth_user_id) {
    console.error(
      "\n✗ El perfil quedó sin enlazar a Auth. Revisa que la migración 0014/0016 esté aplicada.",
    );
    process.exitCode = 1;
  } else if (enlaceInvitacion) {
    console.log(`\nEnlace de invitación (un solo uso):\n${enlaceInvitacion}`);
  } else if (password) {
    console.log("\nYa puede entrar en /login con su correo y contraseña.");
  }
} finally {
  await db.end();
}
