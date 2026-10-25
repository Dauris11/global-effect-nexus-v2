"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type EstadoAccionDonacion = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function registrarDonacion(datos: {
  terceroId: string;
  fecha: string;
  clase: "efectivo" | "especie";
  tratamiento: "exento" | "gravado";
  moneda: "DOP" | "USD";
  tasa?: number;
  monto: number;
  descripcionEspecie?: string;
  valorEstimadoTasacion?: number;
  fondoId: string;
  proyectoId?: string;
  cuentaBancariaId?: string;
  cuentaDestinoEspecieId?: string;
  comprobanteExternoNumero?: string;
  notas?: string;
}): Promise<EstadoAccionDonacion> {
  const usuario = await requerirUsuario();

  if (datos.monto <= 0) {
    return { ok: false, error: "El monto debe ser mayor a cero" };
  }

  if (datos.clase === "especie" && !datos.descripcionEspecie?.trim()) {
    return { ok: false, error: "Debe describir los bienes recibidos en especie" };
  }

  if (datos.clase === "efectivo" && !datos.cuentaBancariaId) {
    return { ok: false, error: "Debe seleccionar la cuenta bancaria de destino para donaciones en efectivo" };
  }

  const montoFinal = Number(datos.monto);
  const tasaFinal = datos.moneda === "USD" ? Number(datos.tasa ?? 60.0) : 1.0;
  const montoDop = datos.moneda === "USD" ? montoFinal * tasaFinal : montoFinal;

  try {
    const donacionId = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "registrar_donacion");

      // Buscar período contable abierto para la fecha
      const { rows: perRows } = await cliente.query<{ id: string }>(
        `SELECT id FROM contabilidad.periodo_contable
         WHERE $1 BETWEEN fecha_inicio AND fecha_fin AND estado = 'abierto'
         LIMIT 1`,
        [datos.fecha]
      );

      if (perRows.length === 0) {
        throw new Error("No hay un período contable abierto para la fecha indicada");
      }
      const periodoId = perRows[0].id;

      // Obtener siguiente número
      const { rows: secRows } = await cliente.query<{ num: string }>(
        `SELECT contabilidad.siguiente_numero('DON')::text AS num`
      );
      const numero = Number(secRows[0].num);

      // Crear asiento contable
      const { rows: numAsientoRows } = await cliente.query<{ siguiente: string }>(
        `SELECT contabilidad.siguiente_numero('AS')::text AS siguiente`
      );
      const numeroAsiento = Number(numAsientoRows[0].siguiente);

      const glosa = datos.clase === "efectivo"
        ? `Ingreso por donación en efectivo #${numero}`
        : `Recepción de donación en especie #${numero}: ${datos.descripcionEspecie}`;

      const { rows: asientoRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.asiento (
           numero, fecha, periodo_id, tipo, concepto, moneda, tasa, estado, creado_por
         ) VALUES ($1, $2, $3, 'manual', $4, $5, $6, 'cuadrado', $7)
         RETURNING id`,
        [numeroAsiento, datos.fecha, periodoId, glosa, datos.moneda, tasaFinal, usuario.id]
      );
      const asientoId = asientoRows[0].id;

      // Líneas del asiento contable
      if (datos.clase === "efectivo") {
        // Obtener cuenta contable del banco
        const { rows: bcoRows } = await cliente.query<{ cuenta_contable_id: string }>(
          `SELECT cuenta_contable_id FROM contabilidad.cuenta_bancaria WHERE id = $1`,
          [datos.cuentaBancariaId]
        );
        const ctaDebe = bcoRows[0]?.cuenta_contable_id;

        // Cuenta de ingreso por donación
        const codigoIngreso = datos.tratamiento === "gravado" ? "4.1.01.03" : "4.1.01.01";
        const { rows: ingRows } = await cliente.query<{ id: string }>(
          `SELECT id FROM contabilidad.cuenta_contable WHERE codigo = $1`,
          [codigoIngreso]
        );
        const ctaHaber = ingRows[0]?.id;

        if (ctaDebe && ctaHaber) {
          await cliente.query(
            `INSERT INTO contabilidad.asiento_linea (asiento_id, numero_linea, cuenta_id, descripcion, debe, haber)
             VALUES ($1, 1, $2, 'Entrada a banco donación', $3, 0),
                    ($1, 2, $4, 'Reconocimiento de donación', 0, $3)`,
            [asientoId, ctaDebe, montoDop, ctaHaber]
          );
        }
      } else {
        // En especie: Débito a cuenta de activo/suministro elegida o default
        let ctaDebe = datos.cuentaDestinoEspecieId;
        if (!ctaDebe) {
          const { rows: defRows } = await cliente.query<{ id: string }>(
            `SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2.01.01' LIMIT 1`
          );
          ctaDebe = defRows[0]?.id;
        }

        const { rows: espRows } = await cliente.query<{ id: string }>(
          `SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '4.1.01.02'`
        );
        const ctaHaber = espRows[0]?.id;

        if (ctaDebe && ctaHaber) {
          await cliente.query(
            `INSERT INTO contabilidad.asiento_linea (asiento_id, numero_linea, cuenta_id, descripcion, debe, haber)
             VALUES ($1, 1, $2, 'Activo/Bienes recibidos en especie', $3, 0),
                    ($1, 2, $4, 'Ingreso donación en especie', 0, $3)`,
            [asientoId, ctaDebe, montoDop, ctaHaber]
          );
        }
      }

      // Insertar registro de donación
      const { rows: donRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.donacion (
           numero, tercero_id, fecha, periodo_id, clase, tratamiento,
           moneda, tasa, monto, monto_dop, descripcion_especie,
           valor_estimado_tasacion, fondo_id, proyecto_id,
           cuenta_bancaria_id, asiento_id, comprobante_externo_numero,
           notas, estado, creado_por, confirmado_por, confirmado_en
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'confirmada', $19, $19, now())
         RETURNING id`,
        [
          numero,
          datos.terceroId,
          datos.fecha,
          periodoId,
          datos.clase,
          datos.tratamiento,
          datos.moneda,
          tasaFinal,
          montoFinal,
          montoDop,
          datos.descripcionEspecie?.trim() || null,
          datos.valorEstimadoTasacion || null,
          datos.fondoId,
          datos.proyectoId || null,
          datos.cuentaBancariaId || null,
          asientoId,
          datos.comprobanteExternoNumero?.trim() || null,
          datos.notas?.trim() || null,
          usuario.id,
        ]
      );

      return donRows[0].id;
    });

    revalidatePath("/contabilidad/donaciones");
    revalidatePath("/contabilidad/asientos");
    revalidatePath("/contabilidad/libros");
    return { ok: true, id: donacionId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al procesar la donación" };
  }
}

export async function crearPromesaDonacion(datos: {
  terceroId: string;
  montoTotal: number;
  moneda: "DOP" | "USD";
  frecuencia: "unica" | "mensual" | "trimestral" | "semestral" | "anual";
  cuotasCantidad: number;
  fechaInicio: string;
  fondoId: string;
  proyectoId?: string;
  notas?: string;
}): Promise<EstadoAccionDonacion> {
  const usuario = await requerirUsuario();

  if (datos.montoTotal <= 0) {
    return { ok: false, error: "El monto total debe ser positivo" };
  }

  const numCuotas = Math.max(1, Math.min(60, Number(datos.cuotasCantidad || 1)));
  const montoPorCuota = Number((datos.montoTotal / numCuotas).toFixed(2));

  try {
    const promesaId = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "crear_promesa_donacion");

      const { rows: secRows } = await cliente.query<{ num: string }>(
        `SELECT contabilidad.siguiente_numero('PRM')::text AS num`
      );
      const numero = Number(secRows[0].num);

      const { rows: promRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.promesa_donacion (
           numero, tercero_id, fecha_compromiso, monto_total, moneda,
           frecuencia, fondo_id, proyecto_id, notas, estado, creado_por
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activa', $10)
         RETURNING id`,
        [
          numero,
          datos.terceroId,
          datos.fechaInicio,
          datos.montoTotal,
          datos.moneda,
          datos.frecuencia,
          datos.fondoId,
          datos.proyectoId || null,
          datos.notas?.trim() || null,
          usuario.id,
        ]
      );
      const pId = promRows[0].id;

      // Generar calendario de cuotas
      const fechaBase = new Date(datos.fechaInicio);
      for (let i = 1; i <= numCuotas; i++) {
        const fechaCuota = new Date(fechaBase);
        if (datos.frecuencia === "mensual") {
          fechaCuota.setMonth(fechaBase.getMonth() + (i - 1));
        } else if (datos.frecuencia === "trimestral") {
          fechaCuota.setMonth(fechaBase.getMonth() + (i - 1) * 3);
        } else if (datos.frecuencia === "semestral") {
          fechaCuota.setMonth(fechaBase.getMonth() + (i - 1) * 6);
        } else if (datos.frecuencia === "anual") {
          fechaCuota.setFullYear(fechaBase.getFullYear() + (i - 1));
        }

        const fechaIso = fechaCuota.toISOString().slice(0, 10);

        await cliente.query(
          `INSERT INTO contabilidad.promesa_cuota (
             promesa_id, numero_cuota, fecha_vencimiento, monto, estado
           ) VALUES ($1, $2, $3, $4, 'pendiente')`,
          [pId, i, fechaIso, montoPorCuota]
        );
      }

      return pId;
    });

    revalidatePath("/contabilidad/donaciones");
    return { ok: true, id: promesaId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al crear promesa de donación" };
  }
}
