"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type EstadoAccionCR = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function emitirComprobanteRetencion(datos: {
  facturaId: string;
  fechaEmision: string;
  concepto?: string;
}): Promise<EstadoAccionCR> {
  const usuario = await requerirUsuario();

  try {
    const crId = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "emitir_comprobante_retencion");

      // Consultar la factura y sus retenciones
      const { rows: facRows } = await cliente.query<{
        id: string;
        proveedor_id: string;
        subtotal: string;
        itbis: string;
        retencion_isr: string;
        retencion_itbis: string;
        concepto: string;
        periodo_codigo: string;
      }>(
        `SELECT fp.id, fp.proveedor_id, fp.subtotal, fp.itbis, fp.retencion_isr,
                fp.retencion_itbis, fp.concepto, to_char(make_date(pc.anio, pc.mes, 1), 'YYYY-MM') AS periodo_codigo
         FROM contabilidad.factura_proveedor fp
         JOIN contabilidad.periodo_contable pc ON pc.id = fp.periodo_id
         WHERE fp.id = $1`,
        [datos.facturaId]
      );

      if (facRows.length === 0) throw new Error("Factura no encontrada");
      const fac = facRows[0];

      const retIsr = Number(fac.retencion_isr);
      const retItbis = Number(fac.retencion_itbis);

      if (retIsr <= 0 && retItbis <= 0) {
        throw new Error("Esta factura no tiene retenciones de ISR ni de ITBIS registradas");
      }

      // Validar si ya se emitió comprobante
      const { rows: existRows } = await cliente.query<{ id: string }>(
        `SELECT id FROM contabilidad.comprobante_retencion WHERE factura_id = $1 AND estado = 'emitido'`,
        [datos.facturaId]
      );
      if (existRows.length > 0) {
        throw new Error("Ya existe un comprobante de retención emitido para esta factura");
      }

      // Secuencia
      const { rows: secRows } = await cliente.query<{ num: string }>(
        `SELECT contabilidad.siguiente_numero('CR')::text AS num`
      );
      const numero = Number(secRows[0].num);
      const anio = new Date(datos.fechaEmision).getFullYear();
      const secuenciaInterna = `CR-${anio}-${String(numero).padStart(5, "0")}`;

      const st = Number(fac.subtotal);
      const it = Number(fac.itbis);
      const tasaIt = it > 0 ? retItbis / it : 0;
      const tasaIsr = st > 0 ? retIsr / st : 0;

      const { rows: crRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.comprobante_retencion (
           numero, secuencia_interna, factura_id, proveedor_id,
           fecha_emision, periodo_fiscal, monto_facturado, itbis_facturado,
           monto_sujeto_itbis, itbis_retenido, tasa_itbis_retenido,
           monto_sujeto_isr, isr_retenido, tasa_isr_retenido,
           concepto, estado, emitido_por
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'emitido', $16)
         RETURNING id`,
        [
          numero,
          secuenciaInterna,
          fac.id,
          fac.proveedor_id,
          datos.fechaEmision,
          fac.periodo_codigo,
          (st + it).toFixed(2),
          it.toFixed(2),
          it.toFixed(2),
          retItbis.toFixed(2),
          tasaIt.toFixed(4),
          st.toFixed(2),
          retIsr.toFixed(2),
          tasaIsr.toFixed(4),
          datos.concepto?.trim() || `Retención practicada sobre factura: ${fac.concepto}`,
          usuario.id,
        ]
      );

      return crRows[0].id;
    });

    revalidatePath("/contabilidad/retenciones");
    revalidatePath("/contabilidad/cuentas-por-pagar");
    return { ok: true, id: crId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al emitir comprobante de retención" };
  }
}

export async function anularComprobanteRetencion(id: string, motivo: string): Promise<EstadoAccionCR> {
  const usuario = await requerirUsuario();
  if (!motivo.trim() || motivo.trim().length < 5) {
    return { ok: false, error: "Debe indicar un motivo claro (mínimo 5 caracteres)" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "anular_comprobante_retencion");

      await cliente.query(
        `UPDATE contabilidad.comprobante_retencion
         SET estado = 'anulado', motivo_anulacion = $1, anulado_por = $2, anulado_en = now()
         WHERE id = $3 AND estado = 'emitido'`,
        [motivo.trim(), usuario.id, id]
      );
    });

    revalidatePath("/contabilidad/retenciones");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Error al anular comprobante de retención" };
  }
}
