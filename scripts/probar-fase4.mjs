import test from "node:test";
import assert from "node:assert/strict";

test("Fase 4: Cálculo de ejecución presupuestaria y desviación", () => {
  const presupuestado = 500000;
  const ejecutado = 425000;
  const desviacion = ejecutado - presupuestado;
  const porcentaje = Number(((ejecutado / presupuestado) * 100).toFixed(1));

  assert.equal(desviacion, -75000);
  assert.equal(porcentaje, 85.0);

  // Clasificación de alerta
  function clasificarAlerta(pres, ejec) {
    if (pres <= 0) return "normal";
    const ratio = ejec / pres;
    if (ratio > 1.0) return "sobregiro";
    if (ratio >= 0.8) return "atencion";
    return "normal";
  }

  assert.equal(clasificarAlerta(500000, 350000), "normal");
  assert.equal(clasificarAlerta(500000, 425000), "atencion");
  assert.equal(clasificarAlerta(500000, 520000), "sobregiro");
});

test("Fase 4: Contabilidad por fondos ASFL - Saldo disponible y validación de liberación", () => {
  const fondo = {
    nombre: "Fondo Becas Internacionales",
    tipoRestriccion: "temporalmente_restringido",
    montoRestringidoOriginal: 1200000,
    montoLiberadoAcumulado: 450000,
  };

  const saldoDisponible = fondo.montoRestringidoOriginal - fondo.montoLiberadoAcumulado;
  assert.equal(saldoDisponible, 750000);

  function validarLiberacion(disponible, montoALiberar) {
    if (montoALiberar <= 0) return { ok: false, error: "Monto debe ser mayor a 0" };
    if (montoALiberar > disponible) return { ok: false, error: "Supera saldo disponible" };
    return { ok: true, saldoRestante: disponible - montoALiberar };
  }

  assert.equal(validarLiberacion(saldoDisponible, 250000).ok, true);
  assert.equal(validarLiberacion(saldoDisponible, 250000).saldoRestante, 500000);
  assert.equal(validarLiberacion(saldoDisponible, 800000).ok, false);
  assert.equal(validarLiberacion(saldoDisponible, -100).ok, false);
});

test("Fase 4: Cuadre de partida doble en asiento de reclasificación/liberación de fondos", () => {
  const montoLiberado = 150000;
  const lineas = [
    { cuenta: "3.1.01.02", debe: montoLiberado, haber: 0 }, // Débito a Patrimonio Restringido
    { cuenta: "3.1.01.01", debe: 0, haber: montoLiberado }, // Crédito a Patrimonio Operativo
  ];

  const totalDebe = lineas.reduce((acc, l) => acc + l.debe, 0);
  const totalHaber = lineas.reduce((acc, l) => acc + l.haber, 0);

  assert.equal(totalDebe, totalHaber);
  assert.equal(Math.abs(totalDebe - totalHaber), 0);
});

test("Fase 4: Trazabilidad Donación -> Fondo -> Ejecución", () => {
  const donacion = { id: "DON-001", monto: 500000, fondoId: "FND-BECAS" };
  const fondo = { id: "FND-BECAS", asignado: 500000, liberado: 120000 };
  const ejecucionGasto = [
    { id: "EXP-01", monto: 70000, concepto: "Pago cuatrimestre becados UNAPEC" },
    { id: "EXP-02", monto: 50000, concepto: "Estipendio de transporte becados" },
  ];

  const totalEjecutado = ejecucionGasto.reduce((acc, e) => acc + e.monto, 0);
  assert.equal(totalEjecutado, fondo.liberado);
  assert.equal(fondo.asignado - fondo.liberado, 380000);
});
