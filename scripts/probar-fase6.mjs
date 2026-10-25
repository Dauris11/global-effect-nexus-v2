import test from "node:test";
import assert from "node:assert/strict";

// ============================================================
// SUITE DE PRUEBAS UNITARIAS — FASE 6: ESTADOS FINANCIEROS Y CIERRE
// Global Effect Nexus (ASFL Ley 122-05)
// ============================================================

test("Fase 6: Ecuación fundamental del Balance General (Activo = Pasivo + Patrimonio + Superávit)", () => {
  // Simulación de cuentas y saldos consolidados
  const cuentas = [
    // Activo Corriente
    { codigo: "1.1.01.01", nombre: "Caja General", tipo: "activo", debe: 25000, haber: 0 },
    { codigo: "1.1.02.01", nombre: "Banco Santa Cruz - DOP", tipo: "activo", debe: 350000, haber: 50000 },
    { codigo: "1.1.03.01", nombre: "Cuentas por cobrar", tipo: "activo", debe: 45000, haber: 0 },
    { codigo: "1.1.04.01", nombre: "Inventario Comedor", tipo: "activo", debe: 60000, haber: 10000 },
    // Activo No Corriente
    { codigo: "1.2.01.01", nombre: "Equipos de cómputo", tipo: "activo", debe: 120000, haber: 0 },
    { codigo: "1.2.09.01", nombre: "Depreciación acumulada", tipo: "activo", debe: 0, haber: 25000 },
    // Pasivo Corriente
    { codigo: "2.1.01.01", nombre: "Proveedores nacionales", tipo: "pasivo", debe: 20000, haber: 70000 },
    { codigo: "2.1.02.01", nombre: "Retenciones ISR por pagar", tipo: "pasivo", debe: 0, haber: 20000 },
    { codigo: "2.1.03.01", nombre: "Sueldos por pagar", tipo: "pasivo", debe: 0, haber: 40000 },
    // Patrimonio Social
    { codigo: "3.1.01.02", nombre: "Resultados acumulados", tipo: "patrimonio", debe: 0, haber: 200000 },
    // Ingresos del período
    { codigo: "4.1.01.01", nombre: "Donaciones nacionales", tipo: "ingreso", debe: 0, haber: 400000 },
    // Gastos del período
    { codigo: "5.1.01.01", nombre: "Sueldos", tipo: "gasto", debe: 120000, haber: 0 },
    { codigo: "5.2.01.01", nombre: "Alquiler", tipo: "gasto", debe: 50000, haber: 0 },
    { codigo: "5.2.01.09", nombre: "Depreciación mensual", tipo: "gasto", debe: 25000, haber: 0 },
  ];

  let totalActivos = 0;
  let totalPasivos = 0;
  let totalPatrimonioSocial = 0;
  let totalIngresos = 0;
  let totalGastos = 0;

  for (const c of cuentas) {
    if (c.tipo === "activo") {
      totalActivos += (c.debe - c.haber);
    } else if (c.tipo === "pasivo") {
      totalPasivos += (c.haber - c.debe);
    } else if (c.tipo === "patrimonio") {
      totalPatrimonioSocial += (c.haber - c.debe);
    } else if (c.tipo === "ingreso") {
      totalIngresos += (c.haber - c.debe);
    } else if (c.tipo === "gasto") {
      totalGastos += (c.debe - c.haber);
    }
  }

  const superavitPeriodo = totalIngresos - totalGastos;
  const totalPatrimonioConSuperavit = totalPatrimonioSocial + superavitPeriodo;
  const diferencia = totalActivos - (totalPasivos + totalPatrimonioConSuperavit);

  assert.equal(totalActivos, 515000); // 25k + 300k + 45k + 50k + 120k - 25k
  assert.equal(totalPasivos, 110000); // 50k + 15k + 40k
  assert.equal(totalPatrimonioSocial, 200000);
  assert.equal(totalIngresos, 400000);
  assert.equal(totalGastos, 195000); // 120k + 50k + 25k
  assert.equal(superavitPeriodo, 205000);
  assert.equal(totalPatrimonioConSuperavit, 405000);
  assert.equal(diferencia, 0, "La ecuación patrimonial debe cuadrar exactamente a 0.00");
});

