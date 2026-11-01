import { NextResponse } from "next/server";

import { obtenerUsuarioActual } from "@/lib/auth";
import { puedeVerCotizacion } from "@/lib/solicitudes";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { cotizacionDeSolicitud } from "@/server/solicitudes/consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Descarga de la cotización de una compra.
 *
 * El bucket es privado, así que el archivo solo sale por aquí y con un enlace
 * firmado de vida corta. Se entrega únicamente a quien pidió la compra y a
 * quien la revisa (`puedeVerCotizacion`): un precio y un proveedor no son
 * para todo el personal. A quien no le toca se le responde 404 y no 403, para
 * no confirmar que esa solicitud tiene archivo.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return new NextResponse("No autorizado", { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const cotizacion = await cotizacionDeSolicitud(id);
  if (!cotizacion || !puedeVerCotizacion(usuario, cotizacion.solicitante_id)) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const enlace = await enlaceDeDocumento(cotizacion.ruta);
  if (!enlace) return new NextResponse("No disponible", { status: 502 });

  const respuesta = NextResponse.redirect(enlace, 302);
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}
