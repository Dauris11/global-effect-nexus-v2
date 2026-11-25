// Comprueba que el menú se deriva de los permisos y que ninguna entrada se
// queda sin decidir quién la ve: cada una declara `permiso`, `algunPermiso` o
// `universal`. No necesita base de datos.
// Uso: npx tsx scripts/probar-menu-por-permisos.ts
export {};

const { menuDe, itemsDeArea, itemsDeTodoElMenu, itemsSinDeclarar, pestanasMoviles } =
  await import("../src/lib/nav");
const { ROLES, PERMISOS_POR_ROL } = await import("../src/lib/rbac");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

for (const rol of ROLES) {
  const sinDeclarar = itemsSinDeclarar(rol).map((i) => i.href);
  prueba(`${rol}: ninguna entrada sin permiso ni universal`, sinDeclarar.length === 0, sinDeclarar.join(", "));

  const items = itemsDeTodoElMenu(rol);
  const ambiguos = items.filter((i) => i.universal && (i.permiso || i.algunPermiso)).map((i) => i.href);
  prueba(`${rol}: ninguna entrada es universal y con permiso a la vez`, ambiguos.length === 0, ambiguos.join(", "));
}

// Sin permisos no se ve nada que exija uno; con el reparto de fábrica, el menú del rol no queda vacío.
for (const rol of ROLES) {
  const vacio = menuDe(rol, new Set()).flatMap(itemsDeArea);
  prueba(
    `${rol}: sin permisos solo quedan las universales`,
    vacio.every((i) => i.universal),
    vacio.filter((i) => !i.universal).map((i) => i.href).join(", "),
  );
  prueba(`${rol}: con su reparto de fábrica tiene menú`, menuDe(rol).length > 0);
}

// La visibilidad sigue al permiso: quitar uno quita justo lo que protege.
const sinContabilidad = new Set(PERMISOS_POR_ROL.contabilidad.filter((p) => p !== "contabilidad.leer"));
const antes = menuDe("contabilidad").flatMap(itemsDeArea).filter((i) => i.permiso === "contabilidad.leer").length;
const despues = menuDe("contabilidad", sinContabilidad).flatMap(itemsDeArea).filter((i) => i.permiso === "contabilidad.leer").length;
prueba("quitar contabilidad.leer oculta sus módulos", antes > 0 && despues === 0);

// Una función fuera del rol añade su área (docencia en habitudes).
const habilitada = new Set([...PERMISOS_POR_ROL.habitudes, "docencia.impartir" as const]);
prueba(
  "docencia.impartir suma el portal de profesor a un rol que no lo trae",
  !menuDe("habitudes").flatMap(itemsDeArea).some((i) => i.href === "/portal/profesor") &&
    menuDe("habitudes", habilitada).flatMap(itemsDeArea).some((i) => i.href === "/portal/profesor"),
);

// Las pestañas del móvil salen del mismo menú filtrado.
const pestanas = pestanasMoviles("estudiante");
prueba("estudiante: pestañas del móvil con Más al final", pestanas.length >= 2 && pestanas.at(-1)?.tipo === "mas");

console.log(fallos === 0 ? "\n✓ Menú por permisos: todas las pruebas pasan" : `\n✗ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