test("Fase 6: Estado de Actividades ASFL - Desglose por restricción de fondos", () => {
  const partidas = [
    { concepto: "Donaciones generales", monto: 300000, tipoRestriccion: "no_restringido", tipo: "ingreso" },
    { concepto: "Subvención para becas STEM", monto: 200000, tipoRestriccion: "temporalmente_restringido", tipo: "ingreso" },
    { concepto: "Nómina institucional", monto: 180000, tipoRestriccion: "no_restringido", tipo: "gasto" },
    { concepto: "Estipendios becados STEM", monto: 150000, tipoRestriccion: "temporalmente_restringido", tipo: "gasto" },
    { concepto: "Servicios generales", monto: 40000, tipoRestriccion: "no_restringido", tipo: "gasto" },
  ];

  let totalIngresos = 0;
  let ingresosSin = 0;
  let ingresosCon = 0;

  let totalGastos = 0;
  let gastosSin = 0;
  let gastosCon = 0;

  for (const p of partidas) {
    if (p.tipo === "ingreso") {
      totalIngresos += p.monto;
      if (p.tipoRestriccion === "no_restringido") ingresosSin += p.monto;
      else ingresosCon += p.monto;
    } else {
      totalGastos += p.monto;
      if (p.tipoRestriccion === "no_restringido") gastosSin += p.monto;
      else gastosCon += p.monto;
    }
  }

  const superavitNeto = totalIngresos - totalGastos;
  const superavitSin = ingresosSin - gastosSin;
  const superavitCon = ingresosCon - gastosCon;

  assert.equal(totalIngresos, 500000);
  assert.equal(totalGastos, 370000);
  assert.equal(superavitNeto, 130000);
  assert.equal(superavitSin, 80000); // 300k - 220k
  assert.equal(superavitCon, 50000); // 200k - 150k
  assert.equal(superavitSin + superavitCon, superavitNeto);
});

test("Fase 6: Estado de Flujos de Efectivo - Método Indirecto y conciliación", () => {
  const superavitNeto = 130000;
  const depreciacionNoMonetaria = 25000;

  // Variaciones en capital de trabajo
  const deltaCxc = -15000;       // Aumento en CxC resta efectivo
  const deltaInventario = -8000;  // Aumento en inventario resta efectivo
  const deltaCxp = 20000;        // Aumento en CxP retiene/suma efectivo

  const flujoOperativo = superavitNeto + depreciacionNoMonetaria + deltaCxc + deltaInventario + deltaCxp;
  assert.equal(flujoOperativo, 152000);

  // Actividades de Inversión
  const compraEquipos = -60000; // Salida de efectivo
  const flujoInversion = compraEquipos;

  // Actividades de Financiamiento
  const flujoFinanciamiento = 0;

  const aumentoNetoEfectivo = flujoOperativo + flujoInversion + flujoFinanciamiento;
  assert.equal(aumentoNetoEfectivo, 92000);

  const saldoInicialEfectivo = 150000;
  const saldoFinalEfectivo = saldoInicialEfectivo + aumentoNetoEfectivo;
  assert.equal(saldoFinalEfectivo, 242000);
});

test("Fase 6: Flujo de caja proyectado a 3 meses", () => {
  let saldoActual = 200000;

  const meses = [
    {
      mes: "Mayo",
      ingresosDonaciones: 60000,
      promesasCobro: 80000,
      nomina: 75000,
      comprasComprometidas: 20000,
      gastosFijos: 15000,
    },
    {
      mes: "Junio",
      ingresosDonaciones: 60000,
      promesasCobro: 50000,
      nomina: 75000,
      comprasComprometidas: 10000,
      gastosFijos: 15000,
    },
    {
      mes: "Julio",
      ingresosDonaciones: 60000,
      promesasCobro: 120000,
      nomina: 75000,
      comprasComprometidas: 35000,
      gastosFijos: 15000,
    },
  ];

  const resultados = [];
  for (const m of meses) {
    const totalEntradas = m.ingresosDonaciones + m.promesasCobro;
    const totalSalidas = m.nomina + m.comprasComprometidas + m.gastosFijos;
    const flujoNeto = totalEntradas - totalSalidas;
    const saldoInicial = saldoActual;
    const saldoFinal = saldoInicial + flujoNeto;
    saldoActual = saldoFinal;

    resultados.push({
      mes: m.mes,
      saldoInicial,
      totalEntradas,
      totalSalidas,
      flujoNeto,
      saldoFinal,
    });
  }

  // Mayo: Entradas 140k, Salidas 110k, Neto +30k, Final 230k
  assert.equal(resultados[0].flujoNeto, 30000);
  assert.equal(resultados[0].saldoFinal, 230000);

  // Junio: Entradas 110k, Salidas 100k, Neto +10k, Final 240k
  assert.equal(resultados[1].flujoNeto, 10000);
  assert.equal(resultados[1].saldoFinal, 240000);

  // Julio: Entradas 180k, Salidas 125k, Neto +55k, Final 295k
  assert.equal(resultados[2].flujoNeto, 55000);
  assert.equal(resultados[2].saldoFinal, 295000);
});

