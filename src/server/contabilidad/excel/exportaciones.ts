import { consultar, consultarUna } from "@/lib/db";
import { crearLibroExcel, type ColumnaExcel } from "./generador-excel";
import { nombrePrograma } from "@/lib/contabilidad/programas";

/**
 * EXPORTACIÓN FORMATO 606 (Compras y Gastos para DGII).
 *
 * Genera el libro Excel con las especificaciones del formato oficial de compras
 * de la Dirección General de Impuestos Internos (DGII) de la República Dominicana,
 * incorporando una columna interna con el Programa de la Fundación para fines
 * de control y auditoría social de la ISFL.
 */
export async function exportarFormato606Excel(params: {
  anio: number;
  mes: number;
}): Promise<Buffer> {
  const facturas = await consultar<{
    rnc: string;
    tipo_proveedor: string;
    ncf: string | null;
    fecha_emision: string;
    fecha_pago: string | null;
    subtotal: string;
    itbis: string;
    retencion_itbis: string;
    retencion_isr: string;
    total: string;
    concepto: string;
    programa_codigo: string | null;
    solicitante_nombre: string | null;
  }>(
    `SELECT
       p.identificacion AS rnc,
       p.tipo AS tipo_proveedor,
       f.ncf,
       to_char(f.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
       to_char(c.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_pago,
       f.subtotal,
       f.itbis,
       f.retencion_itbis,
       f.retencion_isr,
       f.total,
       f.concepto,
       f.programa_codigo,
       u.nombre AS solicitante_nombre
     FROM contabilidad.factura_proveedor f
     JOIN contabilidad.proveedor p ON f.proveedor_id = p.id
     JOIN contabilidad.periodo_contable pc ON f.periodo_id = pc.id
     LEFT JOIN contabilidad.cuenta_por_pagar c ON f.id = c.factura_id
     LEFT JOIN public.usuario u ON f.solicitante_id = u.id
     WHERE pc.anio = $1 AND pc.mes = $2 AND f.estado <> 'anulada'
     ORDER BY f.fecha_emision ASC, f.numero ASC`,
    [params.anio, params.mes],
  );

  const columnas: ColumnaExcel[] = [
    { header: "RNC / Cédula", key: "rnc", width: 16, formato: "texto" },
    { header: "Tipo Id", key: "tipo_id", width: 10, formato: "texto" },
    { header: "NCF / e-CF", key: "ncf", width: 16, formato: "texto" },
    { header: "Fecha Emisión", key: "fecha_emision", width: 14, formato: "fecha" },
    { header: "Subtotal Facturado", key: "subtotal", width: 18, formato: "moneda" },
    { header: "ITBIS Facturado", key: "itbis", width: 16, formato: "moneda" },
    { header: "ITBIS Retenido", key: "retencion_itbis", width: 16, formato: "moneda" },
    { header: "ISR Retenido", key: "retencion_isr", width: 16, formato: "moneda" },
    { header: "Total Factura", key: "total", width: 18, formato: "moneda" },
    { header: "Programa Institucional", key: "programa", width: 26, formato: "texto" },
    { header: "Solicitante / Custodio", key: "solicitante", width: 22, formato: "texto" },
    { header: "Concepto / Descripción", key: "concepto", width: 35, formato: "texto" },
  ];

  let sumSubtotal = 0;
  let sumItbis = 0;
  let sumRetItbis = 0;
  let sumRetIsr = 0;
  let sumTotal = 0;

  const filas = facturas.map((f) => {
    const sub = parseFloat(f.subtotal);
    const itb = parseFloat(f.itbis);
    const ritb = parseFloat(f.retencion_itbis);
    const risr = parseFloat(f.retencion_isr);
    const tot = parseFloat(f.total);

    sumSubtotal += sub;
    sumItbis += itb;
    sumRetItbis += ritb;
    sumRetIsr += risr;
    sumTotal += tot;

    return {
      rnc: f.rnc,
      tipo_id: f.tipo_proveedor === "juridica" ? "1 (RNC)" : "2 (Cédula)",
      ncf: f.ncf ?? "Sin NCF (Gasto menor)",
      fecha_emision: f.fecha_emision,
      subtotal: sub,
      itbis: itb,
      retencion_itbis: ritb,
      retencion_isr: risr,
      total: tot,
      programa: nombrePrograma(f.programa_codigo),
      solicitante: f.solicitante_nombre ?? "No especificado",
      concepto: f.concepto,
    };
  });

  return crearLibroExcel({
    tituloHoja: `DGII 606 - ${params.anio}-${String(params.mes).padStart(2, "0")}`,
    columnas,
    filas,
    totales: {
      rnc: "TOTALES",
      subtotal: sumSubtotal,
      itbis: sumItbis,
      retencion_itbis: sumRetItbis,
      retencion_isr: sumRetIsr,
      total: sumTotal,
    },
  });
}

/**
 * EXPORTACIÓN LIBRO DE BANCO A EXCEL.
 *
 * Detalle cronológico de todos los movimientos de una cuenta bancaria
 * (Banco Santa Cruz DOP/USD) con saldo corrido.
 */
