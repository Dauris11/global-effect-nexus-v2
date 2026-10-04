import { notFound, redirect } from "next/navigation";

import { requerirPermiso } from "@/lib/auth";
import { enlaceContable } from "@/lib/supabase/almacen";
import { registrarLectura } from "@/server/contabilidad/bitacora";
import { adjuntoPorId } from "@/server/contabilidad/recibos/consultas";
import { contextoDe } from "@/server/contabilidad/sesion";

/**
 * Descarga de un adjunto contable. El enlace firmado se pide AL PULSAR,
 * dura cinco minutos y la descarga queda en la bitácora (§3.6): así no hay
 * enlaces vivos en el HTML de la página esperando a que alguien los copie.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await requerirPermiso("contabilidad.leer");
  const { id } = await params;
  const adjunto = await adjuntoPorId(id);
  if (!adjunto) notFound();

  const enlace = await enlaceContable(adjunto.ruta);
  if (!enlace) notFound();

  await registrarLectura(await contextoDe(usuario), "leer", "recibo_adjunto", adjunto.id,
    `Descarga de ${adjunto.nombre}`);

  redirect(enlace);
}
