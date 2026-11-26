// Pruebas unitarias del catálogo y cálculo de retenciones DGII (ISR e ITBIS).
// Uso: npx tsx scripts/probar-retenciones-dgii.ts
export {};

const {
  RETENCIONES_ISR,
  RETENCIONES_ITBIS,
  TODAS_RETENCIONES,
  retencionPorCodigo,
  retencionesParaProveedor,
  calcularMontoRetencion,
} = await import("../src/lib/contabilidad/retenciones-dgii");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

const codigos = TODAS_RETENCIONES.map((r) => r.codigo);
prueba("hay retenciones de ISR e ITBIS", RETENCIONES_ISR.length > 0 && RETENCIONES_ITBIS.length > 0);
prueba("códigos únicos", new Set(codigos).size === codigos.length);
prueba("tasas entre 0 y 1", TODAS_RETENCIONES.every((r) => r.tasa > 0 && r.tasa < 1));
prueba(
  "ISR 10% honorarios sobre 10,000 = 1000.00",
  calcularMontoRetencion("10000", "isr_servicios_profesionales_10") === "1000.00",
);
prueba(
  "ISR 2% servicios técnicos sobre 15,500.50 = 310.01",
  calcularMontoRetencion("15500.50", "isr_servicios_tecnicos_2") === "310.01",
);
prueba(
  "ITBIS 30% (5.4%) sociedades sobre 10,000 = 540.00",
  calcularMontoRetencion("10000", "itbis_sociedades_profesionales_30") === "540.00",
);
prueba(
  "ITBIS 100% (18%) persona física sobre 5,000 = 900.00",
  calcularMontoRetencion("5000", "itbis_pf_servicios_100") === "900.00",
);
prueba(
  "Sin retención o monto inválido devuelve 0.00",
  calcularMontoRetencion("10000", "") === "0.00" &&
    calcularMontoRetencion("", "isr_alquileres_10") === "0.00" &&
    calcularMontoRetencion("-50", "isr_alquileres_10") === "0.00",
);
prueba(
  "retencionesParaProveedor prioriza las del tipo elegido",
  retencionesParaProveedor("itbis", "juridica")[0].aplicaA !== "fisica" &&
    retencionesParaProveedor("isr", "fisica")[0].aplicaA === "fisica",
);
prueba("retencionPorCodigo encuentra y rechaza", retencionPorCodigo("isr_alquileres_10") !== null && retencionPorCodigo("inexistente") === null);

if (fallos) {
  console.error(`\n${fallos} prueba(s) fallaron.`);
  process.exit(1);
}
console.log("\nTodo bien.");
