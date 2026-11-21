"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { filasDeLista, type FilaLeida } from "@/lib/carga-calificaciones";
import { consultar } from "@/lib/db";
import { leerEtiquetaPeriodo } from "@/lib/gradua";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  asignarEstudianteAFila,
  confirmarCarga,
  guardarBorrador,
  leerFilasDeArchivo,
  universidadDeCarga,
  type AlertaDeCarga,
} from "@/server/universidades/carga-nucleo";

/**
 * Acciones de la carga guiada de calificaciones. Todas piden `expedientes.escribir`
 * (lo mismo que registrar calificaciones de un estudiante) y vuelven a comprobarlo:
 * esconder el botón no es control de acceso.
 */

export type EstadoCarga = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "dato_invalido"
    | "periodo_invalido"
    | "sin_archivo"
    | "tipo_no_admitido"
    | "demasiado_grande"
    | "sin_clave"
    | "ilegible"
    | "sin_filas"
    | "estudiante_de_otra_universidad"
    | "error";
  cargaId?: string;
  escritas?: number;
  estudiantes?: number;
  omitidos?: number;
  sinEstudiante?: number;
  alertas?: AlertaDeCarga[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function usuarioConPermiso() {
  const usuario = await requerirUsuario();

  return usuarioTienePermiso(usuario, "expedientes.escribir") ? usuario : null;
}

/** Paso 1-3 del asistente: universidad, período y medio → lee, empareja y deja el borrador para revisar. */
export async function crearCargaCalificaciones(_p: EstadoCarga, d: FormData): Promise<EstadoCarga> {
  const usuario = await usuarioConPermiso();

  if (!usuario) return { estado: "no_permitido" };

  const universidadId = String(d.get("universidad") ?? "");
  const periodo = leerEtiquetaPeriodo(String(d.get("periodo") ?? ""));
  const medio = String(d.get("medio") ?? "");

  if (!UUID.test(universidadId) || !["archivo", "lista"].includes(medio)) return { estado: "dato_invalido" };
  if (!periodo || periodo.anio > new Date().getFullYear() + 1) return { estado: "periodo_invalido" };

  const universidad = await universidadDeCarga(universidadId);

  if (!universidad) return { estado: "no_encontrado" };

  let filas: FilaLeida[];
  let medioGuardado: "pdf" | "imagen" | "lista";

  if (medio === "lista") {
    filas = filasDeLista(String(d.get("lista") ?? "").slice(0, 60_000));
    medioGuardado = "lista";

    if (filas.length === 0) return { estado: "sin_filas" };
  } else {
    const archivo = d.get("archivo");

    if (!(archivo instanceof File) || archivo.size === 0) return { estado: "sin_archivo" };

    const mime = archivo.type;
    const bytes = Buffer.from(await archivo.arrayBuffer());
    const lectura = await leerFilasDeArchivo({ mime, base64: bytes.toString("base64"), bytes: bytes.length }, universidad);

    if (lectura.estado !== "ok") return { estado: lectura.estado };

    filas = lectura.filas;
    medioGuardado = mime === "application/pdf" ? "pdf" : "imagen";
  }

  try {
    const resumen = await guardarBorrador({ universidad, anio: periodo.anio, ronda: periodo.ronda, medio: medioGuardado, filas, usuarioId: usuario.id });

    return { estado: "ok", cargaId: resumen.cargaId };
  } catch (error) {
    console.error("[academico] no se pudo guardar el borrador de calificaciones", error);

    return { estado: "error" };
  }
}

/** Elegir a mano a quién pertenece una fila que el programa no pudo emparejar. */
export async function asignarEstudianteCarga(_p: EstadoCarga, d: FormData): Promise<EstadoCarga> {
  const usuario = await usuarioConPermiso();

  if (!usuario) return { estado: "no_permitido" };

  const filaId = String(d.get("fila") ?? "");
  const estudianteId = String(d.get("estudiante") ?? "");
  const cargaId = String(d.get("carga") ?? "");

  if (!UUID.test(filaId) || !UUID.test(estudianteId) || !UUID.test(cargaId)) return { estado: "dato_invalido" };

  const r = await asignarEstudianteAFila(filaId, estudianteId);

  if (r !== "ok") return { estado: r === "no_encontrada" ? "no_encontrado" : "estudiante_de_otra_universidad" };

  revalidatePath("/[locale]/academico/universidades/calificaciones/[id]", "page");

  return { estado: "ok", cargaId };
}

/** Confirmar: escribe las notas (por estudiante, todo o nada) y devuelve las alertas que resultan. */
export async function confirmarCargaCalificaciones(_p: EstadoCarga, d: FormData): Promise<EstadoCarga> {
  const usuario = await usuarioConPermiso();

  if (!usuario) return { estado: "no_permitido" };

  const cargaId = String(d.get("carga") ?? "");

  if (!UUID.test(cargaId)) return { estado: "dato_invalido" };

  const r = await confirmarCarga(cargaId, usuario.id);

  if (r.estado !== "ok") return { estado: r.estado === "no_encontrada" ? "no_encontrado" : "error" };

  revalidatePath("/[locale]/academico/universidades/calificaciones/[id]", "page");
  revalidatePath("/[locale]/expedientes/[id]", "page");
  revalidatePath("/[locale]/expedientes", "page");

  return { estado: "ok", cargaId, escritas: r.notasEscritas, estudiantes: r.estudiantesEscritos, omitidos: r.estudiantesOmitidos, sinEstudiante: r.filasSinEstudiante, alertas: r.alertas };
}

export async function descartarCargaCalificaciones(_p: EstadoCarga, d: FormData): Promise<EstadoCarga> {
  const usuario = await usuarioConPermiso();

  if (!usuario) return { estado: "no_permitido" };

  const cargaId = String(d.get("carga") ?? "");

  if (!UUID.test(cargaId)) return { estado: "dato_invalido" };

  const r = await consultar<{ id: string }>(`UPDATE carga_calificaciones SET estado = 'descartada' WHERE id = $1 AND estado = 'borrador' RETURNING id`, [cargaId]);

  if (r.length === 0) return { estado: "no_encontrado" };

  await registrar({ usuarioId: usuario.id, accion: "calificaciones.carga_descartada", entidad: "carga_calificaciones", entidadId: cargaId, datos: {} });

  revalidatePath("/[locale]/academico/universidades/calificaciones", "layout");

  return { estado: "ok" };
}
