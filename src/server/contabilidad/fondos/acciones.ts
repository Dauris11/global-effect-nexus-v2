"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion, enTransaccionComo } from "@/lib/db";
import { diaEnRD } from "@/lib/fechas";
import { armarVista, type VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";
import { construirLineasPorCodigo } from "@/server/contabilidad/codigos-transaccion/asiento";
import { vistaDeAsientoContabilizado, vistaDeLineasPorCodigo } from "@/server/contabilidad/asientos/vista";
import { conceptoDeLiberacion, partidasDeLiberacion } from "@/server/contabilidad/fondos/asiento";
import { textoDeErrorCodigos } from "@/server/contabilidad/patrimonio/errores";

export type EstadoAccionFondo = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function crearFondo(datos: {
  nombre: string;
  codigo?: string;
  descripcion?: string;
  tipoRestriccion: "no_restringido" | "temporalmente_restringido" | "permanentemente_restringido";
  donanteId?: string;
  propositoRestringido?: string;
  montoRestringidoOriginal?: number;
  fechaInicio?: string;
  fechaVencimientoRestriccion?: string;
}): Promise<EstadoAccionFondo> {
  const usuario = await requerirUsuario();

  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length < 3) {
    return { ok: false, error: "El nombre del fondo debe tener al menos 3 caracteres" };
  }

  const cod = datos.codigo?.trim().toUpperCase() || null;
  const montoOrig = Number(datos.montoRestringidoOriginal || 0);

  try {
    const id = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "crear_fondo");

      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.fondo (
           nombre, codigo, descripcion, tipo_restriccion, donante_id,
           proposito_restringido, monto_restringido_original,
           fecha_inicio, fecha_vencimiento_restriccion
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          nombre,
          cod,
          datos.descripcion?.trim() || null,
          datos.tipoRestriccion,
          datos.donanteId?.trim() || null,
          datos.propositoRestringido?.trim() || null,
          montoOrig,
          datos.fechaInicio || null,
          datos.fechaVencimientoRestriccion || null,
        ]
      );
      return rows[0].id;
    });

    revalidatePath("/contabilidad/fondos");
    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("fondo_nombre_key")) {
      return { ok: false, error: "Ya existe un fondo con ese nombre" };
    }
    if (msg.includes("fondo_codigo_key")) {
      return { ok: false, error: "Ya existe un fondo con ese código" };
    }
    return { ok: false, error: "Error al registrar fondo" };
  }
}

