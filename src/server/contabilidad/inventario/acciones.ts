"use server";

import { revalidatePath } from "next/cache";
import { enTransaccionComo } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type CrearArticuloInput = {
  codigo: string;
  nombre: string;
  categoria: "alimentos_comedor" | "suministros_oficina" | "material_didactico" | "limpieza" | "otros";
  unidad_medida: "unidad" | "libra" | "kilo" | "caja" | "saco" | "litro" | "galon" | "paquete";
  centro_costo_id?: string | null;
  cuenta_inventario_id: string;
  cuenta_gasto_id: string;
  stock_minimo?: number;
};

export type RegistrarMovimientoInput = {
  articulo_id: string;
  tipo: "entrada_compra" | "entrada_donacion" | "salida_consumo" | "ajuste_sobrante" | "ajuste_faltante";
  fecha: string;
  cantidad: number;
  costo_unitario?: number;
  centro_costo_id?: string | null;
  motivo?: string;
};

export async function crearArticulo(input: CrearArticuloInput): Promise<{ id: string }> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const ctx = await contextoDe(usuario);

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "crear_articulo");

    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.articulo
         (codigo, nombre, categoria, unidad_medida, centro_costo_id,
          cuenta_inventario_id, cuenta_gasto_id, stock_minimo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.codigo.trim(),
        input.nombre.trim(),
        input.categoria,
        input.unidad_medida,
        input.centro_costo_id || null,
        input.cuenta_inventario_id,
        input.cuenta_gasto_id,
        input.stock_minimo ?? 0,
      ],
    );

    return rows[0];
  });

  revalidatePath("/contabilidad/inventario");
  return res;
}

export async function registrarMovimientoInventario(
  input: RegistrarMovimientoInput,
): Promise<{ id: string; asientoId?: string }> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const ctx = await contextoDe(usuario);

  if (input.cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a cero.");
  }

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "registrar_movimiento_inventario");

    const { rows: artRows } = await cliente.query<{
      id: string;
      codigo: string;
      nombre: string;
      stock_actual: string;
      costo_promedio: string;
      cuenta_inventario_id: string;
      cuenta_gasto_id: string;
      centro_costo_id: string | null;
    }>(
      `SELECT id, codigo, nombre, stock_actual::text AS stock_actual,
              costo_promedio::text AS costo_promedio, cuenta_inventario_id,
              cuenta_gasto_id, centro_costo_id
         FROM contabilidad.articulo
        WHERE id = $1
          FOR UPDATE`,
      [input.articulo_id],
    );

    const art = artRows[0];
    if (!art) throw new Error("Artículo no encontrado.");

    const stockAnt = Number(art.stock_actual);
    const costoPromAnt = Number(art.costo_promedio);

    const esEntrada =
      input.tipo === "entrada_compra" ||
      input.tipo === "entrada_donacion" ||
      input.tipo === "ajuste_sobrante";

    let stockPost: number;
    let costoUnitario: number;
    let costoTotal: number;
    let costoPromPost: number;
    let asientoId: string | undefined = undefined;

    if (esEntrada) {
      costoUnitario = input.costo_unitario ?? costoPromAnt;
      if (costoUnitario < 0) throw new Error("El costo unitario no puede ser negativo.");

      costoTotal = Math.round(input.cantidad * costoUnitario * 100) / 100;
      stockPost = Math.round((stockAnt + input.cantidad) * 100) / 100;

      if (stockPost > 0) {
        costoPromPost = (stockAnt * costoPromAnt + costoTotal) / stockPost;
      } else {
        costoPromPost = costoUnitario;
      }
    } else {
      // Salida
      if (stockAnt < input.cantidad) {
        throw new Error(
          `Stock insuficiente para '${art.nombre}'. Stock disponible: ${stockAnt}, solicitado: ${input.cantidad}.`,
        );
      }

      costoUnitario = costoPromAnt;
      costoTotal = Math.round(input.cantidad * costoUnitario * 100) / 100;
      stockPost = Math.round((stockAnt - input.cantidad) * 100) / 100;
      costoPromPost = costoPromAnt;

      // Generar asiento contable de consumo si es salida de consumo
      if (input.tipo === "salida_consumo" && costoTotal > 0) {
        // La cabecera la crea `crear_asiento` (número y período); las líneas
        // van a mano porque el débito lleva centro de costo y la función no
        // lo acepta. El cuadre lo valida el disparador diferido al confirmar.
        const asRes = await cliente.query<{ id: string }>(
          `SELECT contabilidad.crear_asiento($1::date, $2, 'ajuste', NULL, NULL, '[]'::jsonb) AS id`,
          [input.fecha, `Consumo de inventario: ${art.nombre} (${input.cantidad})`],
        );
        asientoId = asRes.rows[0].id;

        const centroImputacion = input.centro_costo_id || art.centro_costo_id;

        await cliente.query(
          `INSERT INTO contabilidad.asiento_linea
             (asiento_id, cuenta_id, centro_costo_id, debe, haber, descripcion)
           VALUES ($1, $2, $3, $4, 0, $5),
                  ($1, $6, NULL, 0, $4, $7)`,
          [
            asientoId,
            art.cuenta_gasto_id,
            centroImputacion,
            costoTotal,
            `Consumo de ${art.nombre}`,
            art.cuenta_inventario_id,
            `Salida de almacén ${art.nombre}`,
          ],
        );
      }
    }

    const valorTotalPost = Math.round(stockPost * costoPromPost * 100) / 100;

    // Actualizar artículo
    await cliente.query(
      `UPDATE contabilidad.articulo
          SET stock_actual   = $2,
              costo_promedio = $3,
              valor_total    = $4,
              actualizado_en = now()
        WHERE id = $1`,
      [art.id, stockPost, costoPromPost, valorTotalPost],
    );

    // Insertar movimiento en Kardex
    const { rows: movRows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.inventario_movimiento
         (articulo_id, tipo, fecha, cantidad, costo_unitario, costo_total,
          stock_anterior, stock_posterior, costo_promedio_anterior,
          costo_promedio_posterior, centro_costo_id, asiento_id, motivo, creado_por)
       VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        art.id,
        input.tipo,
        input.fecha,
        input.cantidad,
        costoUnitario,
        costoTotal,
        stockAnt,
        stockPost,
        costoPromAnt,
        costoPromPost,
        input.centro_costo_id || art.centro_costo_id,
        asientoId || null,
        input.motivo?.trim() || null,
        usuario.id,
      ],
    );

    return { id: movRows[0].id, asientoId };
  });

  revalidatePath("/contabilidad/inventario");
  return res;
}

