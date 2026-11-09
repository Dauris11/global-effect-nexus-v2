import { NextResponse } from "next/server";

import { obtenerUsuarioActual } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { comprobanteDeRendicion } from "@/server/colaborador/consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Descarga del comprobante de una rendición de gastos.
 *
 * El bucket es privado: el archivo sale solo por aquí, con enlace firmado de
 * vida corta, para quien rindió el gasto y para quien revisa rendiciones. A
 * quien no le toca se le responde 404, como en la cotización de una compra,
 * para no confirmar que el archivo existe.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return new NextResponse("No autorizado", { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const comprobante = await comprobanteDeRendicion(id);
  const puedeVer =
    comprobante &&
    (comprobante.empleado_id === usuario.id ||
      usuarioTienePermiso(usuario, "rendicion.revisar"));

  if (!comprobante?.ruta || !puedeVer) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  // Las rendiciones anteriores a la subida real guardaban una URL completa
  // (datos de prueba); esas se entregan tal cual.
  const enlace = /^https:\/\//.test(comprobante.ruta)
    ? comprobante.ruta
    : await enlaceDeDocumento(comprobante.ruta);
  if (!enlace) return new NextResponse("No disponible", { status: 502 });

  const respuesta = NextResponse.redirect(enlace, 302);
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}
