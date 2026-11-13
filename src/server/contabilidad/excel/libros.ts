import { crearLibroExcel, type ColumnaExcel } from "./generador-excel";
import {
  balanza,
  libroDiario,
  mayorGeneral,
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
    { header: "Cuenta mayor", key: "mayor", width: 30, formato: "texto" },
    { header: "Código", key: "codigo", width: 14, formato: "texto" },
    { header: "Cuenta auxiliar", key: "cuenta", width: 34, formato: "texto" },
    { header: "Descripción", key: "descripcion", width: 30, formato: "texto" },
    { header: "Débito", key: "debe", width: 16, formato: "moneda" },
    { header: "Crédito", key: "haber", width: 16, formato: "moneda" },
  ];

  const filas = asientos.flatMap((a) =>
    a.lineas.map((l) => ({
      numero: Number(a.numero),
      fecha: a.fecha,
      concepto: a.estado === "vigente" ? a.concepto : `[${a.estado.toUpperCase()}] ${a.concepto}`,
      mayor: `${l.mayorCodigo} ${l.mayorNombre}`,
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

/** El mayor general: cada mayor y, debajo, sus auxiliares sangradas. */
export async function exportarMayorExcel(f: FiltroLibros): Promise<Buffer> {
  const mayores = await mayorGeneral(f);

  const columnas: ColumnaExcel[] = [
    { header: "Código", key: "codigo", width: 14, formato: "texto" },
    { header: "Cuenta", key: "nombre", width: 40, formato: "texto" },
    { header: "Débito", key: "debe", width: 16, formato: "moneda" },
    { header: "Crédito", key: "haber", width: 16, formato: "moneda" },
    { header: "Saldo", key: "saldo", width: 18, formato: "moneda" },
  ];

  const filas = mayores.flatMap((m) => [
    { codigo: m.codigo, nombre: m.nombre, debe: cifra(m.debe), haber: cifra(m.haber), saldo: cifra(m.saldo) },
    ...m.auxiliares.map((a) => ({
      codigo: a.codigo,
      nombre: `   ${a.nombre}`,
      debe: cifra(a.debe),
      haber: cifra(a.haber),
      saldo: cifra(a.saldo),
    })),
  ]);

  return crearLibroExcel({ tituloHoja: `Mayor ${rango(f)}`.slice(0, 31), columnas, filas });
}

export async function exportarBalanzaExcel(f: FiltroLibros): Promise<Buffer> {
  const [filasBalanza, totales] = await Promise.all([balanza(f), totalesDiario(f)]);

  const columnas: ColumnaExcel[] = [
    { header: "Código", key: "codigo", width: 14, formato: "texto" },
    { header: "Cuenta", key: "nombre", width: 40, formato: "texto" },
    { header: "Débito", key: "debe", width: 16, formato: "moneda" },
    { header: "Crédito", key: "haber", width: 16, formato: "moneda" },
  ];

  // La sangría del árbol en el nombre: así sobrevive a un filtro o a un
  // copiar y pegar, cosa que un formato de celda no garantiza.
  const filas = filasBalanza.map((b) => ({
    codigo: b.codigo,
    nombre: `${"   ".repeat(b.nivel)}${b.nombre}`,
    debe: cifra(b.debe),
    haber: cifra(b.haber),
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
