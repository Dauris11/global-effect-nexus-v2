// Comprueba el contrato de la opción «Asiento» (src/lib/contabilidad/vista-asiento.ts):
// suma en centavos, cuadre y problemas. No necesita base de datos.
// Uso: npx tsx scripts/probar-vista-asiento.ts
export {};

const { armarVista, descuadreDe } = await import("../src/lib/contabilidad/vista-asiento");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

// 0.1 + 0.2 en floats da 0.30000000000000004: en centavos cuadra con 0.30.
const flotante = armarVista(
  [{ debe: 0.1, haber: 0 }, { debe: 0.2, haber: 0 }, { debe: 0, haber: 0.3 }],
  [],
);
prueba("0.1 + 0.2 cuadra con 0.30 (centavos enteros)", flotante.cuadra && flotante.totalDebe === 0.3 && flotante.totalHaber === 0.3);
prueba("un asiento que cuadra no inventa problemas", flotante.problemas.length === 0);

const desc = armarVista([{ debe: 100, haber: 0 }, { debe: 0, haber: 99.99 }], []);
prueba("detecta el descuadre", !desc.cuadra);
prueba("añade asiento_descuadrado", desc.problemas.some((p) => p.clave === "asiento_descuadrado"));
prueba("diferencia de 0.01", descuadreDe(desc) === 0.01, String(descuadreDe(desc)));

const ya = armarVista([{ debe: 5, haber: 0 }], [{ clave: "asiento_descuadrado" }]);
prueba("no duplica asiento_descuadrado", ya.problemas.filter((p) => p.clave === "asiento_descuadrado").length === 1);

const sinCuenta = armarVista(
  [{ debe: 10, haber: 0, codigoTransaccion: "X" }, { debe: 0, haber: 10 }],
  [{ clave: "codigo_sin_cuenta", codigo: "X" }],
  { estado: "previa" },
);
prueba("cuadra pero conserva el problema de cuenta faltante", sinCuenta.cuadra && sinCuenta.problemas[0]?.clave === "codigo_sin_cuenta");

const vacia = armarVista([], [{ clave: "monto_invalido", codigo: "Y" }]);
prueba("sin líneas: cuadra en 0 y conserva el problema", vacia.cuadra && vacia.totalDebe === 0 && vacia.problemas.length === 1);

const cont = armarVista([{ debe: 1, haber: 0 }, { debe: 0, haber: 1 }], [], {
  estado: "contabilizado", asientoId: "a", numero: "7", fecha: "2026-11-25", descripcion: "x",
});
prueba("copia los extras del encabezado", cont.estado === "contabilizado" && cont.numero === "7" && cont.asientoId === "a" && cont.fecha === "2026-11-25");

const omitido = armarVista(
  [{ debe: 100, haber: Number(undefined) }, { debe: Number(undefined), haber: 100 }],
  [],
);
prueba("valores NaN no rompen el cuadre", omitido.cuadra && omitido.totalDebe === 100 && omitido.totalHaber === 100);

if (fallos) {
  console.error(`\n${fallos} prueba(s) fallaron`);
  process.exit(1);
}
console.log("\nTodo en orden");
