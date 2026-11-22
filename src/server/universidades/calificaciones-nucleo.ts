import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { claveCodigo } from "@/lib/carga-calificaciones";
import type { CalificacionLeida } from "@/lib/calificaciones";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { RETIRADA } from "@/lib/indice-academico";
import { avisarRiesgoDeEstudiantes } from "@/server/academico/avisos";
import { alertasDeCarga } from "@/server/universidades/carga-nucleo";

/**
 * Escribir las calificaciones de un cuatrimestre de UN estudiante. Lo comparten la
 * pantalla del expediente (`registrarCalificaciones`) y Elly AI
 * (`registrar_calificaciones_estudiante`), para que las dos validen igual:
 * contra el pénsum DEL ESTUDIANTE y las letras de SU universidad, todo o nada.
 *
 * El código se compara sin espacios ni guiones («CIM 001» = «CIM001», «BIO101» =
 * «BIO-101»), y se guarda siempre el del pénsum.
 */

export type EstadoCalificaciones = {
  estado: "inicial" | "ok" | "no_permitido" | "no_encontrado" | "sin_pensum" | "periodo_invalido" | "vacio" | "invalido" | "error";
  guardadas?: number;
  /** Líneas ilegibles y códigos que no son del pénsum / letras que la universidad no usa. */
  rechazadas?: number[];
  desconocidos?: string[];
};

export async function guardarCalificacionesDe(args: {
  usuarioId: string;
  estudianteId: string;
  periodo: { anio: number; ronda: number };
  items: readonly CalificacionLeida[];
  rechazadas?: readonly number[];
}): Promise<EstadoCalificaciones> {
  const { usuarioId, estudianteId, periodo, items } = args;
  const rechazadas = [...(args.rechazadas ?? [])];

  if (!periodo || periodo.anio > new Date().getFullYear() + 1) return { estado: "periodo_invalido" };
  if (items.length === 0) return { estado: "vacio", rechazadas };

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
  const delPensum = new Map(materias.map((m) => [claveCodigo(m.codigo), m]));
  const letrasValidas = new Set([...Object.keys(est.puntos), RETIRADA, "P"]);
  const desconocidos = items.filter((i) => !delPensum.has(claveCodigo(i.codigo)) || !letrasValidas.has(i.letra)).map((i) => i.codigo);

  // Todo o nada: con una sola línea mala no se guarda ninguna.
  if (rechazadas.length > 0 || desconocidos.length > 0) return { estado: "invalido", rechazadas, desconocidos };

  try {
    await enTransaccion(async (c) => {
      for (const i of items) {
        const m = delPensum.get(claveCodigo(i.codigo))!;

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
      usuarioId,
      accion: "calificaciones.registradas",
      entidad: "estudiante",
      entidadId: estudianteId,
      datos: { periodo: `${periodo.anio}-${periodo.ronda}`, materias: items.length },
    });
  } catch (error) {
    console.error("[academico] no se pudieron registrar las calificaciones", error);

    return { estado: "error" };
  }

  // Si con estas notas el estudiante queda bajo los mínimos de su universidad, se avisa a administración.
  await avisarRiesgoDeEstudiantes([estudianteId]);

  try {
    revalidatePath("/[locale]/expedientes/[id]", "page");
    revalidatePath("/[locale]/expedientes", "page");
  } catch {
    // Fuera de Next (pruebas, scripts) no hay caché que invalidar: lo guardado ya está en la base.
  }

  return { estado: "ok", guardadas: items.length };
}
