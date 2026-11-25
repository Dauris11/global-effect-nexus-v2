"use client";

import { BotonAsiento } from "@/components/contabilidad/asiento/boton-asiento";
import { asientoDeMovimientoBancario } from "@/server/contabilidad/bancos/acciones-asiento";

/** «Asiento» de un movimiento del libro de banco (recibo o transferencia). */
export function AsientoMovimientoBanco({ movimientoId }: { movimientoId: string }) {
  return <BotonAsiento cargar={() => asientoDeMovimientoBancario(movimientoId)} />;
}
