import type { Partida } from "@/server/contabilidad/codigos-transaccion/asiento";
import { calcularFacturaCompleta } from "@/server/contabilidad/calculadoras/motor";
import { ErrorOperacion } from "@/server/contabilidad/operaciones/errores";

/**
 * Del cálculo de una factura a las partidas de su asiento. Vive aparte de
 * `acciones.ts` ("use server" solo admite funciones async exportadas) y lo
 * comparten la conversión real y la vista «Asiento».
 *
 * El servidor RECALCULA desde los datos de entrada en vez de recibir los
 * montos ya calculados: así el cliente no puede mandar un asiento que no
 * corresponda a la factura.
 */

export type EntradaFactura = {
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
  itbisTasa: number;
  retencionIsrTasa: number;
  retencionItbisTasa: number;
};

export type AsientoDeFactura = {
  concepto: string;
  partidas: Partida[];
  totales: { subtotalNeto: number; totalItbis: number; retencionIsr: number; retencionItbis: number; netoAPagar: number };
};

const finito = (n: unknown) => typeof n === "number" && Number.isFinite(n);

export function asientoDeFactura(entrada: EntradaFactura): AsientoDeFactura {
  if (!Object.values(entrada).every(finito)) throw new ErrorOperacion("calculo_invalido");

  const r = calcularFacturaCompleta({
    lineas: [
      {
        descripcion: "Servicio profesional / honorarios",
        cantidad: entrada.cantidad,
        precioUnitario: entrada.precioUnitario,
        descuentoPorcentaje: entrada.descuentoPorcentaje,
        itbisTasa: entrada.itbisTasa,
      },
    ],
    retencionIsrTasa: entrada.retencionIsrTasa,
    retencionItbisTasa: entrada.retencionItbisTasa,
  });

  // Gasto + ITBIS = retenciones + neto, siempre; si no, el cálculo trae algo inválido.
  const debe = Math.round((r.subtotalNeto + r.totalItbis) * 100);
  const haber = Math.round((r.retencionIsr + r.retencionItbis + r.netoAPagar) * 100);
  if (debe !== haber) throw new ErrorOperacion("calculo_descuadrado", { debe: debe / 100, haber: haber / 100 });

  return {
    concepto: `Asiento borrador de factura (calculadora) - Neto: ${r.netoAPagar.toFixed(2)}`,
    // Las retenciones en cero no aparecen: el motor ignora los montos en cero.
    partidas: [
      { codigo: "CALC_FACTURA_GASTO", monto: r.subtotalNeto, descripcion: "Gasto de servicios profesionales" },
      { codigo: "CALC_FACTURA_ITBIS_ADELANTADO", monto: r.totalItbis, descripcion: "ITBIS pagado / adelantado" },
      { codigo: "CALC_FACTURA_ISR_RETENIDO", monto: r.retencionIsr, descripcion: "Retención de ISR por pagar (Ley 30-26)" },
      { codigo: "CALC_FACTURA_ITBIS_RETENIDO", monto: r.retencionItbis, descripcion: "Retención de ITBIS por pagar" },
      { codigo: "CALC_FACTURA_CXP_NETO", monto: r.netoAPagar, descripcion: "Cuentas por pagar a proveedores (Neto)" },
    ],
    totales: {
      subtotalNeto: r.subtotalNeto,
      totalItbis: r.totalItbis,
      retencionIsr: r.retencionIsr,
      retencionItbis: r.retencionItbis,
      netoAPagar: r.netoAPagar,
    },
  };
}
