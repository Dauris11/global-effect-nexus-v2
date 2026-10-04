// Pruebas de los adaptadores de banco (lector de CSV, montos, nómina).
// Uso: node --test scripts/probar-adaptadores.mjs
//
// Los adaptadores se importan entre sí sin extensión ("./adaptador"), como
// pide el tsconfig del proyecto (sin allowImportingTsExtensions). Node no
// resuelve eso solo, así que este gancho prueba a añadir ".ts" a los imports
// relativos sin extensión. Solo afecta a este proceso de pruebas.
import { registerHooks } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (/^\.\.?\//.test(especificador) && !/\.[cm]?[jt]s$/.test(especificador)) {
      try {
        return siguiente(`${especificador}.ts`, contexto);
      } catch {
        // Si no hay .ts, que Node dé su error de siempre.
      }
    }
    return siguiente(especificador, contexto);
  },
});

const { parsearEstadoCuentaCsv, leerCsv, normalizarMonto } = await import(
  "../src/server/contabilidad/bancos/adaptador.ts"
);
const { obtenerAdaptador } = await import("../src/server/contabilidad/bancos/index.ts");

const COLUMNAS_BASE = {
  fecha: "Fecha",
  descripcion: "Descripción",
  referencia: "Referencia",
  formatoFecha: "DD/MM/YYYY",
  separadorDecimal: ".",
};

test("lee comillas, coma interna, comilla escapada, BOM y CRLF", () => {
  const csv =
    '﻿Fecha,Descripción,Referencia,Monto,Saldo\r\n' +
    '05/01/2026,"Depósito, donación ""Amigos""",REF-1,"1,500.00","10,000.50"\r\n' +
    "\r\n" +
    '06/01/2026,"Comisión\r\nmensual",,-25.5,9975\r\n';
  const movimientos = parsearEstadoCuentaCsv(csv, { ...COLUMNAS_BASE, monto: "monto", saldo: "SALDO" });
  assert.deepEqual(movimientos, [
    {
      fecha: "2026-01-05",
      descripcion: 'Depósito, donación "Amigos"',
      referencia: "REF-1",
      monto: "1500.00",
      saldo: "10000.50",
    },
    { fecha: "2026-01-06", descripcion: "Comisión\r\nmensual", referencia: null, monto: "-25.50", saldo: "9975.00" },
  ]);
});

test("detecta punto y coma y separador decimal coma", () => {
  const csv = "Fecha;Descripción;Referencia;Débito;Crédito\n" + "01/02/2026;Pago luz;CH-9;1.234,56;\n" + "02/02/2026;Aporte;;;2.000,00\n";
  const movimientos = parsearEstadoCuentaCsv(csv, {
    ...COLUMNAS_BASE,
    debito: "Débito",
    credito: "Crédito",
    separadorDecimal: ",",
  });
  assert.equal(movimientos.length, 2);
  assert.equal(movimientos[0].monto, "-1234.56");
  assert.equal(movimientos[0].referencia, "CH-9");
  assert.equal(movimientos[1].monto, "2000.00");
});

test("débito y crédito en la misma fila se restan sin float", () => {
  const csv = "Fecha,Descripción,Débito,Crédito\n2026-03-01,Ajuste,0.10,0.30\n2026-03-02,Cargo,-5.00,\n";
  const movimientos = parsearEstadoCuentaCsv(csv, {
    fecha: "Fecha",
    descripcion: "Descripción",
    debito: "Débito",
    credito: "Crédito",
    formatoFecha: "YYYY-MM-DD",
    separadorDecimal: ".",
  });
  assert.equal(movimientos[0].monto, "0.20");
  assert.equal(movimientos[1].monto, "-5.00");
});

test("sin encabezado, columnas por posición y formato MM/DD/YYYY", () => {
  const csv = "12/31/2026,Cierre,(100.00)\n";
  const [movimiento] = parsearEstadoCuentaCsv(csv, {
    fecha: "0",
    descripcion: "1",
    monto: "2",
    formatoFecha: "MM/DD/YYYY",
    separadorDecimal: ".",
    filasEncabezado: 0,
  });
  assert.deepEqual(movimiento, { fecha: "2026-12-31", descripcion: "Cierre", referencia: null, monto: "-100.00", saldo: null });
});

test("fecha inválida lanza error con el número de línea", () => {
  const csv = "Fecha,Descripción,Monto\n01/01/2026,Uno,1\n\n31/02/2026,Dos,2\n";
  assert.throws(
    () => parsearEstadoCuentaCsv(csv, { ...COLUMNAS_BASE, referencia: undefined, monto: "Monto" }),
    /Línea 4: fecha inválida "31\/02\/2026"/,
  );
});

test("monto inválido lanza error con el número de línea", () => {
  const csv = "Fecha,Descripción,Monto\n01/01/2026,Uno,1.2.3\n";
  assert.throws(() => parsearEstadoCuentaCsv(csv, { ...COLUMNAS_BASE, referencia: undefined, monto: "Monto" }), /Línea 2: monto inválido/);
});

test("columna inexistente y comilla sin cerrar fallan", () => {
  assert.throws(() => parsearEstadoCuentaCsv("A,B\n", { ...COLUMNAS_BASE, monto: "Monto" }), /no está en el encabezado/);
  assert.throws(() => leerCsv('a,"b\n', ","), /comilla sin cerrar/);
});

test("normalizarMonto", () => {
  assert.equal(normalizarMonto("1.234,56", ","), "1234.56");
  assert.equal(normalizarMonto("RD$ 1,000", "."), "1000.00");
  assert.equal(normalizarMonto("500-", "."), "-500.00");
  assert.equal(normalizarMonto("  ", "."), null);
  assert.throws(() => normalizarMonto("1.234", "."));
});

test("obtenerAdaptador: registro y caída al genérico", () => {
  assert.equal(obtenerAdaptador("santa-cruz").nombre, "Banco Múltiple Santa Cruz");
  assert.equal(obtenerAdaptador("generico").clave, "generico");
  assert.equal(obtenerAdaptador("banco-que-no-existe").clave, "generico");
});

test("CSV de nómina genérico y de Santa Cruz (no oficial)", () => {
  const lineas = [
    { cedula: "001-0000000-1", nombre: "Pérez, Ana", cuenta: "1234567", monto: "25000.5", referencia: "NOM-2026-01" },
    { cedula: "002-0000000-2", nombre: 'Juan "JJ" Gómez', cuenta: "7654321", monto: "18000", referencia: "NOM-2026-01" },
  ];
  const esperado =
    "cedula,nombre,cuenta,monto,referencia\r\n" +
    '001-0000000-1,"Pérez, Ana",1234567,25000.50,NOM-2026-01\r\n' +
    '002-0000000-2,"Juan ""JJ"" Gómez",7654321,18000.00,NOM-2026-01\r\n';

  for (const clave of ["generico", "santa-cruz"]) {
    const archivo = obtenerAdaptador(clave).generarArchivoNomina(lineas);
    assert.equal(archivo.oficial, false);
    assert.equal(archivo.contenido, esperado);
    assert.match(archivo.nombreArchivo, /\.csv$/);
  }

  assert.throws(
    () => obtenerAdaptador("generico").generarArchivoNomina([{ ...lineas[0], monto: "-5" }]),
    /Línea de nómina 1: monto inválido/,
  );
});
