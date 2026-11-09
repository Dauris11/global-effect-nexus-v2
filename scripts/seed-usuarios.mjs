/**
 * Sembrado de usuarios de demostración (uno por rol).
 *
 * El sistema es "solo por invitación": la fila en `usuario` debe existir ANTES
 * de crear la identidad en Supabase Auth (el trigger de la migración 0016
 * enlaza por email). Este script hace ambos pasos, en ese orden, y es
 * idempotente: si el usuario ya existe se actualiza el rol y la contraseña.
 *
 * Uso: npm run db:seed:usuarios
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

/** Contraseña común de los usuarios de demostración (solo entorno local). */
const PASSWORD = process.env.DEMO_PASSWORD ?? "GlobalEffect2026!";

/** Un usuario por rol institucional, para poder probar cada portal. */
const USUARIOS = [
  { email: "admin@globaleffect.org",         nombre: "Administrador Global Effect", rol: "super_admin" },
  { email: "coordinacion@globaleffect.org",  nombre: "Marisol Peña",                rol: "admin" },
  { email: "docente@globaleffect.org",       nombre: "Roberto Gómez",               rol: "docente" },
  { email: "estudiante@globaleffect.org",    nombre: "Yeimy Rodríguez",             rol: "estudiante" },
  { email: "habitudes@globaleffect.org",     nombre: "Laura Fermín",                rol: "habitudes" },
  { email: "director.habitudes@globaleffect.org", nombre: "Director Habitudes La Vega", rol: "dir_habitudes" },
  { email: "contabilidad@globaleffect.org",  nombre: "Ana Santana",                 rol: "contabilidad" },
  { email: "chofer@globaleffect.org",        nombre: "Chofer Institucional",        rol: "chofer" },
];

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

/**
 * Llama a la API de administración de Supabase Auth (GoTrue) por REST.
 * Se usa `fetch` en vez de `supabase-js` porque su cliente arrastra Realtime,
 * que exige WebSocket nativo (Node >= 22) y aquí corremos Node 20.
 */
async function authAdmin(ruta, init = {}) {
  const res = await fetch(`${url}/auth/v1/admin${ruta}`, {
    ...init,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${ruta} → ${res.status} ${await res.text()}`);
  return res.json();
}

/** Busca una identidad de Auth por email (la API admin no filtra por email). */
async function buscarAuthUser(email) {
  for (let page = 1; ; page++) {
    const data = await authAdmin(`/users?page=${page}&per_page=200`);
    const encontrado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (encontrado) return encontrado;
    if (data.users.length < 200) return null;
  }
}

for (const u of USUARIOS) {
  const email = u.email.toLowerCase();

  // 1. Perfil de aplicación (la "invitación").
  await db.query(
    `INSERT INTO usuario (email, nombre, idioma, activo, rol_id)
     VALUES ($1, $2, 'es', TRUE, (SELECT id FROM rol WHERE nombre = $3))
     ON CONFLICT (email) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            activo = TRUE,
            rol_id = EXCLUDED.rol_id`,
    [email, u.nombre, u.rol],
  );

  // 2. Identidad de Supabase Auth (email confirmado para saltar el correo).
  const existente = await buscarAuthUser(email);
  const creado = existente
    ? await authAdmin(`/users/${existente.id}`, {
        method: "PUT",
        body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
      })
    : await authAdmin("/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { nombre: u.nombre },
        }),
      });
  const authId = creado.id;

  // 3. Enlace explícito (el trigger ya lo hace, pero esto lo vuelve idempotente).
  await db.query(`UPDATE usuario SET auth_user_id = $1 WHERE email = $2`, [authId, email]);

  console.log(`✓ ${u.rol.padEnd(13)} ${email}`);
}

await db.end();
console.log(`\nContraseña para todos: ${PASSWORD}`);
