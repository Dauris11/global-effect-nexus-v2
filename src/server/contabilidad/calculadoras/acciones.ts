"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type EstadoAccionCalculadora = {
  ok: boolean;
  error?: string;
  asientoId?: string;
  asientoNumero?: number;
};

export async function convertirCalculoEnAsientoBorrador(datos: {
  tipo: "factura" | "itbis" | "retenciones" | "laboral";
  concepto: string;
  fecha?: string;
  lineas: {
    cuentaCodigo: string;
    descripcion: string;
    debe: number;
    haber: number;
  }[];
}): Promise<EstadoAccionCalculadora> {
  const usuario = await requerirUsuario();
  const fecha = datos.fecha || new Date().toISOString().slice(0, 10);

  // Verificar que el asiento cuadre
  let totalDebe = 0;
  let totalHaber = 0;
  for (const l of datos.lineas) {
    totalDebe += Number(l.debe || 0);
    totalHaber += Number(l.haber || 0);
  }

  const dif = Math.abs(totalDebe - totalHaber);
  if (dif > 0.01) {
    return { ok: false, error: `El cálculo no cuadra: Débito (${totalDebe.toFixed(2)}) != Crédito (${totalHaber.toFixed(2)})` };
  }

  try {
    const res = await enTransaccionComo<{ asientoId: string; asientoNumero: number }>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "convertir_calculo_en_asiento");

      // Las cuentas llegan por código desde la calculadora; se resuelven antes
      // de crear el asiento para que un código inválido no deje nada a medias.
      const lineas: { cuenta_id: string; debe: number; haber: number; descripcion: string }[] = [];
      for (const l of datos.lineas) {
        const { rows: ctaRows } = await cliente.query<{ id: string }>(
          `SELECT id FROM contabilidad.cuenta_contable WHERE codigo = $1 LIMIT 1`,
          [l.cuentaCodigo]
        );
        const ctaId = ctaRows[0]?.id;
        if (!ctaId) {
          throw new Error(`Cuenta contable con código ${l.cuentaCodigo} no encontrada`);
        }
        lineas.push({
          cuenta_id: ctaId,
          debe: Number(Number(l.debe || 0).toFixed(2)),
          haber: Number(Number(l.haber || 0).toFixed(2)),
          descripcion: l.descripcion.trim(),
        });
      }

      // `crear_asiento` asigna número y período (y falla si el período está
      // cerrado), así que no se replica esa lógica aquí.
      const { rows: asRows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.crear_asiento($1::date, $2, 'manual', NULL, NULL, $3::jsonb) AS id`,
        [fecha, datos.concepto.trim(), JSON.stringify(lineas)]
      );
      const asientoId = asRows[0].id;
      const { rows: numRows } = await cliente.query<{ numero: string }>(
        `SELECT numero::text AS numero FROM contabilidad.asiento WHERE id = $1`,
        [asientoId]
      );
      const numero = Number(numRows[0].numero);

      // Guardar en historial de calculadoras
      await cliente.query(
        `INSERT INTO contabilidad.calculadora_historial (
           tipo_calculadora, parametros_entrada, resultado_calculo, asiento_id, creado_por
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          datos.tipo,
          JSON.stringify({ concepto: datos.concepto, fecha }),
          JSON.stringify({ totalDebe, totalHaber, lineas: datos.lineas }),
          asientoId,
          usuario.id,
        ]
      );

      return { asientoId, asientoNumero: numero };
    });

    revalidatePath("/contabilidad/asientos");
    return { ok: true, asientoId: res.asientoId, asientoNumero: res.asientoNumero };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al generar asiento borrador" };
  }
}
