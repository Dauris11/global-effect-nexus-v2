import { consultar, consultarUna } from "@/lib/db";

export type ResultadoTxtDgii = {
  formato: "606" | "607" | "608" | "609";
  periodo: string;
  rncEntidad: string;
  totalRegistros: number;
  montoTotal: number;
  esEnvioEnCero: boolean;
  contenido: string;
  erroresValidacion: string[];
};

function formatMonto(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  return isNaN(num) ? "0.00" : num.toFixed(2);
}

function formatFecha(fechaIso: string | null | undefined): string {
  if (!fechaIso) return "";
  return fechaIso.slice(0, 10).replace(/-/g, "");
}

function limpiarRnc(id: string | null | undefined): string {
  if (!id) return "";
  return id.replace(/\D/g, "");
}

export async function generarTxt606(anio: number, mes: number, forzarEnCero = false): Promise<ResultadoTxtDgii> {
  const entidad = await consultarUna<{ rnc: string }>(
    `SELECT COALESCE(rnc, '131000000') AS rnc FROM contabilidad.entidad LIMIT 1`
  );
  const rncEntidad = limpiarRnc(entidad?.rnc || "131000000");
  const periodoStr = `${anio}${String(mes).padStart(2, "0")}`;
  const periodoIso = `${anio}-${String(mes).padStart(2, "0")}`;

  if (forzarEnCero) {
    const cabecera = `${rncEntidad}|${periodoStr}|0|0.00`;
    return {
      formato: "606",
      periodo: periodoIso,
      rncEntidad,
      totalRegistros: 0,
      montoTotal: 0,
      esEnvioEnCero: true,
      contenido: cabecera,
      erroresValidacion: [],
    };
  }

  // Buscar facturas del período
  const sql = `
    SELECT
      pr.identificacion AS "proveedorId",
      pr.tipo AS "proveedorTipo",
      fp.ncf,
      fp.fecha_emision::text AS "fechaEmision",
      COALESCE(fp.fecha_emision::text, '') AS "fechaPago",
      fp.subtotal::float,
      fp.itbis::float,
      fp.retencion_itbis::float AS "retencionItbis",
      fp.retencion_isr::float AS "retencionIsr"
    FROM contabilidad.factura_proveedor fp
    JOIN contabilidad.proveedor pr ON pr.id = fp.proveedor_id
    JOIN contabilidad.periodo_contable pc ON pc.id = fp.periodo_id
    WHERE to_char(make_date(pc.anio, pc.mes, 1), 'YYYY-MM') = $1 AND fp.estado = 'aprobada'
    ORDER BY fp.fecha_emision ASC, fp.numero ASC
  `;

  const facturas = await consultar<{
    proveedorId: string;
    proveedorTipo: string;
    ncf: string | null;
    fechaEmision: string;
    fechaPago: string;
    subtotal: number;
    itbis: number;
    retencionItbis: number;
    retencionIsr: number;
  }>(sql, [periodoIso]);

  const errores: string[] = [];
  let sumaTotal = 0;
  const lineas: string[] = [];

  for (let i = 0; i < facturas.length; i++) {
    const f = facturas[i];
    const rnc = limpiarRnc(f.proveedorId);
    const tipoId = f.proveedorTipo === "juridica" ? "1" : "2";

    if (!rnc || (rnc.length !== 9 && rnc.length !== 11)) {
      errores.push(`Línea ${i + 1}: RNC/Cédula inválido (${f.proveedorId})`);
    }

    const ncf = f.ncf?.trim() ?? "";
    if (!ncf) {
      errores.push(`Línea ${i + 1}: Falta el NCF del proveedor`);
    }

    const totalFactura = f.subtotal + f.itbis;
    sumaTotal += totalFactura;

    const fechaDoc = formatFecha(f.fechaEmision);
    const fechaPag = formatFecha(f.fechaPago || f.fechaEmision);

    // Campos 606: 23 columnas
    const col = [
      rnc,                                  // 1. RNC o Cédula
      tipoId,                               // 2. Tipo ID (1: RNC, 2: Cédula)
      "02",                                 // 3. Tipo Bienes/Servicios (02 Trabajos/Servicios por omisión)
      ncf,                                  // 4. NCF
      "",                                   // 5. NCF Modificado
      fechaDoc,                             // 6. Fecha Comprobante
      fechaPag,                             // 7. Fecha Pago
      formatMonto(f.subtotal),              // 8. Facturado en Servicios
      "0.00",                               // 9. Facturado en Bienes
      formatMonto(totalFactura),            // 10. Total Facturado
      formatMonto(f.itbis),                 // 11. ITBIS Facturado
      formatMonto(f.retencionItbis),         // 12. ITBIS Retenido
      "0.00",                               // 13. ITBIS sujeto a Proporcionalidad
      formatMonto(f.itbis),                 // 14. ITBIS al Costo (para ASFL)
      "0.00",                               // 15. ITBIS por Adelantar
      "0.00",                               // 16. ITBIS Percibido
      f.retencionIsr > 0 ? "02" : "",       // 17. Tipo Retención ISR (02 Honorarios)
      formatMonto(f.retencionIsr),           // 18. Retención ISR
      "0.00",                               // 19. ISR Percibido
      "0.00",                               // 20. ISC
      "0.00",                               // 21. Otros Impuestos
      "0.00",                               // 22. Propina Legal
      "02",                                 // 23. Forma de Pago (02 Transferencia)
    ];

    lineas.push(col.join("|"));
  }

  const cabecera = `${rncEntidad}|${periodoStr}|${facturas.length}|${formatMonto(sumaTotal)}`;
  const contenido = facturas.length === 0 ? cabecera : `${cabecera}\n${lineas.join("\n")}`;

  return {
    formato: "606",
    periodo: periodoIso,
    rncEntidad,
    totalRegistros: facturas.length,
    montoTotal: sumaTotal,
    esEnvioEnCero: facturas.length === 0,
    contenido,
    erroresValidacion: errores,
  };
}

