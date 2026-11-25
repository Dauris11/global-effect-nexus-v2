import type { PoolClient } from "pg";

import type { Partida } from "@/server/contabilidad/codigos-transaccion/asiento";

/**
 * Armado del asiento de caja chica. Lo usan a la vez la acción que
 * contabiliza y la opción «Asiento» (vista previa), para que lo que se ve
 * antes de contabilizar sea exactamente lo que se registra después.
 *
 * Solo el arqueo trabaja con códigos de transacción (faltante y sobrante):
 * en un gasto de caja las dos cuentas las elige la persona (la categoría del
 * gasto y la cuenta de la caja), así que no hay código que asignar.
 */

/** Línea con las llaves que espera `crear_asiento`. */
export type LineaCaja<C extends string | null = string | null> = {
  cuenta_id: C;
  debe: number;
  haber: number;
  descripcion: string;
};

/**
 * Gasto o vale liquidado: gasto contra la cuenta de la caja. Se devuelve con
 * las llaves de `crear_asiento` (sin `haber` en el débito y viceversa) para
 * que el asiento quede idéntico al de siempre.
 */
export function lineasDeGastoCaja<G extends string | null, C extends string | null>(datos: {
  cuentaGasto: G;
  cuentaCaja: C;
  monto: number;
  concepto: string;
  nombreCaja: string;
}): [LineaCaja<G>, LineaCaja<C>] {
  return [
    { cuenta_id: datos.cuentaGasto, debe: datos.monto, haber: 0, descripcion: datos.concepto },
    { cuenta_id: datos.cuentaCaja, debe: 0, haber: datos.monto, descripcion: datos.nombreCaja },
  ];
}

/**
 * Diferencia de un arqueo. Faltante (< 0): gasto a débito y caja a crédito.
 * Sobrante (> 0): caja a débito y la cuenta del sobrante a crédito. El lado
 * del código lo decide la configuración; la línea de la caja es la elegida.
 * Devuelve `null` si no hay diferencia: no hay asiento que armar.
 */
export function partidasDeArqueo<C extends string | null>(
  diferencia: number,
  cuentaCaja: C,
): { partidas: Partida[]; lineasExtra: LineaCaja<C>[] } | null {
  if (diferencia === 0) return null;
  const monto = Math.abs(diferencia);
  const faltante = diferencia < 0;
  return {
    partidas: [
      {
        codigo: faltante ? "CAJ_ARQUEO_FALTANTE" : "CAJ_ARQUEO_SOBRANTE",
        monto,
        descripcion: "",
      },
    ],
    lineasExtra: [
      {
        cuenta_id: cuentaCaja,
        debe: faltante ? 0 : monto,
        haber: faltante ? monto : 0,
        descripcion: "",
      },
    ],
  };
}

/**
 * Cuenta que usa una caja sin cuenta propia: la que la contadora asignó al
 * código CAJ_CAJA_CHICA. Solo se toma su cuenta, no su lado (la caja es
 * débito al recibir y crédito al pagar).
 */
export async function cuentaDeCajaPorDefecto(cliente: PoolClient): Promise<string | null> {
  const { rows } = await cliente.query<{ cuenta_id: string | null }>(
    `SELECT t.cuenta_id
       FROM contabilidad.codigo_transaccion t
       JOIN contabilidad.cuenta_contable c ON c.id = t.cuenta_id AND c.activa AND c.admite_movimiento
      WHERE t.codigo = 'CAJ_CAJA_CHICA'`,
  );
  return rows[0]?.cuenta_id ?? null;
}

/**
 * `crear_asiento` ignora las llaves en cero pero guarda una descripción vacía
 * como texto vacío y no como NULL: aquí se omite para que el asiento nuevo
 * sea idéntico al anterior.
 */
export function aJsonDeAsiento(lineas: readonly LineaCaja<string>[]): string {
  return JSON.stringify(
    lineas.map((l) => ({
      cuenta_id: l.cuenta_id,
      ...(l.debe ? { debe: l.debe } : {}),
      ...(l.haber ? { haber: l.haber } : {}),
      ...(l.descripcion ? { descripcion: l.descripcion } : {}),
    })),
  );
}
