/**
 * Cálculo de Recargos y Mora fiscal dominicana según el Código Tributario:
 * - Art. 251: Recargo por mora del 10% por el primer mes o fracción de mes,
 *   y 4% progresivo por cada mes o fracción subsiguiente.
 * - Art. 252: Interés indemnizatorio del 1.10% por cada mes o fracción de mes.
 */

export type DetalleMoraDgii = {
  montoPrincipal: number;
  fechaVencimiento: string;
  fechaPago: string;
  mesesMora: number;
  porcentajeRecargo: number;
  montoRecargo: number;
  porcentajeInteres: number;
  montoInteres: number;
  totalMoraYRecargos: number;
  totalAPagar: number;
};

export function calcularMesesOFraccion(fechaVencimientoStr: string, fechaPagoStr: string): number {
  const vto = new Date(fechaVencimientoStr);
  const pago = new Date(fechaPagoStr);

  if (pago <= vto) return 0;

  let meses = (pago.getFullYear() - vto.getFullYear()) * 12 + (pago.getMonth() - vto.getMonth());
  if (pago.getDate() > vto.getDate()) {
    meses += 1; // Fracción cuenta como mes completo
  }

  return Math.max(1, meses);
}

export function calcularRecargosYMora(
  montoPrincipal: number,
  fechaVencimiento: string,
  fechaPago: string,
  tasas?: {
    primerMes?: number;
    mesAdicional?: number;
    interesMensual?: number;
  }
): DetalleMoraDgii {
  const monto = Number(montoPrincipal);
  if (monto <= 0) {
    return {
      montoPrincipal: 0,
      fechaVencimiento,
      fechaPago,
      mesesMora: 0,
      porcentajeRecargo: 0,
      montoRecargo: 0,
      porcentajeInteres: 0,
      montoInteres: 0,
      totalMoraYRecargos: 0,
      totalAPagar: 0,
    };
  }

  const primerMesTasa = tasas?.primerMes ?? 0.10; // 10%
  const mesAdicTasa = tasas?.mesAdicional ?? 0.04; // 4%
  const interesTasa = tasas?.interesMensual ?? 0.0110; // 1.10%

  const meses = calcularMesesOFraccion(fechaVencimiento, fechaPago);

  if (meses === 0) {
    return {
      montoPrincipal: monto,
      fechaVencimiento,
      fechaPago,
      mesesMora: 0,
      porcentajeRecargo: 0,
      montoRecargo: 0,
      porcentajeInteres: 0,
      montoInteres: 0,
      totalMoraYRecargos: 0,
      totalAPagar: monto,
    };
  }

  // Recargo: 10% el primero, 4% cada uno de los restantes
  const porcentajeRecargo = primerMesTasa + Math.max(0, meses - 1) * mesAdicTasa;
  const montoRecargo = Number((monto * porcentajeRecargo).toFixed(2));

  // Interés indemnizatorio: 1.10% por cada mes o fracción
  const porcentajeInteres = Number((meses * interesTasa).toFixed(4));
  const montoInteres = Number((monto * porcentajeInteres).toFixed(2));

  const totalMoraYRecargos = Number((montoRecargo + montoInteres).toFixed(2));
  const totalAPagar = Number((monto + totalMoraYRecargos).toFixed(2));

  return {
    montoPrincipal: monto,
    fechaVencimiento,
    fechaPago,
    mesesMora: meses,
    porcentajeRecargo: Number((porcentajeRecargo * 100).toFixed(2)),
    montoRecargo,
    porcentajeInteres: Number((porcentajeInteres * 100).toFixed(2)),
    montoInteres,
    totalMoraYRecargos,
    totalAPagar,
  };
}
