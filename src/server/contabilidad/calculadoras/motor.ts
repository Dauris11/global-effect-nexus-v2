/**
 * Motor de cálculos contables y fiscales dominicanos (Global Effect Nexus).
 * Funciones puras con precisión decimal exacta para las calculadoras del ERP.
 */

// ── 1. ITBIS (Directo e Inverso) ───────────────────────────────────
export function calcularItbis(params: {
  monto: number;
  tipo: "directo" | "inverso";
  tasa?: number; // 0.18 por defecto
}) {
  const tasa = params.tasa !== undefined ? Number(params.tasa) : 0.18;
  const monto = Number(params.monto || 0);

  if (params.tipo === "directo") {
    const base = monto;
    const impuesto = Number((base * tasa).toFixed(2));
    const total = Number((base + impuesto).toFixed(2));
    return { base, impuesto, total, tasa };
  } else {
    const total = monto;
    const base = Number((total / (1 + tasa)).toFixed(2));
    const impuesto = Number((total - base).toFixed(2));
    return { base, impuesto, total, tasa };
  }
}

// ── 2. Calculadora de Factura y Comprobante ────────────────────────
export type LineaFacturaCalculo = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje?: number;
  itbisTasa?: number;
};

export function calcularFacturaCompleta(params: {
  lineas: LineaFacturaCalculo[];
  retencionIsrTasa?: number;   // ej. 0.15 (15% Ley 30-26)
  retencionItbisTasa?: number; // ej. 0.30 (30% Norma 02-05) o 1.00
}) {
  let subtotalBruto = 0;
  let totalDescuentos = 0;
  let subtotalNeto = 0;
  let totalItbis = 0;

  const lineasDetalle = params.lineas.map((l) => {
    const cant = Number(l.cantidad || 0);
    const precio = Number(l.precioUnitario || 0);
    const bruto = cant * precio;
    const descPct = Number(l.descuentoPorcentaje || 0);
    const descMonto = Number((bruto * (descPct / 100)).toFixed(2));
    const neto = bruto - descMonto;
    const itTasa = l.itbisTasa !== undefined ? Number(l.itbisTasa) : 0.18;
    const itMonto = Number((neto * itTasa).toFixed(2));
    const tot = neto + itMonto;

    subtotalBruto += bruto;
    totalDescuentos += descMonto;
    subtotalNeto += neto;
    totalItbis += itMonto;

    return {
      descripcion: l.descripcion,
      cantidad: cant,
      precioUnitario: precio,
      bruto,
      descuentoMonto: descMonto,
      neto,
      itbisTasa: itTasa,
      itbisMonto: itMonto,
      total: tot,
    };
  });

  const retIsrTasa = Number(params.retencionIsrTasa || 0);
  const retItTasa = Number(params.retencionItbisTasa || 0);

  const retencionIsr = Number((subtotalNeto * retIsrTasa).toFixed(2));
  const retencionItbis = Number((totalItbis * retItTasa).toFixed(2));
  const totalFactura = Number((subtotalNeto + totalItbis).toFixed(2));
  const netoAPagar = Number((totalFactura - retencionIsr - retencionItbis).toFixed(2));

  return {
    lineas: lineasDetalle,
    subtotalBruto: Number(subtotalBruto.toFixed(2)),
    totalDescuentos: Number(totalDescuentos.toFixed(2)),
    subtotalNeto: Number(subtotalNeto.toFixed(2)),
    totalItbis: Number(totalItbis.toFixed(2)),
    totalFactura,
    retencionIsr,
    retencionItbis,
    netoAPagar,
  };
}

