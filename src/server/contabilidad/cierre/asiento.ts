import type { Partida } from "@/server/contabilidad/codigos-transaccion/asiento";
import type { ResumenPreCierreAnual } from "@/server/contabilidad/cierre/consultas";

/**
 * Cómo se arma el asiento del cierre anual. Lo comparten el cierre real y la
 * vista previa «Asiento». Vive aparte de `acciones.ts` porque ese archivo es
 * "use server".
 *
 * Cada cuenta de ingreso y de gasto con saldo se cancela contra el código de
 * resultados acumulados (superávit si los ingresos ganan, déficit si pierden):
 * dos códigos y no uno porque un código tiene un solo lado y la contrapartida
 * cambia de lado según el signo del resultado.
 */

type LineaExtra = { cuenta_id: string; debe: number; haber: number; descripcion: string };

export function armarAsientoCierre(
  resumen: ResumenPreCierreAnual,
  ejercicio: number,
): { partidas: Partida[]; lineasExtra: LineaExtra[]; hayMovimientos: boolean } {
  const lineasExtra: LineaExtra[] = [];

  // Un saldo con el signo contrario al normal (ingreso deudor, gasto
  // acreedor) se cancela por el lado opuesto, para que el asiento cuadre.
  for (const ing of resumen.cuentasIngresoSaldar) {
    lineasExtra.push({
      cuenta_id: ing.cuentaId,
      debe: Math.max(ing.saldo, 0),
      haber: Math.max(-ing.saldo, 0),
      descripcion: `Cancelación saldo acreedor ingreso: ${ing.nombre}`,
    });
  }
  for (const gas of resumen.cuentasGastoSaldar) {
    lineasExtra.push({
      cuenta_id: gas.cuentaId,
      debe: Math.max(-gas.saldo, 0),
      haber: Math.max(gas.saldo, 0),
      descripcion: `Cancelación saldo deudor gasto: ${gas.nombre}`,
    });
  }

  const resultado = resumen.superavitDeficitNeto;
  const partidas: Partida[] =
    resultado >= 0
      ? [{
          codigo: "CIE_RESULTADOS_ACUMULADOS_SUPERAVIT",
          monto: resultado,
          descripcion: `Superávit neto del ejercicio ${ejercicio} trasladado a Resultados Acumulados`,
        }]
      : [{
          codigo: "CIE_RESULTADOS_ACUMULADOS_DEFICIT",
          monto: Math.abs(resultado),
          descripcion: `Déficit neto del ejercicio ${ejercicio} absorbido en Resultados Acumulados`,
        }];

  return {
    partidas,
    lineasExtra,
    hayMovimientos: resumen.cuentasIngresoSaldar.length > 0 || resumen.cuentasGastoSaldar.length > 0,
  };
}

export function conceptoDeCierre(ejercicio: number): string {
  return `Asiento de Cierre Ejercicio Fiscal ${ejercicio} - Cancelación de Cuentas de Resultados`;
}