export async function crearConteoFisico(input: {
  fecha: string;
  descripcion: string;
}): Promise<{ id: string; codigo: string }> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const ctx = await contextoDe(usuario);

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "crear_conteo_fisico");

    const fechaObj = new Date(input.fecha);
    const anio = fechaObj.getFullYear();

    const countRes = await cliente.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM contabilidad.conteo_fisico`,
    );
    const correlativo = Number(countRes.rows[0].total) + 1;
    const codigo = `CONF-${anio}-${String(correlativo).padStart(3, "0")}`;

    const { rows: cfRows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.conteo_fisico
         (codigo, fecha, descripcion, estado, creado_por)
       VALUES ($1, $2::date, $3, 'borrador', $4)
       RETURNING id`,
      [codigo, input.fecha, input.descripcion.trim(), usuario.id],
    );
    const conteoId = cfRows[0].id;

    // Snapshot de artículos activos
    const { rows: articulos } = await cliente.query<{
      id: string;
      stock_actual: string;
      costo_promedio: string;
    }>(
      `SELECT id, stock_actual::text AS stock_actual, costo_promedio::text AS costo_promedio
         FROM contabilidad.articulo
        WHERE activo = true
        ORDER BY codigo ASC`,
    );

    for (const art of articulos) {
      const stockSis = Number(art.stock_actual);
      const costo = Number(art.costo_promedio);

      await cliente.query(
        `INSERT INTO contabilidad.conteo_fisico_linea
           (conteo_id, articulo_id, stock_sistema, stock_fisico, diferencia,
            costo_unitario, impacto_monetario)
         VALUES ($1, $2, $3, $4, 0, $5, 0)`,
        [conteoId, art.id, stockSis, stockSis, costo],
      );
    }

    return { id: conteoId, codigo };
  });

  revalidatePath("/contabilidad/inventario");
  return res;
}

