"use client";

import { BotonAsiento } from "@/components/contabilidad/asiento/boton-asiento";
import { asientoDeRecibo } from "@/server/contabilidad/recibos/acciones-asiento";

/** «Asiento» de un recibo: el previo si es borrador, el real si ya se contabilizó. */
export function AsientoRecibo({ reciboId }: { reciboId: string }) {
  return <BotonAsiento cargar={() => asientoDeRecibo(reciboId)} size="default" />;
}