export async function liberarFondoRestringido(datos: {
  fondoId: string;
  monto: number;
  fecha?: string;
  documentoReferencia?: string;
  justificacion: string;
}): Promise<EstadoAccionFondo> {
  const usuario = await requerirUsuario();

  const monto = Number(datos.monto);
  if (isNaN(monto) || monto <= 0) {
    return { ok: false, error: "El monto a liberar debe ser mayor a 0" };
  }

  const justificacion = datos.justificacion.trim();
  if (!justificacion || justificacion.length < 5) {
    return { ok: false, error: "Debe proveer una justificación clara de la ejecución del gasto" };
  }

  const fecha = datos.fecha || diaEnRD();

  try {
    const id = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "liberar_fondo_restringido");

      // Consultar el fondo y su saldo restringido
      const { rows: fRows } = await cliente.query<{
        id: string;
        nombre: string;
        tipo_restriccion: string;
        monto_restringido_original: string;
        monto_liberado_acumulado: string;
      }>(
        `SELECT id, nombre, tipo_restriccion, monto_restringido_original, monto_liberado_acumulado
           FROM contabilidad.fondo
          WHERE id = $1`,
        [datos.fondoId]
      );

      if (fRows.length === 0) throw new Error("Fondo no encontrado");
      const f = fRows[0];

      if (f.tipo_restriccion === "no_restringido") {
        throw new Error("El fondo seleccionado es operativo no restringido");
      }

      const saldoDisponible = Number(f.monto_restringido_original) - Number(f.monto_liberado_acumulado);
      if (monto > saldoDisponible) {
        throw new Error(`El monto supera el saldo restringido disponible (RD$ ${saldoDisponible.toFixed(2)})`);
      }

      // `periodo_para` resuelve (o crea) el mes de la fecha; si ese mes está
      // cerrado la liberación se registra igual, pero sin asiento.
      const { rows: perRows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.periodo_para($1::date) AS id`,
        [fecha]
      );
      const periodoId = perRows[0].id;
      const { rows: estRows } = await cliente.query<{ estado: string }>(
        `SELECT estado FROM contabilidad.periodo_contable WHERE id = $1`,
        [periodoId]
      );

      let asientoId: string | null = null;
      if (estRows[0]?.estado === "abierto") {

        // Las cuentas y el lado salen de los códigos de liberación
        // (Configuración contable). Si falta alguna, el motor se detiene con
        // un mensaje claro en vez de omitir el asiento en silencio.
        const lineas = await construirLineasPorCodigo(cliente, partidasDeLiberacion(f.nombre, monto));

        const { rows: secRows } = await cliente.query<{ num: string }>(
          `SELECT contabilidad.siguiente_numero('AS')::text AS num`
        );
        const numAsiento = Number(secRows[0].num);

        const { rows: asRows } = await cliente.query<{ id: string }>(
          `INSERT INTO contabilidad.asiento (
             numero, fecha, periodo_id, concepto, tipo, creado_por
           ) VALUES ($1, $2, $3, $4, 'automatico', $5)
           RETURNING id`,
          [numAsiento, fecha, periodoId, conceptoDeLiberacion(f.nombre, justificacion), usuario.id]
        );
        asientoId = asRows[0].id;

        // Cada línea lleva el fondo para que el libro por fondo la encuentre.
        for (const l of lineas) {
          await cliente.query(
            `INSERT INTO contabilidad.asiento_linea (
               asiento_id, cuenta_id, descripcion, debe, haber, fondo_id
             ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [asientoId, l.cuenta_id, l.descripcion, l.debe, l.haber, datos.fondoId]
          );
        }
      }

      // Registrar liberación
      const { rows: libRows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.fondo_liberacion (
           fondo_id, monto_liberado, fecha_liberacion, asiento_id,
           documento_referencia, justificacion, creado_por
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          datos.fondoId,
          monto,
          fecha,
          asientoId,
          datos.documentoReferencia?.trim() || null,
          justificacion,
          usuario.id,
        ]
      );

      // Actualizar acumulado liberado en el fondo
      await cliente.query(
        `UPDATE contabilidad.fondo
            SET monto_liberado_acumulado = monto_liberado_acumulado + $1
          WHERE id = $2`,
        [monto, datos.fondoId]
      );

      return libRows[0].id;
    });

    revalidatePath("/contabilidad/fondos");
    revalidatePath("/contabilidad/asientos");
    return { ok: true, id };
  } catch (err: unknown) {
    const traducido = await textoDeErrorCodigos(err);
    if (traducido) return { ok: false, error: traducido };
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al liberar fondo restringido" };
  }
}

/**
 * Opción «Asiento» del diálogo de liberar un fondo: el asiento que saldría con
 * el monto escrito, sin escribir nada. Si el mes de la fecha está cerrado la
 * liberación se registra sin asiento y así se dice.
 */
export async function asientoPreviaLiberacion(datos: {
  fondoId: string;
  monto: number;
  fecha?: string;
}): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const fecha = datos.fecha || diaEnRD();
  const monto = Number.isFinite(datos.monto) && datos.monto > 0 ? datos.monto : 0;

  return enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<{ nombre: string }>(
      `SELECT nombre FROM contabilidad.fondo WHERE id = $1`,
      [datos.fondoId],
    );
    if (!rows[0]) throw new Error("Fondo no encontrado");

    // Solo se consulta: `periodo_para` crearía el mes, y una vista previa no escribe.
    const periodo = await cliente.query<{ estado: string }>(
      `SELECT estado FROM contabilidad.periodo_contable
        WHERE anio = EXTRACT(YEAR FROM $1::date)::int AND mes = EXTRACT(MONTH FROM $1::date)::int`,
      [fecha],
    );
    if (periodo.rows[0]?.estado === "cerrado") {
      const t = await getTranslations("contab.patrimonio.asiento");
      return armarVista([], [{ clave: "otro", detalle: t("liberacionPeriodoCerrado") }], { estado: "previa", fecha });
    }
    return vistaDeLineasPorCodigo(cliente, partidasDeLiberacion(rows[0].nombre, monto), { fecha });
  });
}

/** Opción «Asiento» de una liberación ya registrada. */
export async function asientoDeLiberacion(liberacionId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const fila = await consultarUna<{ asiento_id: string | null }>(
    `SELECT asiento_id FROM contabilidad.fondo_liberacion WHERE id = $1`,
    [liberacionId],
  );
  if (!fila?.asiento_id) throw new Error("La liberación no tiene asiento.");
  return vistaDeAsientoContabilizado(fila.asiento_id);
}
