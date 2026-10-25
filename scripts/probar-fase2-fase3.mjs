import test from "node:test";
import assert from "node:assert/strict";

import {
  calcularAmortizacionFrancesa,
  calcularDeduccionesLaborales,
  calcularFacturaCompleta,
  calcularItbis,
  calcularRetencionesDominicanas,
} from "../src/server/contabilidad/calculadoras/motor.ts";
import {
  calcularMesesOFraccion,
  calcularRecargosYMora,
} from "../src/server/contabilidad/dgii/recargos-mora.ts";

test("ITBIS: cálculo directo e inverso exacto", () => {
  // Directo: Base 1,000 -> ITBIS 180, Total 1,180
  const dir = calcularItbis({ monto: 1000, tipo: "directo", tasa: 0.18 });
  assert.equal(dir.base, 1000);
  assert.equal(dir.impuesto, 180);
  assert.equal(dir.total, 1180);

  // Inverso: Total 1,180 -> Base 1,000, ITBIS 180
  const inv = calcularItbis({ monto: 1180, tipo: "inverso", tasa: 0.18 });
  assert.equal(inv.base, 1000);
  assert.equal(inv.impuesto, 180);
  assert.equal(inv.total, 1180);

  // Tasa reducida 16%
  const red = calcularItbis({ monto: 1000, tipo: "directo", tasa: 0.16 });
  assert.equal(red.impuesto, 160);
  assert.equal(red.total, 1160);
});

test("Factura: múltiples líneas, descuentos y retenciones", () => {
  const fac = calcularFacturaCompleta({
    lineas: [
      { descripcion: "Honorarios A", cantidad: 2, precioUnitario: 5000, descuentoPorcentaje: 10, itbisTasa: 0.18 },
      { descripcion: "Material B", cantidad: 1, precioUnitario: 2000, descuentoPorcentaje: 0, itbisTasa: 0.18 },
    ],
    retencionIsrTasa: 0.15, // 15% Ley 30-26
    retencionItbisTasa: 1.00, // 100% ITBIS retenido
  });

  // Línea 1: 2 * 5,000 = 10,000 - 10% (1,000) = 9,000 neto. ITBIS 18% = 1,620.
  // Línea 2: 1 * 2,000 = 2,000. ITBIS 18% = 360.
  // Subtotal neto = 11,000. Total ITBIS = 1,980. Total factura = 12,980.
  // Retención ISR 15% sobre 11,000 = 1,650.
  // Retención ITBIS 100% sobre 1,980 = 1,980.
  // Neto a pagar = 12,980 - 1,650 - 1,980 = 9,350.
  assert.equal(fac.subtotalNeto, 11000);
  assert.equal(fac.totalItbis, 1980);
  assert.equal(fac.totalFactura, 12980);
  assert.equal(fac.retencionIsr, 1650);
  assert.equal(fac.retencionItbis, 1980);
  assert.equal(fac.netoAPagar, 9350);
});

test("Retenciones dominicanas: Ley 30-26 (15% desde 01-jul-2026 a físicas)", () => {
  // Antes de julio 2026: 10% ISR
  const retAntes = calcularRetencionesDominicanas({
    subtotal: 10000,
    itbis: 1800,
    tipoProveedor: "fisica",
    conceptoServicio: "honorarios",
    fecha: "2026-05-15",
  });
  assert.equal(retAntes.tasaIsr, 0.10);
  assert.equal(retAntes.retencionIsr, 1000);
  assert.equal(retAntes.retencionItbis, 1800); // 100%
  assert.equal(retAntes.netoAPagar, 9000);

  // A partir del 1 de julio de 2026 (Ley 30-26): 15% ISR
  const retDespues = calcularRetencionesDominicanas({
    subtotal: 10000,
    itbis: 1800,
    tipoProveedor: "fisica",
    conceptoServicio: "honorarios",
    fecha: "2026-08-01",
  });
  assert.equal(retDespues.tasaIsr, 0.15);
  assert.equal(retDespues.retencionIsr, 1500);
  assert.equal(retDespues.retencionItbis, 1800);
  assert.equal(retDespues.netoAPagar, 8500);

  // Proveedor persona jurídica por servicios: 0% ISR y 30% ITBIS (NG 02-05)
  const retJur = calcularRetencionesDominicanas({
    subtotal: 20000,
    itbis: 3600,
    tipoProveedor: "juridica",
    conceptoServicio: "servicios_tecnicos",
  });
  assert.equal(retJur.tasaIsr, 0);
  assert.equal(retJur.retencionIsr, 0);
  assert.equal(retJur.retencionItbis, 1080); // 30% de 3,600
  assert.equal(retJur.netoAPagar, 22520);
});

