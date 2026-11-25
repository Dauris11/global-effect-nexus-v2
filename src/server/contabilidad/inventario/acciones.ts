"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { consultar, consultarUna, enTransaccion, enTransaccionComo } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";
import type { VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { armarVista } from "@/lib/contabilidad/vista-asiento";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";
import { vistaDeAsientoContabilizado, vistaDeLineasPorCodigo } from "@/server/contabilidad/asientos/vista";
import {
  ErrorOperacion,
  textoDeErrorOperacion,
  type ResultadoOperacion,
} from "@/server/contabilidad/operaciones/errores";
import { construirLineasPorCodigo } from "@/server/contabilidad/codigos-transaccion/asiento";
import {
  lineasDeConsumo,
  partidasDeAjusteConteo,
  partidasDeConsumo,
} from "@/server/contabilidad/inventario/asiento";

export type CrearArticuloInput = {
  codigo: string;
  nombre: string;
  categoria: "alimentos_comedor" | "suministros_oficina" | "material_didactico" | "limpieza" | "otros";
  unidad_medida: "unidad" | "libra" | "kilo" | "caja" | "saco" | "litro" | "galon" | "paquete";
  centro_costo_id?: string | null;
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
    // Las cuentas de existencias y de consumo ya no son del artículo: son los
    // códigos INV_* (Configuración contable). Las columnas viejas quedan sin
    // usar. Un artículo se puede crear aunque esos códigos aún no tengan
    // cuenta; solo el movimiento que contabiliza se detiene.
    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.articulo
         (codigo, nombre, categoria, unidad_medida, centro_costo_id, stock_minimo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.codigo.trim(),
        input.nombre.trim(),
        input.categoria,
        input.unidad_medida,
        input.centro_costo_id || null,
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
): Promise<ResultadoOperacion<{ id: string; asientoId?: string }>> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const ctx = await contextoDe(usuario);

  if (!(input.cantidad > 0)) {
    return { ok: false, error: await textoDeErrorOperacion(new ErrorOperacion("cantidad_invalida")) };
  }

  try {
    const res = await enTransaccionComo(ctx, async (cliente) => {
      await fijarAccion(cliente, "registrar_movimiento_inventario");

      const { rows: artRows } = await cliente.query<{
        id: string;
        codigo: string;
        nombre: string;
        stock_actual: string;
        costo_promedio: string;
        centro_costo_id: string | null;
      }>(
        `SELECT id, codigo, nombre, stock_actual::text AS stock_actual,
                costo_promedio::text AS costo_promedio, centro_costo_id
           FROM contabilidad.articulo
          WHERE id = $1
            FOR UPDATE`,
        [input.articulo_id],
      );

      const art = artRows[0];
      if (!art) throw new ErrorOperacion("articulo_no_encontrado");

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
        if (costoUnitario < 0) throw new ErrorOperacion("costo_negativo");

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
          throw new ErrorOperacion("stock_insuficiente", {
            nombre: art.nombre,
            disponible: stockAnt,
            solicitado: input.cantidad,
          });
        }

        costoUnitario = costoPromAnt;
        costoTotal = Math.round(input.cantidad * costoUnitario * 100) / 100;
        stockPost = Math.round((stockAnt - input.cantidad) * 100) / 100;
        costoPromPost = costoPromAnt;

        // Generar asiento contable de consumo si es salida de consumo
        if (input.tipo === "salida_consumo" && costoTotal > 0) {
          // Las líneas salen de los códigos INV_CONSUMO_*; se arman ANTES de
          // crear la cabecera para que un código sin cuenta no deje nada a
          // medias. La cabecera la crea `crear_asiento` (número y período); las
          // líneas se insertan a mano porque el gasto lleva centro de costo y la
          // función no lo acepta. El cuadre lo valida el disparador diferido.
          const { lineas, indiceGasto } = await lineasDeConsumo(cliente, partidasDeConsumo(art.nombre, costoTotal));
          const asRes = await cliente.query<{ id: string }>(
            `SELECT contabilidad.crear_asiento($1::date, $2, 'ajuste', NULL, NULL, '[]'::jsonb) AS id`,
            [input.fecha, `Consumo de inventario: ${art.nombre} (${input.cantidad})`],
          );
          asientoId = asRes.rows[0].id;

          const centroImputacion = input.centro_costo_id || art.centro_costo_id;

          for (const [i, l] of lineas.entries()) {
            await cliente.query(
              `INSERT INTO contabilidad.asiento_linea
                 (asiento_id, cuenta_id, centro_costo_id, debe, haber, descripcion)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [asientoId, l.cuenta_id, i === indiceGasto ? centroImputacion : null, l.debe, l.haber, l.descripcion],
            );
          }
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
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: await textoDeErrorOperacion(e) };
  }
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
): Promise<ResultadoOperacion<{ asientoAjusteId?: string }>> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  const ctx = await contextoDe(usuario);

  try {
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
      if (!cf) throw new ErrorOperacion("conteo_no_encontrado");
      if (cf.estado !== "borrador") {
        throw new ErrorOperacion("conteo_no_aplicable", { estado: cf.estado });
      }

      let impactoNeto = 0;
      const mapaAjustes = new Map(lineasAjustadas.map((l) => [l.lineaId, l.stockFisico]));

      const { rows: lineas } = await cliente.query<{
        id: string;
        articulo_id: string;
        stock_sistema: string;
        costo_unitario: string;
      }>(
        `SELECT cfl.id, cfl.articulo_id, cfl.stock_sistema::text AS stock_sistema,
                cfl.costo_unitario::text AS costo_unitario
           FROM contabilidad.conteo_fisico_linea cfl
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

      // Si hubo diferencia monetaria neta, generar asiento de ajuste con los
      // códigos INV_SOBRANTE_* o INV_FALTANTE_* (cuentas globales, ya no por
      // artículo: antes se usaba las del primer artículo para todo el conteo).
      const partidas = partidasDeAjusteConteo(impactoNeto);
      if (partidas.length > 0) {
        const lineasAsiento = await construirLineasPorCodigo(cliente, partidas);
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
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: await textoDeErrorOperacion(e) };
  }
}

/** Vista vacía con un aviso legible: no hay asiento que mostrar (todavía o nunca). */
async function vistaSinAsiento(clave: "inventario_sin_costo" | "inventario_sin_asiento" | "inventario_sin_diferencia") {
  const t = await getTranslations("contab.operaciones.avisos");
  return armarVista([], [{ clave: "otro", detalle: t(clave) }], { estado: "previa" });
}

/**
 * «Asiento» de una salida por consumo ANTES de registrarla: mismas partidas
 * que `registrarMovimientoInventario`, calculadas con la cantidad y el costo
 * promedio actuales del artículo. Solo la salida por consumo genera asiento;
 * las demás entradas y ajustes del Kardex solo mueven existencias.
 */
export async function asientoDeConsumoInventario(articuloId: string, cantidad: number): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const art = await consultarUna<{ nombre: string; costo_promedio: string }>(
    `SELECT nombre, costo_promedio::text AS costo_promedio FROM contabilidad.articulo WHERE id = $1`,
    [articuloId],
  );
  if (!art) return vistaSinAsiento("inventario_sin_costo");
  const costoTotal = Math.round((Number.isFinite(cantidad) ? cantidad : 0) * Number(art.costo_promedio) * 100) / 100;
  if (!(costoTotal > 0)) return vistaSinAsiento("inventario_sin_costo");
  return enTransaccion((cliente) =>
    vistaDeLineasPorCodigo(cliente, partidasDeConsumo(art.nombre, costoTotal), {
      descripcion: `Consumo de inventario: ${art.nombre} (${cantidad})`,
    }),
  );
}

/** «Asiento» ya contabilizado de un movimiento del Kardex (solo las salidas por consumo lo tienen). */
export async function asientoDeMovimientoInventario(movimientoId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const mov = await consultarUna<{ asiento_id: string | null }>(
    `SELECT asiento_id FROM contabilidad.inventario_movimiento WHERE id = $1`,
    [movimientoId],
  );
  if (!mov?.asiento_id) return vistaSinAsiento("inventario_sin_asiento");
  return vistaDeAsientoContabilizado(mov.asiento_id);
}

/**
 * «Asiento» de una toma física: el real si ya se aplicó, y si sigue en
 * borrador el que saldría con las diferencias guardadas hasta ahora.
 */
export async function asientoDeConteoFisico(conteoId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const cf = await consultarUna<{ estado: string; asiento_id: string | null; codigo: string }>(
    `SELECT estado, asiento_id, codigo FROM contabilidad.conteo_fisico WHERE id = $1`,
    [conteoId],
  );
  if (!cf) return vistaSinAsiento("inventario_sin_asiento");
  if (cf.asiento_id) return vistaDeAsientoContabilizado(cf.asiento_id);
  if (cf.estado !== "borrador") return vistaSinAsiento("inventario_sin_diferencia");

  // Mismo cálculo de `aplicarConteoFisico`: impacto de cada línea redondeado a centavos y sumado.
  const filas = await consultar<{ stock_sistema: string; stock_fisico: string; costo_unitario: string }>(
    `SELECT stock_sistema::text, stock_fisico::text, costo_unitario::text
       FROM contabilidad.conteo_fisico_linea WHERE conteo_id = $1`,
    [conteoId],
  );
  let centavos = 0;
  for (const f of filas) {
    const dif = Math.round((Number(f.stock_fisico) - Number(f.stock_sistema)) * 100) / 100;
    centavos += Math.round(dif * Number(f.costo_unitario) * 100);
  }
  const partidas = partidasDeAjusteConteo(centavos / 100);
  if (partidas.length === 0) return vistaSinAsiento("inventario_sin_diferencia");
  return enTransaccion((cliente) =>
    vistaDeLineasPorCodigo(cliente, partidas, { descripcion: `Ajuste de inventario físico ${cf.codigo}` }),
  );
}
