"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { leerCalificaciones } from "@/lib/calificaciones";
import { leerEtiquetaPeriodo } from "@/lib/gradua";
import { usuarioTienePermiso } from "@/lib/rbac";
import { guardarCalificacionesDe, type EstadoCalificaciones } from "@/server/universidades/calificaciones-nucleo";

/**
 * Registrar las calificaciones de un cuatrimestre de un estudiante. Cada línea
 * pasa a ser un INTENTO nativo (materia + año + ronda): una nota nueva de una
 * materia ya cursada la sustituye en ese período, y una de un período posterior
 * pasa a ser su estado vigente (así una retirada vuelta a cursar deja de serlo).
 * Después no hay nada más que hacer: el pénsum, el índice y las alertas se
 * recalculan al mostrarse.
 *
 * Valida contra el pénsum DEL ESTUDIANTE y contra las letras de SU universidad;
 * lo que no cuadre se rechaza línea por línea y no se guarda nada si alguna falla
 * (todo o nada), para que una lista a medias no deje un cuatrimestre inconsistente.
 */

export type { EstadoCalificaciones } from "@/server/universidades/calificaciones-nucleo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function registrarCalificaciones(_p: EstadoCalificaciones, d: FormData): Promise<EstadoCalificaciones> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) return { estado: "no_permitido" };

  const estudianteId = String(d.get("estudiante") ?? "");
  const periodo = leerEtiquetaPeriodo(String(d.get("periodo") ?? ""));
  const lectura = leerCalificaciones(String(d.get("lista") ?? "").slice(0, 20_000));

  if (!UUID.test(estudianteId)) return { estado: "no_encontrado" };
  if (!periodo) return { estado: "periodo_invalido" };

  return guardarCalificacionesDe({ usuarioId: usuario.id, estudianteId, periodo, items: lectura.items, rechazadas: lectura.rechazadas });
}

/**
 * Quita un resultado cargado a mano o por calificaciones (para corregir un error
 * de captura). Los que vienen de un gradua no se quitan aquí: se reemplazan al
 * subir uno nuevo o desaparecen al quitar su archivo.
 */
export async function quitarResultado(_p: EstadoCalificaciones, d: FormData): Promise<EstadoCalificaciones> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) return { estado: "no_permitido" };

  const id = String(d.get("id") ?? "");

  if (!UUID.test(id)) return { estado: "no_encontrado" };

  const fila = await consultarUna<{ estudiante_id: string; codigo: string }>(
    `DELETE FROM resultado_materia WHERE id = $1 AND fuente <> 'gradua' RETURNING estudiante_id, codigo`,
    [id],
  );

  if (!fila) return { estado: "no_encontrado" };

  await registrar({
    usuarioId: usuario.id,
    accion: "calificaciones.quitada",
    entidad: "estudiante",
    entidadId: fila.estudiante_id,
    datos: { materia: fila.codigo },
  });

  revalidatePath("/[locale]/expedientes/[id]", "page");
  revalidatePath("/[locale]/expedientes", "page");

  return { estado: "ok" };
}
