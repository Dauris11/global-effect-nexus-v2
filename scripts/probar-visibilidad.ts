// Pruebas de la visibilidad de menús por rol: filtrado, bloqueo por prefijo,
// rutas protegidas y lectura desde la base. La acción de guardar exige sesión de
// super_admin y se prueba en pantalla.
// Uso: npx tsx scripts/probar-visibilidad.ts
import { config } from "dotenv";

config({ path: ".env.local" });

const { menuDe, itemsDeArea, pestanasMoviles, rutasProtegidas } = await import("../src/lib/nav");
const { rutaBloqueada, visibilidadDeRol } = await import("../src/server/visibilidad/consultas");
const { consultar, pool } = await import("../src/lib/db");
const { ROLES, PORTAL_POR_ROL } = await import("../src/lib/rbac");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

const hrefs = (rol: (typeof ROLES)[number], ocultos?: ReadonlySet<string>) =>
  menuDe(rol, ocultos).flatMap(itemsDeArea).map((i) => i.href);

const completo = hrefs("contabilidad");
const objetivo = completo.find((h) => h.startsWith("/contabilidad/nomina")) ?? completo.find((h) => h.startsWith("/contabilidad/"))!;

prueba("sin ocultos el menú es el de siempre", completo.length > 5 && completo.includes(objetivo));
prueba("ocultar una ruta la quita del menú", !hrefs("contabilidad", new Set([objetivo])).includes(objetivo));
prueba(
  "ocultar solo quita esa ruta",
  hrefs("contabilidad", new Set([objetivo])).length === completo.length - completo.filter((h) => h === objetivo).length,
);

// Un área sin entradas deja de dibujarse
const todoOculto = new Set(completo);
prueba("si se oculta todo, no queda ningún área vacía", menuDe("contabilidad", todoOculto).length === 0);

// pestañas del móvil
const pestanas = pestanasMoviles("estudiante");
const primera = pestanas.find((p) => p.tipo === "enlace");
if (primera && primera.tipo === "enlace") {
  const sin = pestanasMoviles("estudiante", new Set([primera.href]));
  prueba("las pestañas del móvil también respetan lo oculto", !sin.some((p) => p.tipo === "enlace" && p.href === primera.href));
}

// bloqueo por prefijo con frontera de segmento
const bloqueadas = new Set(["/contabilidad/nomina", "funcion:asistente_ia"]);
prueba("bloquea la ruta exacta", rutaBloqueada("/contabilidad/nomina", bloqueadas));
prueba("bloquea las rutas hijas", rutaBloqueada("/contabilidad/nomina/empleados/1", bloqueadas));
prueba("no bloquea una ruta que solo empieza igual", !rutaBloqueada("/contabilidad/nominas", bloqueadas));
prueba("no bloquea otras rutas", !rutaBloqueada("/contabilidad/bancos", bloqueadas));
prueba("una función no se confunde con una ruta", !rutaBloqueada("funcion:asistente_ia", bloqueadas));

// rutas protegidas: el inicio del rol y el perfil, y existen en el menú
for (const rol of ROLES) {
  const p = rutasProtegidas(rol);
  prueba(
    `rol ${rol}: protege su inicio (${p[1]}) y su perfil`,
    p.length === 2 && p[0] === "/perfil" && p[1] === PORTAL_POR_ROL[rol] && p[1]!.startsWith("/"),
  );
}

// lectura desde la base
const claveA = `/__prueba/${Date.now()}/a`;
const claveB = `/__prueba/${Date.now()}/b`;

try {
  await consultar("INSERT INTO public.visibilidad_menu (rol, clave, estado) VALUES ('colaborador', $1, 'oculto'), ('colaborador', $2, 'bloqueado')", [claveA, claveB]);
  const v = await visibilidadDeRol("colaborador");
  prueba("visibilidadDeRol separa ocultas y bloqueadas", v.ocultas.has(claveA) && v.bloqueadas.has(claveB) && !v.bloqueadas.has(claveA));
  prueba("fueraDelMenu une las dos", v.fueraDelMenu.includes(claveA) && v.fueraDelMenu.includes(claveB));
  const otro = await visibilidadDeRol("docente");
  prueba("lo de un rol no se filtra a otro", !otro.fueraDelMenu.includes(claveA));
  const rechazo = await consultar("INSERT INTO public.visibilidad_menu (rol, clave, estado) VALUES ('colaborador', $1, 'inventado') RETURNING 1", [`${claveA}x`]).then(() => false, () => true);
  prueba("la base rechaza un estado inventado", rechazo);
} finally {
  await consultar("DELETE FROM public.visibilidad_menu WHERE clave LIKE '/__prueba/%'");
}

await pool.end();
console.log(fallos === 0 ? "\n✓ Visibilidad: todas las pruebas pasan" : `\n✗ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
