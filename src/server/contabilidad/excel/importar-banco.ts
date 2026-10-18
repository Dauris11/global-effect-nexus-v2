import ExcelJS from "exceljs";
import type { MovimientoEstado } from "../bancos/adaptador";

/**
 * Lector e importador universal de estados de cuenta bancarios (Excel .xlsx y CSV)
 * para el Banco Santa Cruz y bancos dominicanos.
 *
 * Soporta archivos .xlsx con múltiples columnas, detectando automáticamente:
 *   - Columna de Fecha
 *   - Columna de Descripción / Concepto
 *   - Columna de Referencia / No. Documento
 *   - Columnas separadas de Débito y Crédito o Columna única de Monto con signo
 *   - Columna de Balance / Saldo
 */

export async function parsearEstadoCuentaExcel(
  buffer: Buffer,
): Promise<MovimientoEstado[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("El archivo Excel no contiene hojas de cálculo.");
  }

  let filaEncabezado = 1;
  let idxFecha = -1;
  let idxDesc = -1;
  let idxRef = -1;
  let idxDebito = -1;
  let idxCredito = -1;
  let idxMonto = -1;
  let idxSaldo = -1;

  // Buscar fila de encabezados en las primeras 15 filas
  for (let r = 1; r <= Math.min(15, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    let encontrados = 0;

    row.eachCell((cell, colNumber) => {
      const val = String(cell.value ?? "").toLowerCase().trim();
      if (val.includes("fecha") || val.includes("date")) {
        idxFecha = colNumber;
        encontrados++;
      }
      if (val.includes("descrip") || val.includes("concepto") || val.includes("detalle")) {
        idxDesc = colNumber;
        encontrados++;
      }
      if (val.includes("deb") || val.includes("cargo") || val.includes("retiro")) {
        idxDebito = colNumber;
        encontrados++;
      }
      if (val.includes("cred") || val.includes("abono") || val.includes("deposito")) {
        idxCredito = colNumber;
        encontrados++;
      }
      if (val.includes("monto") || val.includes("importe")) {
        idxMonto = colNumber;
        encontrados++;
      }
      if (val.includes("ref") || val.includes("documento") || val.includes("cheque")) {
        idxRef = colNumber;
        encontrados++;
      }
      if (val.includes("saldo") || val.includes("balance")) {
        idxSaldo = colNumber;
        encontrados++;
      }
    });

    if (idxFecha !== -1 && (idxDesc !== -1 || idxMonto !== -1 || idxCredito !== -1)) {
      filaEncabezado = r;
      break;
    }
  }

  if (idxFecha === -1) {
    throw new Error("No se pudo detectar la columna de fecha en el estado de cuenta.");
  }

  const movimientos: MovimientoEstado[] = [];

  for (let r = filaEncabezado + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const celdaFecha = row.getCell(idxFecha).value;
    if (!celdaFecha) continue;

    const fechaNorm = normalizarFecha(celdaFecha);
    if (!fechaNorm) continue;

    const desc = idxDesc !== -1 ? String(row.getCell(idxDesc).value ?? "").trim() : "Movimiento bancario";
    const ref = idxRef !== -1 ? String(row.getCell(idxRef).value ?? "").trim() : null;

    let montoFinal = 0;

    if (idxDebito !== -1 && idxCredito !== -1) {
      const valDeb = parsearNumero(row.getCell(idxDebito).value);
      const valCred = parsearNumero(row.getCell(idxCredito).value);
      if (valCred > 0) montoFinal = valCred;
      else if (valDeb > 0) montoFinal = -valDeb;
    } else if (idxMonto !== -1) {
      montoFinal = parsearNumero(row.getCell(idxMonto).value);
    }

    if (montoFinal === 0) continue;

    const saldo = idxSaldo !== -1 ? String(parsearNumero(row.getCell(idxSaldo).value) || "") : null;

    movimientos.push({
      fecha: fechaNorm,
      descripcion: desc || "Movimiento",
      referencia: ref && ref !== "" ? ref : null,
      monto: montoFinal.toFixed(2),
      saldo: saldo && saldo !== "" ? saldo : null,
    });
  }

  return movimientos;
}

function parsearNumero(val: unknown): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function normalizarFecha(val: unknown): string | null {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  // Formato DD/MM/YYYY
  const mDmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mDmy) {
    const d = mDmy[1].padStart(2, "0");
    const m = mDmy[2].padStart(2, "0");
    const y = mDmy[3];
    return `${y}-${m}-${d}`;
  }
  // Formato YYYY-MM-DD
  const mYmd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (mYmd) {
    const y = mYmd[1];
    const m = mYmd[2].padStart(2, "0");
    const d = mYmd[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}
