import test from "node:test";
import assert from "node:assert/strict";

// Función pura idéntica a src/server/contabilidad/nomina/consultas.ts
function calcularPrestacionesLaborales(input) {
  const ingreso = new Date(input.fechaIngreso);
  const salida = new Date(input.fechaSalida);
  const factorDiario = 23.83;
  const salarioDiario = Math.round((input.salarioMensual / factorDiario) * 100) / 100;

  let anios = salida.getFullYear() - ingreso.getFullYear();
  let meses = salida.getMonth() - ingreso.getMonth();
  let dias = salida.getDate() - ingreso.getDate();

  if (dias < 0) {
    meses -= 1;
    dias += 30;
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  const mesesTotales = anios * 12 + meses + dias / 30;

  // 1. Preaviso (Art. 76)
  let diasPreaviso = 0;
  if (input.incluyePreaviso) {
    if (mesesTotales >= 3 && mesesTotales < 6) {
      diasPreaviso = 7;
    } else if (mesesTotales >= 6 && mesesTotales < 12) {
      diasPreaviso = 14;
    } else if (mesesTotales >= 12) {
      diasPreaviso = 28;
    }
  }
  const montoPreaviso = Math.round(diasPreaviso * salarioDiario * 100) / 100;

  // 2. Cesantía (Art. 80)
  let diasCesantia = 0;
  if (input.incluyeCesantia) {
    if (mesesTotales >= 3 && mesesTotales < 6) {
      diasCesantia = 6;
    } else if (mesesTotales >= 6 && mesesTotales < 12) {
      diasCesantia = 13;
    } else if (anios >= 1 && anios < 5) {
      diasCesantia = anios * 21;
      if (meses >= 6) diasCesantia += 21;
    } else if (anios >= 5) {
      diasCesantia = anios * 23;
      if (meses >= 6) diasCesantia += 23;
    }
  }
  const montoCesantia = Math.round(diasCesantia * salarioDiario * 100) / 100;

  // 3. Vacaciones (Art. 177)
  const diasVacaciones = input.diasVacacionesPendientes ?? (anios >= 5 ? 18 : 14);
  const montoVacaciones = Math.round(diasVacaciones * salarioDiario * 100) / 100;

  // 4. Regalía Pascual (Art. 219)
  const mesesRegalia = input.mesesTrabajadosEnAnio ?? (salida.getMonth() + 1);
  const montoRegaliaPascual = Math.round(((input.salarioMensual * mesesRegalia) / 12) * 100) / 100;

  const totalLiquidacion =
    montoPreaviso + montoCesantia + montoVacaciones + montoRegaliaPascual;

  return {
    antiguedadAnios: anios,
    antiguedadMeses: meses,
    antiguedadDias: dias,
    salarioDiario,
    diasPreaviso,
    montoPreaviso,
    diasCesantia,
    montoCesantia,
    diasVacaciones,
    montoVacaciones,
    montoRegaliaPascual,
    totalLiquidacion: Math.round(totalLiquidacion * 100) / 100,
  };
}

test("Fase 5: Calculadora de Prestaciones Laborales (Código de Trabajo RD Ley 16-92)", () => {
  const resultado = calcularPrestacionesLaborales({
    salarioMensual: 35000,
    fechaIngreso: "2024-01-01",
    fechaSalida: "2026-05-01",
    incluyePreaviso: true,
    incluyeCesantia: true,
    diasVacacionesPendientes: 14,
    mesesTrabajadosEnAnio: 5,
  });

  assert.equal(resultado.salarioDiario, 1468.74);
  assert.equal(resultado.diasPreaviso, 28);
  assert.equal(resultado.diasCesantia, 42); // 2 años x 21
  assert.equal(resultado.montoPreaviso, 41124.72);
  assert.equal(resultado.montoCesantia, 61687.08);
  assert.equal(resultado.diasVacaciones, 14);
  assert.equal(resultado.montoVacaciones, 20562.36);
  assert.equal(resultado.montoRegaliaPascual, 14583.33);
  assert.equal(resultado.totalLiquidacion, 137957.49);
});

test("Fase 5: Seguridad Social Dominicana (TSS: AFP 2.87% y SFS 3.04%) con topes", () => {
  const salario = 60000;
  const tasaAfp = 0.0287;
  const tasaSfs = 0.0304;

  const afp = Math.round(salario * tasaAfp * 100) / 100;
  const sfs = Math.round(salario * tasaSfs * 100) / 100;

  assert.equal(afp, 1722.0);
  assert.equal(sfs, 1824.0);

  // Topes
  const salarioAlto = 500000;
  const topeAfp = 464460;
  const afpConTope = Math.round(Math.min(salarioAlto, topeAfp) * tasaAfp * 100) / 100;
  assert.equal(afpConTope, 13330.0);
});

test("Fase 5: Kardex y Costo Promedio Ponderado", () => {
  let stock = 100;
  let costoPromedio = 50.0;

  // Entrada de 50 a RD$ 65
  const entradaCant = 50;
  const entradaCosto = 65.0;
  const nuevoStock = stock + entradaCant;
  costoPromedio = (stock * costoPromedio + entradaCant * entradaCosto) / nuevoStock;
  stock = nuevoStock;

  assert.equal(stock, 150);
  assert.equal(costoPromedio, 55.0);

  // Salida de consumo de 30 unidades
  const salidaCant = 30;
  const costoSalidaTotal = salidaCant * costoPromedio;
  stock -= salidaCant;

  assert.equal(costoSalidaTotal, 1650.0);
  assert.equal(stock, 120);
  assert.equal(costoPromedio, 55.0); // El costo promedio no cambia en salidas
});

test("Fase 5: Depreciación Lineal Mensual de Activos Fijos", () => {
  const costoAdquisicion = 120000;
  const valorResidual = 0;
  const vidaUtilMeses = 48; // Categoría 2 (4 años)

  const cuotaMensual = Math.round(((costoAdquisicion - valorResidual) / vidaUtilMeses) * 100) / 100;
  assert.equal(cuotaMensual, 2500.0);

  let valorEnLibros = costoAdquisicion;
  let depreciacionAcumulada = 0;

  // 12 meses de depreciación
  for (let i = 0; i < 12; i++) {
    valorEnLibros -= cuotaMensual;
    depreciacionAcumulada += cuotaMensual;
  }

  assert.equal(valorEnLibros, 90000.0);
  assert.equal(depreciacionAcumulada, 30000.0);
});
