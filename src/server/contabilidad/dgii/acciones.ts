"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type EstadoAccionDeclaracion = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function guardarDeclaracion(datos: {
  tipo: "606" | "607" | "608" | "609" | "IT-1" | "IR-17" | "IR-3" | "ISFL-01";
  ejercicio: number;
  periodo: string;
  totalOperaciones: number;
  montoTotal: number;
  impuestoDeterminado: number;
  contenidoTxt?: string;
}): Promise<EstadoAccionDeclaracion> {
  const usuario = await requerirUsuario();

  try {
    const hash = datos.contenidoTxt
      ? createHash("sha256").update(datos.contenidoTxt).digest("hex")
      : null;

    const decId = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "guardar_declaracion_dgii");

      // Buscar si ya existe una versión previa
      const { rows: prevRows } = await cliente.query<{ max_version: number }>(
        `SELECT COALESCE(MAX(version), 0) AS max_version
         FROM contabilidad.declaracion
         WHERE tipo = $1 AND ejercicio = $2 AND periodo = $3`,
        [datos.tipo, datos.ejercicio, datos.periodo]
      );

      const proximaVersion = Number(prevRows[0]?.max_version ?? 0) + 1;
      const esRectificativa = proximaVersion > 1;

      const { rows: insRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.declaracion (
           tipo, ejercicio, periodo, version, es_rectificativa,
           estado, total_operaciones, monto_total, impuesto_determinado,
           contenido_txt, hash_sha256, fecha_generacion, generado_por
         ) VALUES ($1, $2, $3, $4, $5, 'generada', $6, $7, $8, $9, $10, now(), $11)
         RETURNING id`,
        [
          datos.tipo,
          datos.ejercicio,
          datos.periodo,
          proximaVersion,
          esRectificativa,
          datos.totalOperaciones,
          datos.montoTotal,
          datos.impuestoDeterminado,
          datos.contenidoTxt || null,
          hash,
          usuario.id,
        ]
      );

      return insRows[0].id;
    });

    revalidatePath("/contabilidad/impuestos");
    return { ok: true, id: decId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al registrar declaración DGII" };
  }
}

export async function marcarDeclaracionPresentada(datos: {
  id: string;
  numeroAutorizacionDgii: string;
  fechaPresentacion: string;
  notas?: string;
}): Promise<EstadoAccionDeclaracion> {
  const usuario = await requerirUsuario();

  if (!datos.numeroAutorizacionDgii.trim()) {
    return { ok: false, error: "Debe ingresar el número de autorización o confirmación DGII" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "marcar_declaracion_presentada");

      await cliente.query(
        `UPDATE contabilidad.declaracion
         SET estado = 'presentada',
             numero_autorizacion_dgii = $1,
             fecha_presentacion = $2,
             presentado_por = $3,
             notas = COALESCE($4, notas),
             actualizado_en = now()
         WHERE id = $5`,
        [
          datos.numeroAutorizacionDgii.trim(),
          datos.fechaPresentacion,
          usuario.id,
          datos.notas?.trim() || null,
          datos.id,
        ]
      );
    });

    revalidatePath("/contabilidad/impuestos");
    return { ok: true, id: datos.id };
  } catch {
    return { ok: false, error: "Error al actualizar estado de la declaración" };
  }
}
