"use server";

import { revalidatePath } from "next/cache";
import { enTransaccionComo } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";
import { obtenerResumenPreCierreAnual } from "./consultas";

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

    // 2. Obtener la cuenta de Resultados Acumulados (3.1.01.02)
    const { rows: ctaRows } = await cliente.query<{ id: string }>(
      `SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '3.1.01.02'`,
    );
    if (ctaRows.length === 0) {
      throw new Error("No se encontró la cuenta de Resultados Acumulados (3.1.01.02).");
    }
    const cuentaResultadosAcumuladosId = ctaRows[0].id;

    let asientoCierreId: string | null = null;

    // Si existen saldos a liquidar en ingresos o gastos, generamos el asiento de cierre
    const hayMovimientos = resumen.cuentasIngresoSaldar.length > 0 || resumen.cuentasGastoSaldar.length > 0;

    if (hayMovimientos) {
      // Siguiente número de asiento
      const { rows: numRows } = await cliente.query<{ sig: string }>(
        `SELECT contabilidad.siguiente_numero('AS') AS sig`,
      );
      const numeroAsiento = Number(numRows[0].sig);

      // Crear asiento
      const fechaCierre = `${ejercicio}-12-31`;
      const concepto = `Asiento de Cierre Ejercicio Fiscal ${ejercicio} - Cancelación de Cuentas de Resultados`;

      const { rows: asRows } = await cliente.query<{ id: string }>(
        // Nace procesado: lo genera el cierre que alguien ya aprobó, y un
        // asiento sin procesar impediría cerrar diciembre (0080).
        `INSERT INTO contabilidad.asiento
           (numero, fecha, periodo_id, concepto, tipo, creado_por, procesado_en, procesado_por)
         VALUES ($1, $2, $3, $4, 'ajuste', $5, now(), $5)
         RETURNING id`,
        [numeroAsiento, fechaCierre, periodoDiciembreId, concepto, ctx.usuarioId],
      );
      asientoCierreId = asRows[0].id;

      // Líneas para cancelar cuentas de ingresos (debe)
      for (const ing of resumen.cuentasIngresoSaldar) {
        await cliente.query(
          `INSERT INTO contabilidad.asiento_linea
             (asiento_id, cuenta_id, debe, haber, descripcion)
           VALUES ($1, $2, $3, 0, $4)`,
          [
            asientoCierreId,
            ing.cuentaId,
            ing.saldo,
            `Cancelación saldo acreedor ingreso: ${ing.nombre}`,
          ],
        );
      }

      // Líneas para cancelar cuentas de gastos (haber)
      for (const gas of resumen.cuentasGastoSaldar) {
        await cliente.query(
          `INSERT INTO contabilidad.asiento_linea
             (asiento_id, cuenta_id, debe, haber, descripcion)
           VALUES ($1, $2, 0, $3, $4)`,
          [
            asientoCierreId,
            gas.cuentaId,
            gas.saldo,
            `Cancelación saldo deudor gasto: ${gas.nombre}`,
          ],
        );
      }

      // Contrapartida a Resultados Acumulados
      const superavit = resumen.superavitDeficitNeto;
      if (superavit > 0) {
        // Superávit: Crédito a Resultados Acumulados
        await cliente.query(
          `INSERT INTO contabilidad.asiento_linea
             (asiento_id, cuenta_id, debe, haber, descripcion)
           VALUES ($1, $2, 0, $3, $4)`,
          [
            asientoCierreId,
            cuentaResultadosAcumuladosId,
            superavit,
            `Superávit neto del ejercicio ${ejercicio} trasladado a Resultados Acumulados`,
          ],
        );
      } else if (superavit < 0) {
        // Déficit: Débito a Resultados Acumulados
        await cliente.query(
          `INSERT INTO contabilidad.asiento_linea
             (asiento_id, cuenta_id, debe, haber, descripcion)
           VALUES ($1, $2, $3, 0, $4)`,
          [
            asientoCierreId,
            cuentaResultadosAcumuladosId,
            Math.abs(superavit),
            `Déficit neto del ejercicio ${ejercicio} absorbido en Resultados Acumulados`,
          ],
        );
      }
    }

    // 3. Registrar el cierre anual en contabilidad.cierre_anual
    const { rows: crRows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.cierre_anual
         (ejercicio, fecha_cierre, asiento_cierre_id, total_ingresos, total_gastos, superavit_deficit, cerrado_por, notas)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7)
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
  });
}