export async function aplicarConteoFisico(
  conteoId: string,
  lineasAjustadas: Array<{
    lineaId: string;
    stockFisico: number;
  }>,
): Promise<{ asientoAjusteId?: string }> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  const ctx = await contextoDe(usuario);

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "aplicar_conteo_fisico");

    const { rows: cfRows } = await cliente.query<{
      id: string;
      codigo: string;
      estado: string;
      fecha: string;
    }>(
      `SELECT id, codigo, estado, to_char(fecha, 'YYYY-MM-DD') AS fecha
         FROM contabilidad.conteo_fisico
        WHERE id = $1
          FOR UPDATE`,
      [conteoId],
    );

    const cf = cfRows[0];
    if (!cf) throw new Error("Conteo físico no encontrado.");
    if (cf.estado !== "borrador") {
      throw new Error(`El conteo físico está en estado '${cf.estado}' y no puede aplicarse.`);
    }

    let impactoNeto = 0;
    const mapaAjustes = new Map(lineasAjustadas.map((l) => [l.lineaId, l.stockFisico]));

    const { rows: lineas } = await cliente.query<{
      id: string;
      articulo_id: string;
      stock_sistema: string;
      costo_unitario: string;
      cuenta_inventario_id: string;
      cuenta_gasto_id: string;
    }>(
      `SELECT cfl.id, cfl.articulo_id, cfl.stock_sistema::text AS stock_sistema,
              cfl.costo_unitario::text AS costo_unitario,
              a.cuenta_inventario_id, a.cuenta_gasto_id
         FROM contabilidad.conteo_fisico_linea cfl
         JOIN contabilidad.articulo a ON a.id = cfl.articulo_id
        WHERE cfl.conteo_id = $1`,
      [conteoId],
    );

    for (const l of lineas) {
      const stockSis = Number(l.stock_sistema);
      const stockFis = mapaAjustes.get(l.id) ?? stockSis;
      const dif = Math.round((stockFis - stockSis) * 100) / 100;
      const costo = Number(l.costo_unitario);
      const impacto = Math.round(dif * costo * 100) / 100;

      await cliente.query(
        `UPDATE contabilidad.conteo_fisico_linea
            SET stock_fisico      = $2,
                diferencia        = $3,
                impacto_monetario = $4,
                ajuste_aplicado   = true
          WHERE id = $1`,
        [l.id, stockFis, dif, impacto],
      );

      if (dif !== 0) {
        impactoNeto += impacto;

        // Actualizar stock en artículo
        await cliente.query(
          `UPDATE contabilidad.articulo
              SET stock_actual = $2,
                  valor_total  = ROUND($2 * costo_promedio, 2),
                  actualizado_en = now()
            WHERE id = $1`,
          [l.articulo_id, stockFis],
        );

        // Movimiento de ajuste en Kardex
        const tipoMov = dif > 0 ? "ajuste_sobrante" : "ajuste_faltante";
        await cliente.query(
          `INSERT INTO contabilidad.inventario_movimiento
             (articulo_id, tipo, fecha, cantidad, costo_unitario, costo_total,
              stock_anterior, stock_posterior, costo_promedio_anterior,
              costo_promedio_posterior, motivo, creado_por)
           VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $9, $10, $11)`,
          [
            l.articulo_id,
            tipoMov,
            cf.fecha,
            Math.abs(dif),
            costo,
            Math.abs(impacto),
            stockSis,
            stockFis,
            costo,
            `Ajuste por conteo físico ${cf.codigo}`,
            usuario.id,
          ],
        );
      }
    }

    let asientoAjusteId: string | undefined = undefined;

    // Si hubo diferencia monetaria neta, generar asiento de ajuste
    if (Math.abs(impactoNeto) > 0) {
      // Cuenta inventario general y cuenta ajuste/gasto
      const ctaInventario = lineas[0].cuenta_inventario_id;
      const ctaGasto = lineas[0].cuenta_gasto_id;
      const monto = Math.abs(impactoNeto);

      // Sobrante: débito inventario contra ajuste; faltante: al revés.
      const lineasAsiento =
        impactoNeto > 0
          ? [
              { cuenta_id: ctaInventario, debe: monto, haber: 0, descripcion: "Ajuste sobrante de inventario físico" },
              { cuenta_id: ctaGasto, debe: 0, haber: monto, descripcion: "Ganancia por ajuste sobrante físico" },
            ]
          : [
              { cuenta_id: ctaGasto, debe: monto, haber: 0, descripcion: "Gasto / pérdida por faltante de inventario" },
              { cuenta_id: ctaInventario, debe: 0, haber: monto, descripcion: "Ajuste faltante de inventario físico" },
            ];

      const { rows: asRows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.crear_asiento($1::date, $2, 'ajuste', NULL, NULL, $3::jsonb) AS id`,
        [cf.fecha, `Ajuste de inventario físico ${cf.codigo}`, JSON.stringify(lineasAsiento)],
      );
      asientoAjusteId = asRows[0].id;
    }

    await cliente.query(
      `UPDATE contabilidad.conteo_fisico
          SET estado       = 'aplicado',
              asiento_id   = $2,
              aplicado_por = $3,
              aplicado_en  = now()
        WHERE id = $1`,
      [conteoId, asientoAjusteId || null, usuario.id],
    );

    return { asientoAjusteId };
  });

  revalidatePath("/contabilidad/inventario");
  return res;
}
