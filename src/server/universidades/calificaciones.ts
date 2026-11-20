"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { leerCalificaciones } from "@/lib/calificaciones";
import { leerEtiquetaPeriodo } from "@/lib/gradua";
import { RETIRADA } from "@/lib/indice-academico";
import { usuarioTienePermiso } from "@/lib/rbac";

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

export type EstadoCalificaciones = {
  estado: "inicial" | "ok" | "no_permitido" | "no_encontrado" | "sin_pensum" | "periodo_invalido" | "vacio" | "invalido" | "error";
  guardadas?: number;
  /** Líneas ilegibles y códigos que no son del pénsum / letras que la universidad no usa. */
  rechazadas?: number[];
  desconocidos?: string[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function registrarCalificaciones(_p: EstadoCalificaciones, d: FormData): Promise<EstadoCalificaciones> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) return { estado: "no_permitido" };

  const estudianteId = String(d.get("estudiante") ?? "");
  const periodo = leerEtiquetaPeriodo(String(d.get("periodo") ?? ""));
  const lectura = leerCalificaciones(String(d.get("lista") ?? "").slice(0, 20_000));

  if (!UUID.test(estudianteId)) return { estado: "no_encontrado" };
  if (!periodo || periodo.anio > new Date().getFullYear() + 1) return { estado: "periodo_invalido" };
  if (lectura.items.length === 0) return { estado: "vacio", rechazadas: lectura.rechazadas };

  const est = await consultarUna<{ pensum_id: string | null; puntos: Record<string, number> | null }>(
    `SELECT e.pensum_id, u.puntos_por_letra AS puntos
       FROM estudiante e LEFT JOIN universidad u ON u.id = e.universidad_id WHERE e.id = $1`,
    [estudianteId],
  );

  if (!est) return { estado: "no_encontrado" };
  if (!est.pensum_id || !est.puntos) return { estado: "sin_pensum" };

  const materias = await consultar<{ codigo: string; nombre: string; creditos: number }>(
    `SELECT codigo, nombre, creditos FROM pensum_materia WHERE pensum_id = $1`,
    [est.pensum_id],
  );
  const delPensum = new Map(materias.map((m) => [m.codigo.toUpperCase(), m]));
  const letrasValidas = new Set([...Object.keys(est.puntos), RETIRADA, "P"]);
  const desconocidos = lectura.items.filter((i) => !delPensum.has(i.codigo) || !letrasValidas.has(i.letra)).map((i) => i.codigo);

  // Todo o nada: con una sola línea mala no se guarda ninguna.
  if (lectura.rechazadas.length > 0 || desconocidos.length > 0) {
    return { estado: "invalido", rechazadas: lectura.rechazadas, desconocidos };
  }

  try {
    await enTransaccion(async (c) => {
      for (const i of lectura.items) {
        const m = delPensum.get(i.codigo)!;

        await c.query(
          `INSERT INTO resultado_materia (estudiante_id, codigo, nombre, creditos, anio, ronda, letra, nota_numerica, fuente)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'calificaciones')
           ON CONFLICT (estudiante_id, codigo, anio, ronda)
           DO UPDATE SET letra = EXCLUDED.letra, nota_numerica = EXCLUDED.nota_numerica, fuente = 'calificaciones'`,
          [estudianteId, m.codigo, m.nombre, m.creditos, periodo.anio, periodo.ronda, i.letra, i.nota],
        );
      }
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "calificaciones.registradas",
      entidad: "estudiante",
      entidadId: estudianteId,
      datos: { periodo: `${periodo.anio}-${periodo.ronda}`, materias: lectura.items.length },
    });
  } catch (error) {
    console.error("[academico] no se pudieron registrar las calificaciones", error);

    return { estado: "error" };
  }

  revalidatePath("/[locale]/expedientes/[id]", "page");
  revalidatePath("/[locale]/expedientes", "page");

  return { estado: "ok", guardadas: lectura.items.length };
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
