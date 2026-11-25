import type { Partida } from "@/server/contabilidad/codigos-transaccion/asiento";

/**
 * Cómo se arma el asiento de una donación. Lo comparten el registro real y la
 * vista previa «Asiento» para que ambos salgan del mismo cálculo. Vive aparte
 * de `acciones.ts` porque ese archivo es "use server".
 */

export type DatosAsientoDonacion = {
  clase: "efectivo" | "especie";
  moneda: "DOP" | "USD";
  /** Monto en pesos: el asiento no tiene moneda ni tasa. */
  montoDop: number;
  /** Cuenta contable del banco donde entra el dinero (solo `efectivo`). */
  cuentaBancoContableId: string | null;
  /** Cuenta elegida para el bien recibido (solo `especie`); si falta, rige el código. */
  cuentaDestinoEspecieId?: string | null;
};

type LineaExtra = { cuenta_id: string | null; debe: number; haber: number; descripcion: string };

export function armarAsientoDonacion(d: DatosAsientoDonacion): { partidas: Partida[]; lineasExtra: LineaExtra[] } {
  if (d.clase === "especie") {
    const reconocimiento = "Reconocimiento de donación en especie";
    const partidas: Partida[] = [{ codigo: "DON_ESPECIE_INGRESO", monto: d.montoDop, descripcion: reconocimiento }];
    // El bien recibido es una elección de quien registra cuando indica la
    // cuenta; si no, lo cubre el código.
    const lineasExtra: LineaExtra[] = [];
    if (d.cuentaDestinoEspecieId) {
      lineasExtra.push({ cuenta_id: d.cuentaDestinoEspecieId, debe: d.montoDop, haber: 0, descripcion: "Bien recibido en donación" });
    } else {
      partidas.push({ codigo: "DON_ESPECIE_BIEN_RECIBIDO", monto: d.montoDop, descripcion: "Bien recibido en donación" });
    }
    return { partidas, lineasExtra };
  }

  // El origen lo distingue la moneda: pesos es nacional, dólares internacional.
  // Lo «gravado» no tiene cuenta propia y va a la misma.
  const codigoIngreso = d.moneda === "USD" ? "DON_INTERNACIONAL_BANCO" : "DON_NACIONAL_BANCO";
  return {
    partidas: [{ codigo: codigoIngreso, monto: d.montoDop, descripcion: "Reconocimiento de donación" }],
    // El banco lo elige quien registra: línea extra, no código.
    lineasExtra: [{ cuenta_id: d.cuentaBancoContableId, debe: d.montoDop, haber: 0, descripcion: "Entrada a banco donación" }],
  };
}
