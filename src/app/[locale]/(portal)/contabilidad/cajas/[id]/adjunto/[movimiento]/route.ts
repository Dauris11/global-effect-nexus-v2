import { notFound, redirect } from "next/navigation";

import { requerirPermiso } from "@/lib/auth";
import { esUuid } from "@/lib/contabilidad/formato";
import { enlaceContable } from "@/lib/supabase/almacen";
import { registrarLectura } from "@/server/contabilidad/bitacora";
import { adjuntoDeMovimiento } from "@/server/contabilidad/cajas/consultas";
import { contextoDe } from "@/server/contabilidad/sesion";

/**
 * Comprobante de un gasto de caja chica. Igual que los de recibos: el enlace
 * firmado se pide al pulsar, dura minutos y la descarga queda en la bitácora.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ movimiento: string }> },
) {
  const usuario = await requerirPermiso("contabilidad.leer");
  const { movimiento } = await params;
  if (!esUuid(movimiento)) notFound();

  const adjunto = await adjuntoDeMovimiento(movimiento);
  if (!adjunto) notFound();

  const enlace = await enlaceContable(adjunto.ruta);
  if (!enlace) notFound();

  await registrarLectura(await contextoDe(usuario), "leer", "caja_movimiento", adjunto.id,
    "Descarga de comprobante de caja chica");
  redirect(enlace);
}
