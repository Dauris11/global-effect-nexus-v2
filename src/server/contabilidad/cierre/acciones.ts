"use server";

import { revalidatePath } from "next/cache";
import { enTransaccion, enTransaccionComo } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";
import { obtenerResumenPreCierreAnual } from "./consultas";
import { textoDeErrorCodigos } from "@/server/contabilidad/patrimonio/errores";
import { armarAsientoCierre, conceptoDeCierre } from "./asiento";
import { construirLineasPorCodigo } from "@/server/contabilidad/codigos-transaccion/asiento";
import { vistaDeAsientoContabilizado, vistaDeLineasPorCodigo } from "@/server/contabilidad/asientos/vista";
import type { VistaAsiento } from "@/lib/contabilidad/vista-asiento";

export async function cerrarPeriodoMensual(periodoId: string): Promise<{ ok: boolean }> {
  const usuario = await requerirPermiso("contabilidad.cerrar_periodo");
  const ctx = await contextoDe(usuario);

  return enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "cerrar_periodo_mensual");

    await cliente.query(`SELECT contabilidad.cerrar_periodo($1)`, [periodoId]);

    revalidatePath("/[locale]/(portal)/contabilidad/cierre", "page");
    return { ok: true };
  });
}

export async function reabrirPeriodoMensual(periodoId: string, motivo: string): Promise<{ ok: boolean }> {
  const usuario = await requerirPermiso("contabilidad.cerrar_periodo");
  const ctx = await contextoDe(usuario);

  if (!motivo || motivo.trim().length < 10) {
    throw new Error("El motivo de reapertura debe tener al menos 10 caracteres.");
  }

  return enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "reabrir_periodo_mensual");

    await cliente.query(`SELECT contabilidad.reabrir_periodo($1, $2)`, [periodoId, motivo.trim()]);

    revalidatePath("/[locale]/(portal)/contabilidad/cierre", "page");
    return { ok: true };
  });
}

export async function ejecutarCierreAnual(
  ejercicio: number,
  notas?: string,
): Promise<{ cierreId: string; asientoId: string | null }> {
  const usuario = await requerirPermiso("contabilidad.cerrar_periodo");
  const ctx = await contextoDe(usuario);

  const resumen = await obtenerResumenPreCierreAnual(ejercicio);

  if (resumen.yaCerrado) {
    throw new Error(`El ejercicio ${ejercicio} ya fue cerrado formalmente.`);
  }

  if (!resumen.todosMesesCerrados) {
    throw new Error(
      `No se puede cerrar el ejercicio ${ejercicio}: existen meses abiertos (${resumen.mesesAbiertos.join(", ")}). Debe cerrar todos los meses primero.`,
    );
  }

  return enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "ejecutar_cierre_anual");

    // 1. Obtener el período contable de diciembre (mes 12) para el asiento
    const { rows: perRows } = await cliente.query<{ id: string }>(
      `SELECT id FROM contabilidad.periodo_contable WHERE anio = $1 AND mes = 12`,
      [ejercicio],
    );
    if (perRows.length === 0) {
      throw new Error(`No existe el período de diciembre para el ejercicio ${ejercicio}.`);
    }
    const periodoDiciembreId = perRows[0].id;

    // 2. Las líneas salen de los códigos de cierre (Configuración contable):
    // cada cuenta con saldo se cancela y la contrapartida va a resultados
    // acumulados. Si falta la cuenta del código, el motor se detiene con un
    // mensaje claro antes de escribir nada.
    const { partidas, lineasExtra, hayMovimientos } = armarAsientoCierre(resumen, ejercicio);
    let asientoCierreId: string | null = null;

    // Si existen saldos a liquidar en ingresos o gastos, generamos el asiento de cierre
    if (hayMovimientos) {
      const lineas = await construirLineasPorCodigo(cliente, partidas, lineasExtra);

      // Siguiente número de asiento
      const { rows: numRows } = await cliente.query<{ sig: string }>(
        `SELECT contabilidad.siguiente_numero('AS') AS sig`,
      );
      const numeroAsiento = Number(numRows[0].sig);

      // Crear asiento
      const fechaCierre = `${ejercicio}-12-31`;

      const { rows: asRows } = await cliente.query<{ id: string }>(
        // Nace procesado: lo genera el cierre que alguien ya aprobó, y un
        // asiento sin procesar impediría cerrar diciembre (0080).
        `INSERT INTO contabilidad.asiento
           (numero, fecha, periodo_id, concepto, tipo, creado_por, procesado_en, procesado_por)
         VALUES ($1, $2, $3, $4, 'ajuste', $5, now(), $5)
         RETURNING id`,
        [numeroAsiento, fechaCierre, periodoDiciembreId, conceptoDeCierre(ejercicio), ctx.usuarioId],
      );
      asientoCierreId = asRows[0].id;

      for (const l of lineas) {
        await cliente.query(
          `INSERT INTO contabilidad.asiento_linea
             (asiento_id, cuenta_id, debe, haber, descripcion)
           VALUES ($1, $2, $3, $4, $5)`,
          [asientoCierreId, l.cuenta_id, l.debe, l.haber, l.descripcion],
        );
      }
    }

    // 3. Registrar el cierre anual en contabilidad.cierre_anual
    const { rows: crRows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.cierre_anual
         (ejercicio, fecha_cierre, asiento_cierre_id, total_ingresos, total_gastos, superavit_deficit, cerrado_por, notas)
       VALUES ($1, (now() AT TIME ZONE 'America/Santo_Domingo')::date, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        ejercicio,
        asientoCierreId,
        resumen.totalIngresos,
        resumen.totalGastos,
        resumen.superavitDeficitNeto,
        ctx.usuarioId,
        notas?.trim() || null,
      ],
    );

    revalidatePath("/[locale]/(portal)/contabilidad/cierre", "page");
    revalidatePath("/[locale]/(portal)/contabilidad/reportes", "page");

    return {
      cierreId: crRows[0].id,
      asientoId: asientoCierreId,
    };
  }).catch(async (error: unknown) => {
    // Un código sin cuenta debe leerse como «qué falta», no como un error técnico.
    const traducido = await textoDeErrorCodigos(error);
    throw traducido ? new Error(traducido) : error;
  });
}

/**
 * Opción «Asiento» del cierre anual: el asiento que saldría hoy con los saldos
 * de ingresos y gastos del ejercicio, sin escribir nada. Si el ejercicio ya se
 * cerró, el cierre real se ve con `asientoDeCierreAnual`.
 */
export async function asientoPreviaCierreAnual(ejercicio: number): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const resumen = await obtenerResumenPreCierreAnual(ejercicio);
  const { partidas, lineasExtra } = armarAsientoCierre(resumen, ejercicio);
  return enTransaccion((cliente) =>
    vistaDeLineasPorCodigo(cliente, partidas, {
      fecha: `${ejercicio}-12-31`,
      descripcion: conceptoDeCierre(ejercicio),
      lineasExtra,
    }),
  );
}

/** Opción «Asiento» de un cierre anual ya ejecutado. */
export async function asientoDeCierreAnual(asientoId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  return vistaDeAsientoContabilizado(asientoId);
}