export async function generarTxt607(anio: number, mes: number, forzarEnCero = false): Promise<ResultadoTxtDgii> {
  const entidad = await consultarUna<{ rnc: string }>(
    `SELECT COALESCE(rnc, '131000000') AS rnc FROM contabilidad.entidad LIMIT 1`
  );
  const rncEntidad = limpiarRnc(entidad?.rnc || "131000000");
  const periodoStr = `${anio}${String(mes).padStart(2, "0")}`;
  const periodoIso = `${anio}-${String(mes).padStart(2, "0")}`;

  if (forzarEnCero) {
    const cabecera = `${rncEntidad}|${periodoStr}|0`;
    return {
      formato: "607",
      periodo: periodoIso,
      rncEntidad,
      totalRegistros: 0,
      montoTotal: 0,
      esEnvioEnCero: true,
      contenido: cabecera,
      erroresValidacion: [],
    };
  }

  // Ingresos por donaciones u operaciones gravadas
  const sql = `
    SELECT
      COALESCE(t.identificacion, '000000000') AS "clienteId",
      COALESCE(t.tipo_persona, 'fisica') AS "clienteTipo",
      d.comprobante_externo_numero AS ncf,
      d.fecha::text AS "fecha",
      d.monto_dop::float AS monto
    FROM contabilidad.donacion d
    JOIN contabilidad.tercero t ON t.id = d.tercero_id
    JOIN contabilidad.periodo_contable pc ON pc.id = d.periodo_id
    WHERE to_char(make_date(pc.anio, pc.mes, 1), 'YYYY-MM') = $1 AND d.estado = 'confirmada'
    ORDER BY d.fecha ASC, d.numero ASC
  `;

  const ingresos = await consultar<{
    clienteId: string;
    clienteTipo: string;
    ncf: string | null;
    fecha: string;
    monto: number;
  }>(sql, [periodoIso]);

  const errores: string[] = [];
  let sumaTotal = 0;
  const lineas: string[] = [];

  for (let i = 0; i < ingresos.length; i++) {
    const ing = ingresos[i];
    const rnc = limpiarRnc(ing.clienteId);
    const tipoId = ing.clienteTipo === "juridica" ? "1" : "2";
    const fechaDoc = formatFecha(ing.fecha);
    const ncf = ing.ncf || `B02${String(i + 1).padStart(8, "0")}`;
    sumaTotal += ing.monto;

    // Campos 607: 23 columnas
    const col = [
      rnc,                                  // 1. RNC o Cédula
      tipoId,                               // 2. Tipo ID
      ncf,                                  // 3. NCF
      "",                                   // 4. NCF Modificado
      "01",                                 // 5. Tipo de Ingreso (01 Operaciones)
      fechaDoc,                             // 6. Fecha Comprobante
      fechaDoc,                             // 7. Fecha Retención
      formatMonto(ing.monto),               // 8. Monto Facturado
      "0.00",                               // 9. ITBIS Facturado
      "0.00",                               // 10. ITBIS Retenido
      "0.00",                               // 11. ITBIS Percibido
      "0.00",                               // 12. Retención Renta
      "0.00",                               // 13. ISR Percibido
      "0.00",                               // 14. ISC
      "0.00",                               // 15. Otros Impuestos
      "0.00",                               // 16. Propina Legal
      "0.00",                               // 17. Efectivo
      formatMonto(ing.monto),               // 18. Cheque/Transferencia
      "0.00",                               // 19. Tarjeta
      "0.00",                               // 20. Venta a Crédito
      "0.00",                               // 21. Bonos
      "0.00",                               // 22. Permuta
      "0.00",                               // 23. Otras Formas
    ];

    lineas.push(col.join("|"));
  }

  const cabecera = `${rncEntidad}|${periodoStr}|${ingresos.length}`;
  const contenido = ingresos.length === 0 ? cabecera : `${cabecera}\n${lineas.join("\n")}`;

  return {
    formato: "607",
    periodo: periodoIso,
    rncEntidad,
    totalRegistros: ingresos.length,
    montoTotal: sumaTotal,
    esEnvioEnCero: ingresos.length === 0,
    contenido,
    erroresValidacion: errores,
  };
}

