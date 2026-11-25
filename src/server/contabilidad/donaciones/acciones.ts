"use server";

import { revalidatePath } from "next/cache";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion, enTransaccionComo } from "@/lib/db";
import type { VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";
import { construirLineasPorCodigo } from "@/server/contabilidad/codigos-transaccion/asiento";
import { vistaDeAsientoContabilizado, vistaDeLineasPorCodigo } from "@/server/contabilidad/asientos/vista";
import { armarAsientoDonacion } from "@/server/contabilidad/donaciones/asiento";
import { textoDeErrorCodigos } from "@/server/contabilidad/patrimonio/errores";

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

      // `periodo_para` crea el período si aún no existe; el estado se mira
      // aparte porque un mes cerrado no debe recibir donaciones nuevas.
      const { rows: perRows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.periodo_para($1::date) AS id`,
        [datos.fecha]
      );
      const periodoId = perRows[0].id;
      const { rows: estRows } = await cliente.query<{ estado: string }>(
        `SELECT estado FROM contabilidad.periodo_contable WHERE id = $1`,
        [periodoId]
      );
      if (estRows[0]?.estado !== "abierto") {
        throw new Error("No hay un período contable abierto para la fecha indicada");
      }

      // Obtener siguiente número
      const { rows: secRows } = await cliente.query<{ num: string }>(
        `SELECT contabilidad.siguiente_numero('DON')::text AS num`
      );
      const numero = Number(secRows[0].num);

      const glosa = datos.clase === "efectivo"
        ? `Ingreso por donación en efectivo #${numero}`
        : `Recepción de donación en especie #${numero}: ${datos.descripcionEspecie}`;

      // El asiento se lleva en pesos (`monto_dop`): la moneda original queda
      // en la donación, porque `asiento` no tiene moneda ni tasa. Las cuentas
      // de ingreso salen de los códigos de transacción (Configuración
      // contable); el banco es la elección de quien registra.
      let cuentaBancoContableId: string | null = null;
      if (datos.clase === "efectivo") {
        const { rows: bcoRows } = await cliente.query<{ cuenta_contable_id: string }>(
          `SELECT cuenta_contable_id FROM contabilidad.cuenta_bancaria WHERE id = $1`,
          [datos.cuentaBancariaId]
        );
        cuentaBancoContableId = bcoRows[0]?.cuenta_contable_id ?? null;
        if (!cuentaBancoContableId) {
          throw new Error("La cuenta bancaria elegida no tiene cuenta contable asignada");
        }
      }
      const { partidas, lineasExtra } = armarAsientoDonacion({
        clase: datos.clase,
        moneda: datos.moneda,
        montoDop,
        cuentaBancoContableId,
        cuentaDestinoEspecieId: datos.cuentaDestinoEspecieId,
      });
      const lineas = await construirLineasPorCodigo(
        cliente,
        partidas,
        lineasExtra.map((l) => ({ ...l, cuenta_id: l.cuenta_id as string })),
      );

      const { rows: asientoRows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.crear_asiento($1::date, $2, 'manual', NULL, NULL, $3::jsonb) AS id`,
        [datos.fecha, glosa, JSON.stringify(lineas)]
      );
      const asientoId = asientoRows[0].id;

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
    const traducido = await textoDeErrorCodigos(err);
    if (traducido) return { ok: false, error: traducido };
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

/**
 * Opción «Asiento» del diálogo de nueva donación: el asiento que saldría con
 * lo que hay en el formulario, sin escribir nada. Muestra qué código falta
 * (p. ej. el de especie) antes de que alguien pulse «Registrar».
 */
export async function asientoPreviaDonacion(datos: {
  clase: "efectivo" | "especie";
  moneda: "DOP" | "USD";
  tasa?: number;
  monto: number;
  fecha: string;
  cuentaBancariaId?: string;
  cuentaDestinoEspecieId?: string;
}): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const monto = Number.isFinite(datos.monto) && datos.monto > 0 ? datos.monto : 0;
  const tasa = datos.moneda === "USD" ? Number(datos.tasa ?? 60.0) : 1.0;
  const montoDop = datos.moneda === "USD" ? monto * tasa : monto;

  return enTransaccion(async (cliente) => {
    let cuentaBancoContableId: string | null = null;
    if (datos.clase === "efectivo" && datos.cuentaBancariaId) {
      const { rows } = await cliente.query<{ cuenta_contable_id: string | null }>(
        `SELECT cuenta_contable_id FROM contabilidad.cuenta_bancaria WHERE id = $1`,
        [datos.cuentaBancariaId],
      );
      cuentaBancoContableId = rows[0]?.cuenta_contable_id ?? null;
    }
    const { partidas, lineasExtra } = armarAsientoDonacion({
      clase: datos.clase,
      moneda: datos.moneda,
      montoDop,
      cuentaBancoContableId,
      cuentaDestinoEspecieId: datos.cuentaDestinoEspecieId,
    });
    return vistaDeLineasPorCodigo(cliente, partidas, { fecha: datos.fecha, lineasExtra });
  });
}

/** Opción «Asiento» de una donación ya registrada: el asiento tal como quedó en el libro. */
export async function asientoDeDonacion(donacionId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const fila = await consultarUna<{ asiento_id: string | null }>(
    `SELECT asiento_id FROM contabilidad.donacion WHERE id = $1`,
    [donacionId],
  );
  if (!fila?.asiento_id) throw new Error("La donación no tiene asiento.");
  return vistaDeAsientoContabilizado(fila.asiento_id);
}
