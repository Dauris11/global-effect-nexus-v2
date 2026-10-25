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

      // Buscar período contable
      const { rows: perRows } = await cliente.query<{ id: string }>(
        `SELECT id FROM contabilidad.periodo_contable
         WHERE $1 BETWEEN fecha_inicio AND fecha_fin AND estado = 'abierto'
         LIMIT 1`,
        [fecha]
      );
      if (perRows.length === 0) {
        throw new Error("No hay período contable abierto para la fecha");
      }
      const periodoId = perRows[0].id;

      // Obtener secuencia de asiento
      const { rows: secRows } = await cliente.query<{ num: string }>(
        `SELECT contabilidad.siguiente_numero('AS')::text AS num`
      );
      const numero = Number(secRows[0].num);

      // Crear asiento
      const { rows: asRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.asiento (
           numero, fecha, periodo_id, tipo, concepto, moneda, tasa, estado, creado_por
         ) VALUES ($1, $2, $3, 'manual', $4, 'DOP', 1.0, 'borrador', $5)
         RETURNING id`,
        [numero, fecha, periodoId, datos.concepto.trim(), usuario.id]
      );
      const asientoId = asRows[0].id;

      // Insertar líneas buscando el UUID de la cuenta
      for (let i = 0; i < datos.lineas.length; i++) {
        const l = datos.lineas[i];
        const { rows: ctaRows } = await cliente.query<{ id: string }>(
          `SELECT id FROM contabilidad.cuenta_contable WHERE codigo = $1 LIMIT 1`,
          [l.cuentaCodigo]
        );
        const ctaId = ctaRows[0]?.id;
        if (!ctaId) {
          throw new Error(`Cuenta contable con código ${l.cuentaCodigo} no encontrada`);
        }

        await cliente.query(
          `INSERT INTO contabilidad.asiento_linea (
             asiento_id, numero_linea, cuenta_id, descripcion, debe, haber
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [asientoId, i + 1, ctaId, l.descripcion.trim(), l.debe.toFixed(2), l.haber.toFixed(2)]
        );
      }

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
