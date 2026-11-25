"use server";

import { requerirPermiso } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { esUuid } from "@/lib/contabilidad/formato";
import { armarVista, type VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { vistaDeFuncionSql } from "@/server/contabilidad/asientos/vista-sql";
import { vistaDeAsientoDeOrigen } from "@/server/contabilidad/tesoreria/asiento-origen";

/**
 * Opción «Asiento» de un recibo. Borrador: el asiento que saldría al
 * contabilizarlo, con la MISMA función SQL que usa `contabilizar_recibo`
 * (`contabilidad.lineas_recibo`). Contabilizado o anulado: el que quedó en el
 * libro (la anulación lo revierte con otro asiento; aquí se ve el original).
 *
 * Un recibo no tiene códigos de transacción: el banco es la cuenta bancaria
 * elegida y la contrapartida sale de la categoría del recibo (o de la cuenta
 * de contrapartida que se le fijó, como en la reposición de caja).
 */
export async function asientoDeRecibo(reciboId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(reciboId)) return armarVista([], [], { estado: "previa" });
  const recibo = await consultarUna<{ estado: string; serie: string; numero: string; concepto: string; fecha: string }>(
    `SELECT estado, CASE tipo WHEN 'ingreso' THEN 'RI' ELSE 'CE' END AS serie, numero::text, concepto,
            to_char(fecha, 'YYYY-MM-DD') AS fecha
       FROM contabilidad.recibo WHERE id = $1`,
    [reciboId],
  );
  if (!recibo) return armarVista([], [], { estado: "previa" });
  if (recibo.estado !== "borrador") return vistaDeAsientoDeOrigen("recibo", reciboId);
  return vistaDeFuncionSql("contabilidad.lineas_recibo", [reciboId], {
    fecha: recibo.fecha,
    descripcion: `${recibo.serie}-${recibo.numero} ${recibo.concepto}`,
  });
}
