"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { esUuid } from "@/lib/contabilidad/formato";
import { esPilarCosto, type PilarCosto } from "@/lib/costos";
import { usuarioTienePermiso } from "@/lib/rbac";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type EstadoAccionOC = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function crearOrdenCompra(datos: {
  proveedorId: string;
  fecha: string;
  fechaEntrega?: string;
  moneda: "DOP" | "USD";
  fondoId: string;
  categoriaId: string;
  proyectoId?: string;
  justificacion?: string;
  lineas: {
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    itbisTasa?: number;
    /** Costo por estudiante (0112): el becado al que sirve la línea y a qué pilar pertenece. */
    estudianteId?: string;
    pilarCosto?: PilarCosto;
  }[];
}): Promise<EstadoAccionOC> {
  const usuario = await requerirUsuario();
  // La pantalla pide `contabilidad.leer`, pero esconder el botón no es control
  // de acceso: crear la orden exige poder registrar.
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) {
    return { ok: false, error: "No tiene permiso para registrar órdenes de compra" };
  }
  if (datos.lineas?.some((l) => (l.estudianteId && !esUuid(l.estudianteId)) || (l.pilarCosto && !esPilarCosto(l.pilarCosto)))) {
    return { ok: false, error: "Estudiante o pilar de costo inválido" };
  }

  if (!datos.lineas || datos.lineas.length === 0) {
    return { ok: false, error: "La orden de compra debe tener al menos una línea" };
  }

  try {
    const ocId = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "crear_orden_compra");

      const { rows: secRows } = await cliente.query<{ num: string }>(
        `SELECT contabilidad.siguiente_numero('OC')::text AS num`
      );
      const numero = Number(secRows[0].num);

      // Calcular subtotales
      let subtotalGeneral = 0;
      let itbisGeneral = 0;

      const lineasCalculadas = datos.lineas.map((l, idx) => {
        const cant = Number(l.cantidad);
        const precio = Number(l.precioUnitario);
        const st = cant * precio;
        const tasa = l.itbisTasa !== undefined ? Number(l.itbisTasa) : 0.18;
        const it = st * tasa;
        const tot = st + it;

        subtotalGeneral += st;
        itbisGeneral += it;

        return {
          idx: idx + 1,
          descripcion: l.descripcion.trim(),
          cantidad: cant,
          precioUnitario: precio,
          itbisTasa: tasa,
          montoItbis: it,
          subtotal: st,
          total: tot,
          estudianteId: l.estudianteId || null,
          pilarCosto: l.estudianteId ? (l.pilarCosto ?? "universidad") : null,
        };
      });

      const { rows: ocRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.orden_compra (
           numero, proveedor_id, fecha, fecha_entrega, moneda,
           subtotal, itbis, fondo_id, categoria_id, proyecto_id,
           justificacion, estado, creado_por
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendiente_aprobacion', $12)
         RETURNING id`,
        [
          numero,
          datos.proveedorId,
          datos.fecha,
          datos.fechaEntrega || null,
          datos.moneda,
          subtotalGeneral.toFixed(2),
          itbisGeneral.toFixed(2),
          datos.fondoId,
          datos.categoriaId,
          datos.proyectoId || null,
          datos.justificacion?.trim() || null,
          usuario.id,
        ]
      );
      const id = ocRows[0].id;

      for (const lin of lineasCalculadas) {
        await cliente.query(
          `INSERT INTO contabilidad.orden_compra_linea (
             orden_compra_id, numero_linea, descripcion, cantidad,
             precio_unitario, itbis_tasa, monto_itbis, subtotal, total, estudiante_id, pilar_costo
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id,
            lin.idx,
            lin.descripcion,
            lin.cantidad,
            lin.precioUnitario,
            lin.itbisTasa,
            lin.montoItbis.toFixed(2),
            lin.subtotal.toFixed(2),
            lin.total.toFixed(2),
            lin.estudianteId,
            lin.pilarCosto,
          ]
        );
      }

      return id;
    });

    revalidatePath("/contabilidad/ordenes-compra");
    return { ok: true, id: ocId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al crear orden de compra" };
  }
}

export async function aprobarOrdenCompra(id: string): Promise<EstadoAccionOC> {
  const usuario = await requerirUsuario();
  const puedeAprobar = usuarioTienePermiso(usuario, "contabilidad.aprobar");

  if (!puedeAprobar) {
    return { ok: false, error: "No tiene permiso de aprobación contable" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "aprobar_orden_compra");

      // Verificar que no sea el mismo que registró salvo si es el único con permiso
      const { rows: ocRows } = await cliente.query<{ creado_por: string; estado: string; total: string }>(
        `SELECT creado_por, estado, total FROM contabilidad.orden_compra WHERE id = $1`,
        [id]
      );

      if (ocRows.length === 0) throw new Error("Orden de compra no encontrada");
      if (ocRows[0].estado !== "pendiente_aprobacion") {
        throw new Error("La orden de compra no está pendiente de aprobación");
      }

      await cliente.query(
        `UPDATE contabilidad.orden_compra
         SET estado = 'aprobada', aprobado_por = $1, aprobado_en = now()
         WHERE id = $2`,
        [usuario.id, id]
      );
    });

    revalidatePath("/contabilidad/ordenes-compra");
    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al aprobar orden de compra" };
  }
}

export async function rechazarOrdenCompra(id: string, motivo: string): Promise<EstadoAccionOC> {
  const usuario = await requerirUsuario();
  if (!motivo.trim() || motivo.trim().length < 5) {
    return { ok: false, error: "Debe indicar un motivo de rechazo claro (mínimo 5 caracteres)" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "rechazar_orden_compra");

      await cliente.query(
        `UPDATE contabilidad.orden_compra
         SET estado = 'rechazada', motivo_rechazo = $1
         WHERE id = $2 AND estado = 'pendiente_aprobacion'`,
        [motivo.trim(), id]
      );
    });

    revalidatePath("/contabilidad/ordenes-compra");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Error al rechazar orden de compra" };
  }
}
