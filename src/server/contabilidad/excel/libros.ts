import { crearLibroExcel, type ColumnaExcel } from "./generador-excel";
import {
  balanza,
  cuentaMayor,
  libroDiario,
  movimientosMayor,
  resumenMayor,
  totalesDiario,
  type FiltroLibros,
} from "@/server/contabilidad/libros/consultas";

/**
 * Los tres libros en Excel, con las mismas consultas que la pantalla y sin
 * tope de filas: lo que se descarga es el libro entero del rango.
 *
 * Las cifras llegan como texto y se convierten a número SOLO para que Excel
 * las trate como montos. Ninguna suma se hace aquí: los totales y los saldos
 * vienen calculados de la base.
 */

const cifra = (valor: string) => Number(valor);

function rango(f: FiltroLibros): string {
  return f.periodo ?? `${f.desde} a ${f.hasta}`;
}

export async function exportarDiarioExcel(f: FiltroLibros): Promise<Buffer> {
  const [asientos, totales] = await Promise.all([libroDiario(f, null), totalesDiario(f)]);

  const columnas: ColumnaExcel[] = [
    { header: "Asiento", key: "numero", width: 10, formato: "entero" },
    { header: "Fecha", key: "fecha", width: 12, formato: "fecha" },
    { header: "Concepto", key: "concepto", width: 40, formato: "texto" },
    { header: "Código", key: "codigo", width: 14, formato: "texto" },
    { header: "Cuenta", key: "cuenta", width: 34, formato: "texto" },
    { header: "Descripción", key: "descripcion", width: 30, formato: "texto" },
    { header: "Debe", key: "debe", width: 16, formato: "moneda" },
    { header: "Haber", key: "haber", width: 16, formato: "moneda" },
  ];

  const filas = asientos.flatMap((a) =>
    a.lineas.map((l) => ({
      numero: Number(a.numero),
      fecha: a.fecha,
      concepto: a.estado === "vigente" ? a.concepto : `[${a.estado.toUpperCase()}] ${a.concepto}`,
      codigo: l.codigo,
      cuenta: l.cuenta,
      descripcion: l.descripcion ?? "",
      debe: cifra(l.debe),
      haber: cifra(l.haber),
    })),
  );

  return crearLibroExcel({
    tituloHoja: `Diario ${rango(f)}`.slice(0, 31),
    columnas,
    filas,
    totales: {
      concepto: totales.diferencia === "0.00" ? "TOTALES" : `TOTALES · DIFERENCIA ${totales.diferencia}`,
      debe: cifra(totales.debe),
      haber: cifra(totales.haber),
    },
  });
}

export async function exportarMayorExcel(f: FiltroLibros & { cuenta: string }): Promise<Buffer | null> {
  const [cuenta, resumen, movimientos] = await Promise.all([
    cuentaMayor(f.cuenta),
    resumenMayor(f.cuenta, f),
    movimientosMayor(f.cuenta, f, null),
  ]);
  if (!cuenta) return null;

  const columnas: ColumnaExcel[] = [
    { header: "Fecha", key: "fecha", width: 12, formato: "fecha" },
    { header: "Asiento", key: "numero", width: 10, formato: "entero" },
    { header: "Concepto", key: "concepto", width: 40, formato: "texto" },
    { header: "Cuenta", key: "cuenta", width: 34, formato: "texto" },
    { header: "Debe", key: "debe", width: 16, formato: "moneda" },
    { header: "Haber", key: "haber", width: 16, formato: "moneda" },
    { header: "Saldo", key: "saldo", width: 18, formato: "moneda" },
  ];

  const filas = [
    { fecha: f.desde, concepto: "Saldo inicial", saldo: cifra(resumen.saldoInicial) },
    ...movimientos.map((m) => ({
      fecha: m.fecha,
      numero: Number(m.numero),
      concepto: m.concepto,
      cuenta: `${m.codigo} ${m.cuenta}`,
      debe: cifra(m.debe),
      haber: cifra(m.haber),
      saldo: cifra(m.saldo),
    })),
  ];

  return crearLibroExcel({
    tituloHoja: `Mayor ${cuenta.codigo}`.slice(0, 31),
    columnas,
    filas,
    totales: {
      concepto: `Saldo final · ${cuenta.codigo} ${cuenta.nombre}`,
      debe: cifra(resumen.debe),
      haber: cifra(resumen.haber),
      saldo: cifra(resumen.saldoFinal),
    },
  });
}

export async function exportarBalanzaExcel(f: FiltroLibros): Promise<Buffer> {
  const [filasBalanza, totales] = await Promise.all([balanza(f), totalesDiario(f)]);

  const columnas: ColumnaExcel[] = [
    { header: "Código", key: "codigo", width: 14, formato: "texto" },
    { header: "Cuenta", key: "nombre", width: 40, formato: "texto" },
    { header: "Saldo inicial", key: "saldoInicial", width: 18, formato: "moneda" },
    { header: "Debe", key: "debe", width: 16, formato: "moneda" },
    { header: "Haber", key: "haber", width: 16, formato: "moneda" },
    { header: "Saldo final", key: "saldoFinal", width: 18, formato: "moneda" },
  ];

  // La sangría del árbol en el nombre: así sobrevive a un filtro o a un
  // copiar y pegar, cosa que un formato de celda no garantiza.
  const filas = filasBalanza.map((b) => ({
    codigo: b.codigo,
    nombre: `${"   ".repeat(b.nivel)}${b.nombre}`,
    saldoInicial: cifra(b.saldoInicial),
    debe: cifra(b.debe),
    haber: cifra(b.haber),
    saldoFinal: cifra(b.saldoFinal),
  }));

  return crearLibroExcel({
    tituloHoja: `Balanza ${rango(f)}`.slice(0, 31),
    columnas,
    filas,
    totales: {
      nombre: totales.diferencia === "0.00" ? "TOTALES" : `TOTALES · DIFERENCIA ${totales.diferencia}`,
      debe: cifra(totales.debe),
      haber: cifra(totales.haber),
    },
  });
}
