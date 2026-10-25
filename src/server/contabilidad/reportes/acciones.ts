"use server";

import { revalidatePath } from "next/cache";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

import { requerirPermiso } from "@/lib/auth";

export interface GuardarSnapshotInput {
  tipo: "balance_general" | "estado_actividades" | "flujo_efectivo" | "cambios_patrimonio" | "ejecucion_presupuestaria";
  ejercicio: number;
  mes?: number | null;
  fechaCorte: string;
  titulo: string;
  datosJson: Record<string, unknown>;
}

export async function guardarSnapshotFinanciero(input: GuardarSnapshotInput): Promise<{ id: string }> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const ctx = await contextoDe(usuario);

  return enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "guardar_snapshot_financiero");

    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.snapshot_financiero
         (tipo, ejercicio, mes, fecha_corte, titulo, datos_json, generado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.tipo,
        input.ejercicio,
        input.mes ?? null,
        input.fechaCorte,
        input.titulo.trim(),
        JSON.stringify(input.datosJson),
        ctx.usuarioId,
      ],
    );

    revalidatePath("/[locale]/(portal)/contabilidad/reportes", "page");
    return { id: rows[0].id };
  });
}