// ── 3. Retenciones Dominicanas según Normativa ───────────────────────
export function calcularRetencionesDominicanas(params: {
  subtotal: number;
  itbis: number;
  tipoProveedor: "fisica" | "juridica";
  conceptoServicio: "honorarios" | "alquileres" | "servicios_tecnicos" | "bienes";
  fecha?: string; // para aplicar tasa Ley 30-26 si es >= 2026-07-01
}) {
  const st = Number(params.subtotal || 0);
  const it = Number(params.itbis || 0);
  const fecha = params.fecha || new Date().toISOString().slice(0, 10);

  let tasaIsr = 0;
  let tasaItbis = 0;

  if (params.tipoProveedor === "fisica") {
    if (params.conceptoServicio === "honorarios" || params.conceptoServicio === "alquileres") {
      // Ley 30-26: 15% a partir del 1 de julio de 2026, 10% antes
      tasaIsr = fecha >= "2026-07-01" ? 0.15 : 0.10;
      tasaItbis = 1.00; // 100% retención ITBIS si es persona física por servicios (NG 02-05 / 08-10)
    } else if (params.conceptoServicio === "servicios_tecnicos") {
      tasaIsr = 0.02; // 2%
      tasaItbis = 1.00;
    }
  } else {
    // Proveedor persona jurídica
    if (params.conceptoServicio === "servicios_tecnicos" || params.conceptoServicio === "honorarios") {
      tasaIsr = 0; // Entre jurídicas no hay retención de renta salvo estados
      tasaItbis = 0.30; // 30% ITBIS retenido entre jurídicas (NG 02-05)
    }
  }

  const retencionIsr = Number((st * tasaIsr).toFixed(2));
  const retencionItbis = Number((it * tasaItbis).toFixed(2));
  const totalRetenciones = Number((retencionIsr + retencionItbis).toFixed(2));
  const netoAPagar = Number((st + it - totalRetenciones).toFixed(2));

  return {
    subtotal: st,
    itbis: it,
    tasaIsr,
    retencionIsr,
    tasaItbis,
    retencionItbis,
    totalRetenciones,
    netoAPagar,
  };
}

// ── 4. Préstamos y Amortización (Sistema Francés) ───────────────────
export function calcularAmortizacionFrancesa(params: {
  monto: number;
  tasaAnualPorcentaje: number;
  plazoMeses: number;
}) {
  const P = Number(params.monto || 0);
  const r = (Number(params.tasaAnualPorcentaje || 0) / 100) / 12;
  const n = Math.max(1, Math.min(360, Number(params.plazoMeses || 1)));

  let cuotaMensual = 0;
  if (r === 0) {
    cuotaMensual = P / n;
  } else {
    cuotaMensual = (P * r) / (1 - Math.pow(1 + r, -n));
  }
  cuotaMensual = Number(cuotaMensual.toFixed(2));

  let saldo = P;
  let totalIntereses = 0;
  const tabla = [];

  for (let mes = 1; mes <= n; mes++) {
    const interes = Number((saldo * r).toFixed(2));
    const capital = Number((cuotaMensual - interes).toFixed(2));
    saldo = Number(Math.max(0, saldo - capital).toFixed(2));
    totalIntereses += interes;

    tabla.push({
      mes,
      cuota: cuotaMensual,
      capital,
      interes,
      saldoRestante: saldo,
    });
  }

  return {
    montoPrestamo: P,
    tasaAnual: params.tasaAnualPorcentaje,
    plazoMeses: n,
    cuotaMensual,
    totalIntereses: Number(totalIntereses.toFixed(2)),
    totalAPagar: Number((P + totalIntereses).toFixed(2)),
    tabla,
  };
}

// ── 5. Salarios y Seguridad Social (TSS e ISR) ───────────────────────
export function calcularDeduccionesLaborales(salarioBruto: number) {
  const sb = Number(salarioBruto || 0);

  // Topes TSS RD: AFP y SFS (aprox RD$ 193,000 / 386,000 según SMN)
  const afpEmpleado = Number((sb * 0.0287).toFixed(2)); // 2.87%
  const sfsEmpleado = Number((sb * 0.0304).toFixed(2)); // 3.04%
  const totalTss = Number((afpEmpleado + sfsEmpleado).toFixed(2));

  // Renta neta imponible mensual
  const baseIsr = sb - totalTss;
  const baseAnual = baseIsr * 12;

  // Escala ISR Persona Física República Dominicana (DGII):
  // Hasta 416,220.00: Exento (34,685.00 mensual)
  // De 416,220.01 a 624,329.00: 15% sobre el excedente
  // De 624,329.01 a 867,123.00: 31,216.00 + 20% sobre excedente
  // Más de 867,123.01: 79,776.00 + 25% sobre excedente
  let isrAnual = 0;
  if (baseAnual > 867123) {
    isrAnual = 79776 + (baseAnual - 867123) * 0.25;
  } else if (baseAnual > 624329) {
    isrAnual = 31216 + (baseAnual - 624329) * 0.20;
  } else if (baseAnual > 416220) {
    isrAnual = (baseAnual - 416220) * 0.15;
  }

  const isrMensual = Number((isrAnual / 12).toFixed(2));
  const salarioNeto = Number((sb - totalTss - isrMensual).toFixed(2));

  return {
    salarioBruto: sb,
    afpEmpleado,
    sfsEmpleado,
    totalTssEmpleado: totalTss,
    baseImponibleIsr: Number(baseIsr.toFixed(2)),
    isrMensual,
    totalDeducciones: Number((totalTss + isrMensual).toFixed(2)),
    salarioNeto,
  };
}
