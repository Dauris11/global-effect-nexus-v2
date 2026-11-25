"use server";

import { revalidatePath } from "next/cache";
import { requerirPermiso } from "@/lib/auth";
import { enTransaccion, enTransaccionComo } from "@/lib/db";
import { claveDia } from "@/lib/fechas";
import { armarVista, type VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";
import { vistaDeLineasPorCodigo } from "@/server/contabilidad/asientos/vista";
import { construirLineasPorCodigo } from "@/server/contabilidad/codigos-transaccion/asiento";
import { asientoDeFactura, type EntradaFactura } from "@/server/contabilidad/calculadoras/asiento";
import { ErrorOperacion, textoDeErrorOperacion } from "@/server/contabilidad/operaciones/errores";

export type EstadoAccionCalculadora = {
  ok: boolean;
  error?: string;
  asientoId?: string;
  asientoNumero?: number;
};

/**
 * Convierte el cálculo de una factura en un asiento. Las cuentas salen de los
 * códigos CALC_FACTURA_* (Configuración contable); si alguno no tiene cuenta,
 * el error lo dice con su nombre en vez de un código de cuenta suelto.
 *
 * Crea un asiento contable, así que exige `contabilidad.registrar` y no solo
 * una sesión.
 */
export async function convertirCalculoEnAsientoBorrador(datos: {
  tipo: "factura";
  entrada: EntradaFactura;
  fecha?: string;
}): Promise<EstadoAccionCalculadora> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const fecha = datos.fecha || claveDia();

  try {
    const res = await enTransaccionComo<{ asientoId: string; asientoNumero: number }>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "convertir_calculo_en_asiento");

      const { concepto, partidas, totales } = asientoDeFactura(datos.entrada);
      // Falla con «código sin cuenta» antes de crear nada, y también si no cuadra.
      const lineas = await construirLineasPorCodigo(cliente, partidas);

      // `crear_asiento` asigna número y período (y falla si el período está
      // cerrado), así que no se replica esa lógica aquí.
      const { rows: asRows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.crear_asiento($1::date, $2, 'manual', NULL, NULL, $3::jsonb) AS id`,
        [fecha, concepto, JSON.stringify(lineas)],
      );
      const asientoId = asRows[0].id;
      const { rows: numRows } = await cliente.query<{ numero: string }>(
        `SELECT numero::text AS numero FROM contabilidad.asiento WHERE id = $1`,
        [asientoId],
      );

      // Guardar en historial de calculadoras
      await cliente.query(
        `INSERT INTO contabilidad.calculadora_historial (
           tipo_calculadora, parametros_entrada, resultado_calculo, asiento_id, creado_por
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          datos.tipo,
          JSON.stringify({ concepto, fecha, entrada: datos.entrada }),
          JSON.stringify({ ...totales, lineas }),
          asientoId,
          usuario.id,
        ],
      );

      return { asientoId, asientoNumero: Number(numRows[0].numero) };
    });

    revalidatePath("/contabilidad/asientos");
    return { ok: true, asientoId: res.asientoId, asientoNumero: res.asientoNumero };
  } catch (e) {
    return { ok: false, error: await textoDeErrorOperacion(e) };
  }
}

/**
 * «Asiento» de la calculadora de factura ANTES de convertirla: mismo cálculo y
 * mismas partidas que `convertirCalculoEnAsientoBorrador`. Un cálculo inválido
 * no lanza: se muestra vacío con el aviso.
 */
export async function asientoDeCalculoFactura(entrada: EntradaFactura, fecha?: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  let calculo;
  try {
    calculo = asientoDeFactura(entrada);
  } catch (e) {
    if (!(e instanceof ErrorOperacion)) throw e;
    return armarVista([], [{ clave: "otro", detalle: await textoDeErrorOperacion(e) }], { estado: "previa" });
  }
  return enTransaccion((cliente) =>
    vistaDeLineasPorCodigo(cliente, calculo.partidas, { descripcion: calculo.concepto, fecha: fecha || claveDia() }),
  );
}