test("DGII: cálculo de recargos y mora oficial (Art. 251 y 252)", () => {
  // Pago al día (sin mora)
  const sinMora = calcularRecargosYMora(10000, "2026-09-20", "2026-09-20");
  assert.equal(sinMora.mesesMora, 0);
  assert.equal(sinMora.totalMoraYRecargos, 0);
  assert.equal(sinMora.totalAPagar, 10000);

  // 1 mes o fracción de retraso:
  // Vence 20-sep-2026 y se paga 25-sep-2026 (5 días de atraso = 1 mes/fracción)
  // Recargo 10%, Interés 1.10% = 11.10%
  const mora1 = calcularRecargosYMora(10000, "2026-09-20", "2026-09-25");
  assert.equal(mora1.mesesMora, 1);
  assert.equal(mora1.montoRecargo, 1000);
  assert.equal(mora1.montoInteres, 110);
  assert.equal(mora1.totalMoraYRecargos, 1110);
  assert.equal(mora1.totalAPagar, 11110);

  // 2 meses o fracción de retraso:
  // Vence 20-sep-2026 y se paga 25-oct-2026
  // Recargo: 10% + 4% = 14% (RD$ 1,400)
  // Interés: 2 * 1.10% = 2.20% (RD$ 220)
  // Total mora: RD$ 1,620
  const mora2 = calcularRecargosYMora(10000, "2026-09-20", "2026-10-25");
  assert.equal(mora2.mesesMora, 2);
  assert.equal(mora2.montoRecargo, 1400);
  assert.equal(mora2.montoInteres, 220);
  assert.equal(mora2.totalMoraYRecargos, 1620);
  assert.equal(mora2.totalAPagar, 11620);

  // 4 meses de retraso:
  // Recargo: 10% + (3 * 4%) = 22%
  // Interés: 4 * 1.10% = 4.40%
  // Total recargo + interés = 26.40%
  const mora4 = calcularRecargosYMora(50000, "2026-01-20", "2026-05-10");
  assert.equal(mora4.mesesMora, 4);
  assert.equal(mora4.porcentajeRecargo, 22);
  assert.equal(mora4.porcentajeInteres, 4.4);
  assert.equal(mora4.totalAPagar, 63200);
});

test("Préstamo: tabla de amortización francesa nivelada", () => {
  const prestamo = calcularAmortizacionFrancesa({
    monto: 100000,
    tasaAnualPorcentaje: 12, // 1% mensual
    plazoMeses: 12,
  });

  assert.equal(prestamo.tabla.length, 12);
  // El saldo final al mes 12 debe ser 0.00
  assert.equal(prestamo.tabla[11].saldoRestante, 0);
  // La suma de capital amortizado debe ser igual al monto principal
  const capitalTotal = prestamo.tabla.reduce((acc, f) => acc + f.capital, 0);
  assert.ok(Math.abs(capitalTotal - 100000) <= 0.1);
});

test("Laboral: retenciones de TSS e ISR asalariados", () => {
  // Salario RD$ 30,000 (exento de ISR porque es menor a RD$ 34,685)
  const bajo = calcularDeduccionesLaborales(30000);
  assert.equal(bajo.afpEmpleado, 861); // 2.87%
  assert.equal(bajo.sfsEmpleado, 912); // 3.04%
  assert.equal(bajo.isrMensual, 0);
  assert.equal(bajo.salarioNeto, 30000 - 861 - 912);

  // Salario RD$ 60,000 (aplica tramo del 15% sobre excedente de 34,685 mensual)
  const medio = calcularDeduccionesLaborales(60000);
  assert.equal(medio.afpEmpleado, 1722);
  assert.equal(medio.sfsEmpleado, 1824);
  assert.ok(medio.isrMensual > 0);
  assert.equal(medio.salarioNeto, 60000 - medio.totalDeducciones);
});
