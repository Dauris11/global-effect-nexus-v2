"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { consultarUna, enTransaccion, enTransaccionComo } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";
import { armarVista, type VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";
import { vistaDeAsientoContabilizado, vistaDeLineasPorCodigo } from "@/server/contabilidad/asientos/vista";
import { construirLineasPorCodigo } from "@/server/contabilidad/codigos-transaccion/asiento";
import {
  ErrorOperacion,
  textoDeErrorOperacion,
  type ResultadoOperacion,
} from "@/server/contabilidad/operaciones/errores";
import {
  depreciacionConMismaCuenta,
  exigirCuentasDistintas,
  partidasDeDepreciacion,
  planDeDepreciacion,
} from "@/server/contabilidad/activos-fijos/asiento";

export type CrearActivoFijoInput = {
  inventario_activo_id?: string | null;
  codigo: string;
  nombre: string;
  categoria_id: string;
  centro_costo_id: string;
  fecha_adquisicion: string;
  costo_adquisicion: number;
  valor_residual?: number;
  es_donado?: boolean;
};

export async function crearActivoFijo(input: CrearActivoFijoInput): Promise<{ id: string }> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const ctx = await contextoDe(usuario);

  if (input.costo_adquisicion <= 0) {
    throw new Error("El costo de adquisición debe ser mayor a cero.");
  }

  const valorResidual = input.valor_residual ?? 0;
  const valorEnLibros = input.costo_adquisicion;

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "crear_activo_fijo");

    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.activo_fijo
         (inventario_activo_id, codigo, nombre, categoria_id, centro_costo_id,
          fecha_adquisicion, costo_adquisicion, valor_residual, valor_en_libros,
          es_donado)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10)
       RETURNING id`,
      [
        input.inventario_activo_id || null,
        input.codigo.trim(),
        input.nombre.trim(),
        input.categoria_id,
        input.centro_costo_id,
        input.fecha_adquisicion,
        input.costo_adquisicion,
        valorResidual,
        valorEnLibros,
        input.es_donado ?? false,
      ],
    );

    return rows[0];
  });

  revalidatePath("/contabilidad/activos-fijos");
  return res;
}

export async function ejecutarDepreciacionMensual(
  anio: number,
  mes: number,
  fechaAsiento: string,
): Promise<ResultadoOperacion<{ id: string; totalDepreciado: number; asientoId: string }>> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  const ctx = await contextoDe(usuario);

  try {
    const res = await enTransaccionComo(ctx, async (cliente) => {
      await fijarAccion(cliente, "ejecutar_depreciacion_mensual");

      // Verificar si ya existe para este mes
      const yaExiste = await cliente.query(
        `SELECT id FROM contabilidad.depreciacion_mensual WHERE anio = $1 AND mes = $2`,
        [anio, mes],
      );
      if (yaExiste.rows.length > 0) throw new ErrorOperacion("depreciacion_ya_ejecutada", { mes, anio });

      const { lineas: lineasCalculadas, totalDepreciado } = await planDeDepreciacion(cliente, fechaAsiento);
      if (lineasCalculadas.length === 0) throw new ErrorOperacion("sin_activos_depreciables");

      await exigirCuentasDistintas(cliente);
      // Falla con «código sin cuenta» si los códigos AF_* no están asignados:
      // mejor detenerse que depreciar activos sin asiento.
      const lineasAsiento = await construirLineasPorCodigo(
        cliente,
        partidasDeDepreciacion(totalDepreciado, mes, anio),
      );

      // `crear_asiento` asigna número y período; armar la cabecera a
      // mano duplicaba esa lógica con columnas que la tabla no tiene.
      const { rows: asRows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.crear_asiento($1::date, $2, 'ajuste', NULL, NULL, $3::jsonb) AS id`,
        [
          fechaAsiento,
          `Depreciación mensual de activos fijos ${mes}/${anio}`,
          JSON.stringify(lineasAsiento),
        ],
      );
      const asientoId = asRows[0].id;

      // Insertar cabecera corrida
      const { rows: depRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.depreciacion_mensual
           (anio, mes, fecha_asiento, total_depreciacion, asiento_id, creado_por)
         VALUES ($1, $2, $3::date, $4, $5, $6)
         RETURNING id`,
        [anio, mes, fechaAsiento, totalDepreciado, asientoId, usuario.id],
      );
      const depreciacionId = depRows[0].id;

      // Insertar líneas y actualizar activos
      for (const l of lineasCalculadas) {
        await cliente.query(
          `INSERT INTO contabilidad.depreciacion_linea
             (depreciacion_id, activo_fijo_id, monto_depreciacion,
              depreciacion_acumulada_previa, nuevo_valor_en_libros)
           VALUES ($1, $2, $3, $4, $5)`,
          [depreciacionId, l.activoId, l.monto, l.deprecPrevia, l.nuevoValorLibros],
        );

        await cliente.query(
          `UPDATE contabilidad.activo_fijo
              SET depreciacion_acumulada = depreciacion_acumulada + $2,
                  valor_en_libros        = $3,
                  meses_depreciados      = $4,
                  estado                 = CASE WHEN $5 = true THEN 'totalmente_depreciado' ELSE estado END,
                  actualizado_en         = now()
            WHERE id = $1`,
          [l.activoId, l.monto, l.nuevoValorLibros, l.nuevosMeses, l.totalmenteDepreciado],
        );
      }

      return { id: depreciacionId, totalDepreciado, asientoId };
    });

    revalidatePath("/contabilidad/activos-fijos");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: await textoDeErrorOperacion(e) };
  }
}

/**
 * «Asiento» de la depreciación ANTES de ejecutarla: mismo cálculo y mismas
 * partidas que `ejecutarDepreciacionMensual`. Si el mes ya se ejecutó, muestra
 * el asiento real. No lanza por falta de activos o de cuentas: lo dice en la vista.
 */
export async function asientoDeDepreciacion(anio: number, mes: number, fechaAsiento: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const t = await getTranslations("contab.operaciones.avisos");
  const sinAsiento = (clave: "depreciacion_sin_activos" | "depreciacion_misma_cuenta") =>
    armarVista([], [{ clave: "otro", detalle: t(clave) }], { estado: "previa" });

  const hecha = await consultarUna<{ asiento_id: string | null }>(
    `SELECT asiento_id FROM contabilidad.depreciacion_mensual WHERE anio = $1 AND mes = $2`,
    [anio, mes],
  );
  if (hecha?.asiento_id) return vistaDeAsientoContabilizado(hecha.asiento_id);

  return enTransaccion(async (cliente) => {
    const { totalDepreciado, lineas } = await planDeDepreciacion(cliente, fechaAsiento);
    if (lineas.length === 0) return sinAsiento("depreciacion_sin_activos");
    const vista = await vistaDeLineasPorCodigo(cliente, partidasDeDepreciacion(totalDepreciado, mes, anio), {
      descripcion: `Depreciación mensual de activos fijos ${mes}/${anio}`,
      fecha: fechaAsiento,
    });
    if (await depreciacionConMismaCuenta(cliente)) {
      vista.problemas.push({ clave: "otro", detalle: t("depreciacion_misma_cuenta") });
    }
    return vista;
  });
}

/** «Asiento» ya contabilizado de una corrida de depreciación pasada. */
export async function asientoDeDepreciacionEjecutada(depreciacionId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const fila = await consultarUna<{ asiento_id: string | null }>(
    `SELECT asiento_id FROM contabilidad.depreciacion_mensual WHERE id = $1`,
    [depreciacionId],
  );
  if (!fila?.asiento_id) {
    const t = await getTranslations("contab.operaciones.avisos");
    return armarVista([], [{ clave: "otro", detalle: t("inventario_sin_asiento") }], { estado: "previa" });
  }
  return vistaDeAsientoContabilizado(fila.asiento_id);
}

export async function darDeBajaActivoFijo(
  id: string,
  motivo: string,
  fechaBaja: string,
): Promise<void> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  const ctx = await contextoDe(usuario);

  await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "dar_baja_activo_fijo");

    await cliente.query(
      `UPDATE contabilidad.activo_fijo
          SET estado = 'baja',
              motivo_baja = $2,
              fecha_baja = $3::date,
              actualizado_en = now()
        WHERE id = $1`,
      [id, motivo.trim(), fechaBaja],
    );
  });

  revalidatePath("/contabilidad/activos-fijos");
}
