// Comprueba la lista de códigos de transacción: claves únicas y con formato,
// textos es/en completos y módulo conocido. No necesita base de datos.
// Uso: npx tsx scripts/probar-codigos-transaccion.ts
export {};

const { CODIGOS_TRANSACCION, ETIQUETA_MODULO, FORMATO_CODIGO, definicionDe, codigosDeModulo } =
  await import("../src/lib/contabilidad/codigos-transaccion");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

const claves = CODIGOS_TRANSACCION.map((d) => d.codigo);
const repetidas = claves.filter((c, i) => claves.indexOf(c) !== i);
prueba("hay códigos definidos", claves.length > 0, String(claves.length));
prueba("claves únicas", repetidas.length === 0, repetidas.join(", "));
prueba("formato MAYUSCULAS_CON_GUION_BAJO", claves.every((c) => FORMATO_CODIGO.test(c)), claves.filter((c) => !FORMATO_CODIGO.test(c)).join(", "));

const vacio = (s: string) => s.trim() === "";
prueba("nombre es/en no vacíos", CODIGOS_TRANSACCION.every((d) => !vacio(d.nombre.es) && !vacio(d.nombre.en)));
prueba("ayuda es/en no vacías", CODIGOS_TRANSACCION.every((d) => !vacio(d.ayuda.es) && !vacio(d.ayuda.en)));
prueba("proceso no vacío y en minúsculas", CODIGOS_TRANSACCION.every((d) => /^[a-z][a-z0-9_]*$/.test(d.proceso)));
prueba("naturaleza válida", CODIGOS_TRANSACCION.every((d) => d.naturaleza === "debito" || d.naturaleza === "credito"));
prueba("módulo con etiqueta es/en", CODIGOS_TRANSACCION.every((d) => {
  const e = ETIQUETA_MODULO[d.modulo];
  return !!e && !vacio(e.es) && !vacio(e.en);
}));
prueba("definicionDe encuentra y rechaza", definicionDe(claves[0])?.codigo === claves[0] && definicionDe("NO_EXISTE") === undefined);
prueba("codigosDeModulo(nomina) no vacío", codigosDeModulo("nomina").length > 0);

if (fallos) {
  console.error(`\n${fallos} prueba(s) fallaron.`);
  process.exit(1);
}
console.log("\nTodo bien.");