export async function exportarLibroBancoExcel(cuentaId: string): Promise<Buffer> {
  const cuenta = await consultarUna<{
    banco_nombre: string;
    numero_cuenta: string;
    moneda: string;
  }>(
    `SELECT b.nombre AS banco_nombre, c.numero_cuenta, c.moneda
       FROM contabilidad.cuenta_bancaria c
       JOIN contabilidad.banco b ON c.banco_id = b.id
      WHERE c.id = $1`,
    [cuentaId],
  );

  const movimientos = await consultar<{
    numero: number;
    fecha: string;
    tipo: string;
    beneficiario: string | null;
    concepto: string | null;
    referencia: string | null;
    debito: string;
    credito: string;
    saldo_resultante: string;
  }>(
    `SELECT
       m.numero,
       to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
       m.tipo,
       m.beneficiario,
       m.concepto,
       m.referencia,
       CASE WHEN m.importe < 0 THEN abs(m.importe)::text ELSE '0.00' END AS debito,
       CASE WHEN m.importe > 0 THEN m.importe::text ELSE '0.00' END AS credito,
       m.saldo_resultante
     FROM contabilidad.movimiento_bancario m
     WHERE m.cuenta_bancaria_id = $1
     ORDER BY m.fecha ASC, m.numero ASC`,
    [cuentaId],
  );

  const columnas: ColumnaExcel[] = [
    { header: "No. Mov.", key: "numero", width: 12, formato: "entero" },
    { header: "Fecha", key: "fecha", width: 14, formato: "fecha" },
    { header: "Tipo de Operación", key: "tipo", width: 22, formato: "texto" },
    { header: "Beneficiario / Emisor", key: "beneficiario", width: 25, formato: "texto" },
    { header: "Referencia", key: "referencia", width: 18, formato: "texto" },
    { header: "Concepto", key: "concepto", width: 35, formato: "texto" },
    { header: "Débitos (Salidas)", key: "debito", width: 18, formato: "moneda" },
    { header: "Créditos (Entradas)", key: "credito", width: 18, formato: "moneda" },
    { header: "Saldo en Libros", key: "saldo_resultante", width: 20, formato: "moneda" },
  ];

  const filas = movimientos.map((m) => ({
    numero: m.numero,
    fecha: m.fecha,
    tipo: m.tipo.replace(/_/g, " ").toUpperCase(),
    beneficiario: m.beneficiario ?? "-",
    referencia: m.referencia ?? "-",
    concepto: m.concepto ?? "-",
    debito: parseFloat(m.debito),
    credito: parseFloat(m.credito),
    saldo_resultante: parseFloat(m.saldo_resultante),
  }));

  const nombreHoja = cuenta
    ? `Banco ${cuenta.moneda} - ${cuenta.numero_cuenta.slice(-4)}`
    : "Libro de Banco";

  return crearLibroExcel({
    tituloHoja: nombreHoja,
    columnas,
    filas,
  });
}

/**
 * EXPORTACIÓN CUENTAS POR PAGAR (CxP) Y ANTIGÜEDAD DE SALDOS.
 */
export async function exportarCxpExcel(): Promise<Buffer> {
  const cxp = await consultar<{
    proveedor: string;
    rnc: string;
    ncf: string | null;
    fecha_emision: string;
    fecha_vencimiento: string;
    dias_mora: number;
    monto: string;
    pagado: string;
    saldo_pendiente: string;
    estado: string;
    programa_codigo: string | null;
  }>(
    `SELECT
       p.nombre AS proveedor,
       p.identificacion AS rnc,
       f.ncf,
       to_char(c.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
       to_char(c.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
       GREATEST(0, (CURRENT_DATE - c.fecha_vencimiento)) AS dias_mora,
       c.monto,
       c.pagado,
       (c.monto - c.pagado) AS saldo_pendiente,
       c.estado,
       f.programa_codigo
     FROM contabilidad.cuenta_por_pagar c
     LEFT JOIN contabilidad.proveedor p ON c.proveedor_id = p.id
     LEFT JOIN contabilidad.factura_proveedor f ON c.factura_id = f.id
     WHERE c.estado NOT IN ('pagada', 'anulada')
     ORDER BY c.fecha_vencimiento ASC`,
  );

  const columnas: ColumnaExcel[] = [
    { header: "Proveedor", key: "proveedor", width: 28, formato: "texto" },
    { header: "RNC / Cédula", key: "rnc", width: 16, formato: "texto" },
    { header: "NCF", key: "ncf", width: 16, formato: "texto" },
    { header: "Emisión", key: "fecha_emision", width: 14, formato: "fecha" },
    { header: "Vencimiento", key: "fecha_vencimiento", width: 14, formato: "fecha" },
    { header: "Días Vencido", key: "dias_mora", width: 14, formato: "entero" },
    { header: "Monto Original", key: "monto", width: 18, formato: "moneda" },
    { header: "Monto Pagado", key: "pagado", width: 16, formato: "moneda" },
    { header: "Saldo Pendiente", key: "saldo_pendiente", width: 18, formato: "moneda" },
    { header: "Estado", key: "estado", width: 14, formato: "texto" },
    { header: "Programa Asignado", key: "programa", width: 26, formato: "texto" },
  ];

  let totalPendiente = 0;
  const filas = cxp.map((c) => {
    const pend = parseFloat(c.saldo_pendiente);
    totalPendiente += pend;
    return {
      proveedor: c.proveedor,
      rnc: c.rnc,
      ncf: c.ncf ?? "Gasto / Solicitud",
      fecha_emision: c.fecha_emision,
      fecha_vencimiento: c.fecha_vencimiento,
      dias_mora: c.dias_mora,
      monto: parseFloat(c.monto),
      pagado: parseFloat(c.pagado),
      saldo_pendiente: pend,
      estado: c.estado.toUpperCase(),
      programa: nombrePrograma(c.programa_codigo),
    };
  });

  return crearLibroExcel({
    tituloHoja: "Cuentas por Pagar (CxP)",
    columnas,
    filas,
    totales: {
      proveedor: "TOTAL PENDIENTE",
      saldo_pendiente: totalPendiente,
    },
  });
}
