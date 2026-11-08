"use server";

import { revalidatePath } from "next/cache";
import { enTransaccionComo } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

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
): Promise<{ id: string; totalDepreciado: number; asientoId: string }> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  const ctx = await contextoDe(usuario);

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "ejecutar_depreciacion_mensual");

    // Verificar si ya existe para este mes
    const yaExiste = await cliente.query(
      `SELECT id FROM contabilidad.depreciacion_mensual WHERE anio = $1 AND mes = $2`,
      [anio, mes],
    );
    if (yaExiste.rows.length > 0) {
      throw new Error(`Ya se ejecutó la depreciación para el período ${mes}/${anio}.`);
    }

    // Obtener activos depreciables
    const { rows: activos } = await cliente.query<{
      id: string;
      codigo: string;
      costo_adquisicion: string;
      valor_residual: string;
      depreciacion_acumulada: string;
      valor_en_libros: string;
      meses_depreciados: number;
      vida_util_meses: number;
      cuenta_depreciacion_acumulada_id: string;
      cuenta_gasto_depreciacion_id: string;
    }>(
      `SELECT af.id,
              af.codigo,
              af.costo_adquisicion::text AS costo_adquisicion,
              af.valor_residual::text AS valor_residual,
              af.depreciacion_acumulada::text AS depreciacion_acumulada,
              af.valor_en_libros::text AS valor_en_libros,
              af.meses_depreciados,
              ca.vida_util_meses,
              ca.cuenta_depreciacion_acumulada_id,
              ca.cuenta_gasto_depreciacion_id
         FROM contabilidad.activo_fijo af
         JOIN contabilidad.activo_categoria ca ON ca.id = af.categoria_id
        WHERE af.estado = 'activo'
          AND af.valor_en_libros > af.valor_residual
          AND af.fecha_adquisicion <= $1::date
        ORDER BY af.codigo ASC`,
      [fechaAsiento],
    );

    if (activos.length === 0) {
      throw new Error("No hay activos pendientes de depreciación para este período.");
    }

    let totalDepreciado = 0;
    type LineaDeprec = {
      activoId: string;
      monto: number;
      deprecPrevia: number;
      nuevoValorLibros: number;
      totalmenteDepreciado: boolean;
      nuevosMeses: number;
    };
    const lineasCalculadas: LineaDeprec[] = [];

    // Agrupar monto depreciado por par de cuentas contables de cada categoría
    const acumuladoPorCuentas = new Map<
      string,
      { ctaGasto: string; ctaAcum: string; monto: number }
    >();

    for (const act of activos) {
      const costo = Number(act.costo_adquisicion);
      const residual = Number(act.valor_residual);
      const valorLibros = Number(act.valor_en_libros);
      const deprecPrevia = Number(act.depreciacion_acumulada);

      const cuotaBase = (costo - residual) / act.vida_util_meses;
      const cuotaRedondeada = Math.round(cuotaBase * 100) / 100;

      const saldoDepreciable = valorLibros - residual;
      const cuotaEfectiva = Math.min(cuotaRedondeada, Math.max(0, saldoDepreciable));

      if (cuotaEfectiva > 0) {
        const nuevoValorLibros = Math.round((valorLibros - cuotaEfectiva) * 100) / 100;
        const esTotal = nuevoValorLibros <= residual;

        lineasCalculadas.push({
          activoId: act.id,
          monto: cuotaEfectiva,
          deprecPrevia,
          nuevoValorLibros,
          totalmenteDepreciado: esTotal,
          nuevosMeses: act.meses_depreciados + 1,
        });

        totalDepreciado += cuotaEfectiva;

        const clave = `${act.cuenta_gasto_depreciacion_id}:${act.cuenta_depreciacion_acumulada_id}`;
        const prev = acumuladoPorCuentas.get(clave) ?? {
          ctaGasto: act.cuenta_gasto_depreciacion_id,
          ctaAcum: act.cuenta_depreciacion_acumulada_id,
          monto: 0,
        };
        prev.monto = Math.round((prev.monto + cuotaEfectiva) * 100) / 100;
        acumuladoPorCuentas.set(clave, prev);
      }
    }

    totalDepreciado = Math.round(totalDepreciado * 100) / 100;

    // Líneas de asiento contable desglosadas por las cuentas de cada categoría
    const lineasAsiento: {
      cuenta_id: string;
      debe: number;
      haber: number;
      descripcion: string;
    }[] = [];

    for (const { ctaGasto, ctaAcum, monto } of acumuladoPorCuentas.values()) {
      if (monto <= 0) continue;
      lineasAsiento.push({
        cuenta_id: ctaGasto,
        debe: monto,
        haber: 0,
        descripcion: `Gasto depreciación activos período ${mes}/${anio}`,
      });
      lineasAsiento.push({
        cuenta_id: ctaAcum,
        debe: 0,
        haber: monto,
        descripcion: `Depreciación acumulada activos período ${mes}/${anio}`,
      });
    }

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
  return res;
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
