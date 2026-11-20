import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { obtenerUsuarioActual } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { archivoAcademicoPorId } from "@/server/universidades/consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Descarga de un PDF académico (el «gradua», el récord de notas o el PDF de un
 * pénsum). Bucket privado: sale solo por aquí, con enlace firmado de vida corta,
 * y cada descarga queda en la bitácora. Lo de un estudiante pide
 * `expedientes.leer`; lo de un pénsum, `catalogo.leer`. Sin permiso, 404.
 */
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) return new NextResponse("No autorizado", { status: 401 });

  const { id } = await params;

  if (!UUID.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const archivo = await archivoAcademicoPorId(id);
  const permiso = archivo?.pensum_id ? "catalogo.leer" : "expedientes.leer";

  if (!archivo || !usuarioTienePermiso(usuario, permiso)) return new NextResponse("No encontrado", { status: 404 });

  const enlace = await enlaceDeDocumento(archivo.ruta, 300);

  if (!enlace) return new NextResponse("No disponible", { status: 502 });

  await registrar({
    usuarioId: usuario.id,
    accion: "archivo_academico.descargado",
    entidad: archivo.pensum_id ? "pensum" : "estudiante",
    entidadId: (archivo.pensum_id ?? archivo.estudiante_id) as string,
    datos: { tipo: archivo.tipo },
  });

  const respuesta = NextResponse.redirect(enlace, 302);

  respuesta.headers.set("Cache-Control", "no-store");

  return respuesta;
}