test("Fase 6: Asiento de cierre anual y liquidación de resultados a 3.1.01.02", () => {
  // Cuentas de ingresos con saldo acreedor
  const ingresos = [
    { cuentaId: "cta-ing-1", codigo: "4.1.01.01", saldoAcreedor: 350000 },
    { cuentaId: "cta-ing-2", codigo: "4.1.01.02", saldoAcreedor: 150000 },
  ];

  // Cuentas de gastos con saldo deudor
  const gastos = [
    { cuentaId: "cta-gas-1", codigo: "5.1.01.01", saldoDeudor: 220000 },
    { cuentaId: "cta-gas-2", codigo: "5.2.01.01", saldoDeudor: 80000 },
    { cuentaId: "cta-gas-3", codigo: "5.4.01.03", saldoDeudor: 60000 },
  ];

  const totalIngresos = ingresos.reduce((acc, i) => acc + i.saldoAcreedor, 0);
  const totalGastos = gastos.reduce((acc, g) => acc + g.saldoDeudor, 0);
  const superavitNeto = totalIngresos - totalGastos; // 500,000 - 360,000 = 140,000

  assert.equal(totalIngresos, 500000);
  assert.equal(totalGastos, 360000);
  assert.equal(superavitNeto, 140000);

  // Construcción del asiento de liquidación:
  // - Debe: Todas las cuentas de ingresos por su saldo acreedor (para saldarlas a cero)
  // - Haber: Todas las cuentas de gastos por su saldo deudor (para saldarlas a cero)
  // - Haber: Cuenta 3.1.01.02 Resultados Acumulados por el superávit neto
  const lineasAsientoCierre = [];

  for (const ing of ingresos) {
    lineasAsientoCierre.push({ cuentaId: ing.cuentaId, debe: ing.saldoAcreedor, haber: 0 });
  }
  for (const gas of gastos) {
    lineasAsientoCierre.push({ cuentaId: gas.cuentaId, debe: 0, haber: gas.saldoDeudor });
  }

  // Contrapartida a Resultados Acumulados
  if (superavitNeto > 0) {
    lineasAsientoCierre.push({ cuentaId: "cta-res-acum", debe: 0, haber: superavitNeto });
  } else if (superavitNeto < 0) {
    lineasAsientoCierre.push({ cuentaId: "cta-res-acum", debe: Math.abs(superavitNeto), haber: 0 });
  }

  const sumaDebe = lineasAsientoCierre.reduce((acc, l) => acc + l.debe, 0);
  const sumaHaber = lineasAsientoCierre.reduce((acc, l) => acc + l.haber, 0);

  assert.equal(sumaDebe, 500000);
  assert.equal(sumaHaber, 500000);
  assert.equal(sumaDebe, sumaHaber, "El asiento de cierre anual debe cuadrar exactamente Debe = Haber");
});

test("Fase 6: Validaciones de pre-cierre mensual y anual", () => {
  function validarPreCierreMensual(periodo) {
    const impedimentos = [];
    if (periodo.borradoresRecibos > 0) impedimentos.push("recibos_borrador");
    if (periodo.borradoresFacturas > 0) impedimentos.push("facturas_borrador");
    if (periodo.borradoresNominas > 0) impedimentos.push("nominas_borrador");
    if (periodo.borradoresConteos > 0) impedimentos.push("conteos_borrador");
    return {
      puedeCerrar: impedimentos.length === 0,
      impedimentos,
    };
  }

  const periodoConBorradores = {
    mes: 3,
    borradoresRecibos: 2,
    borradoresFacturas: 0,
    borradoresNominas: 1,
    borradoresConteos: 0,
  };
  const val1 = validarPreCierreMensual(periodoConBorradores);
  assert.equal(val1.puedeCerrar, false);
  assert.equal(val1.impedimentos.length, 2);

  const periodoLimpio = {
    mes: 4,
    borradoresRecibos: 0,
    borradoresFacturas: 0,
    borradoresNominas: 0,
    borradoresConteos: 0,
  };
  const val2 = validarPreCierreMensual(periodoLimpio);
  assert.equal(val2.puedeCerrar, true);
  assert.equal(val2.impedimentos.length, 0);

  // Validación anual: todos los 12 meses deben estar cerrados
  function validarPreCierreAnual(meses) {
    const abiertos = meses.filter((m) => m.estado !== "cerrado");
    return {
      puedeCerrarAnio: meses.length === 12 && abiertos.length === 0,
      mesesAbiertos: abiertos.map((m) => m.mes),
    };
  }

  const mesesIncompletos = [
    { mes: 1, estado: "cerrado" },
    { mes: 2, estado: "abierto" },
    { mes: 3, estado: "cerrado" },
  ];
  assert.equal(validarPreCierreAnual(mesesIncompletos).puedeCerrarAnio, false);

  const anioCompleto = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    estado: "cerrado",
  }));
  assert.equal(validarPreCierreAnual(anioCompleto).puedeCerrarAnio, true);
});