export async function generarTxt608(anio: number, mes: number, forzarEnCero = true): Promise<ResultadoTxtDgii> {
  const entidad = await consultarUna<{ rnc: string }>(
    `SELECT COALESCE(rnc, '131000000') AS rnc FROM contabilidad.entidad LIMIT 1`
  );
  const rncEntidad = limpiarRnc(entidad?.rnc || "131000000");
  const periodoStr = `${anio}${String(mes).padStart(2, "0")}`;
  const periodoIso = `${anio}-${String(mes).padStart(2, "0")}`;

  // La fundación normalmente envía en cero el 608 ya que no emite facturas
  const cabecera = `${rncEntidad}|${periodoStr}|0`;
  return {
    formato: "608",
    periodo: periodoIso,
    rncEntidad,
    totalRegistros: 0,
    montoTotal: 0,
    esEnvioEnCero: true,
    contenido: cabecera,
    erroresValidacion: [],
  };
}

export async function generarTxt609(anio: number, mes: number, forzarEnCero = true): Promise<ResultadoTxtDgii> {
  const entidad = await consultarUna<{ rnc: string }>(
    `SELECT COALESCE(rnc, '131000000') AS rnc FROM contabilidad.entidad LIMIT 1`
  );
  const rncEntidad = limpiarRnc(entidad?.rnc || "131000000");
  const periodoStr = `${anio}${String(mes).padStart(2, "0")}`;
  const periodoIso = `${anio}-${String(mes).padStart(2, "0")}`;

  const cabecera = `${rncEntidad}|${periodoStr}|0|0.00`;
  return {
    formato: "609",
    periodo: periodoIso,
    rncEntidad,
    totalRegistros: 0,
    montoTotal: 0,
    esEnvioEnCero: true,
    contenido: cabecera,
    erroresValidacion: [],
  };
}
