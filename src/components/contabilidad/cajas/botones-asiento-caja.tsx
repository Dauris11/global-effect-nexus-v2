"use client";

import { BotonAsiento } from "@/components/contabilidad/asiento/boton-asiento";
import { asientoDeArqueo, asientoDeMovimientoCaja } from "@/server/contabilidad/cajas/acciones-asiento";

/*
 * Envolturas cliente de la opción «Asiento» de las cajas. Las tablas de caja
 * se pintan en el servidor y de allí no puede viajar una función al cliente:
 * aquí la función nace en el cliente, con solo el id.
 */

/** Asiento de un gasto o de una reposición (la reposición vive en el recibo de egreso). */
export function AsientoMovimientoCaja({ movimientoId }: { movimientoId: string }) {
  return <BotonAsiento cargar={() => asientoDeMovimientoCaja(movimientoId)} />;
}

/** Asiento de un arqueo: el que saldría al aprobarlo o el que ya quedó. */
export function AsientoArqueo({ arqueoId }: { arqueoId: string }) {
  return <BotonAsiento cargar={() => asientoDeArqueo(arqueoId)} />;
}
