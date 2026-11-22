import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { obtenerUsuarioActual } from "@/lib/auth";
import { aCsv, respuestaCsv } from "@/lib/csv";
import { leerConsultaExpedientes } from "@/lib/filtros-expedientes";
import { usuarioTienePermiso } from "@/lib/rbac";
import { listaExpedientes } from "@/server/expedientes/consultas";

/**
 * La lista de expedientes tal como se está viendo (mismos filtros y orden de la
 * dirección), completa y sin paginar, para abrir en Excel.
 */
export async function GET(peticion: Request) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !usuarioTienePermiso(usuario, "expedientes.leer")) return new NextResponse("No autorizado", { status: 401 });

  const consulta = leerConsultaExpedientes(Object.fromEntries(new URL(peticion.url).searchParams));
  const filas = await listaExpedientes({
    busqueda: consulta.busqueda,
    estado: consulta.estado,
    universidad: consulta.universidad,
    situacion: consulta.situacion,
    orden: consulta.orden,
    porPagina: 5000,
    pagina: 1,
  });
  const csv = aCsv(
    ["Nombre", "Cédula", "Correo", "Teléfono", "Situación", "Universidad", "Programa", "Grupo", "Fecha de ingreso", "Índice", "Tiene cuenta"],
    filas.map((f) => [f.nombre, f.cedula, f.email, f.telefono, f.estado, f.universidad, f.programa, f.grupo, f.fecha_ingreso, f.indice?.toFixed(2), f.con_cuenta ? "Sí" : "No"]),
  );

  await registrar({ usuarioId: usuario.id, accion: "exportacion.descargada", entidad: "estudiante", entidadId: null, datos: { que: "expedientes", filas: filas.length } });

  return respuestaCsv("expedientes.csv", csv);
}
