"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

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

  const fecha = datos.fecha || new Date().toISOString().slice(0, 10);

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

        // Buscar cuentas para liberación de fondos ASFL
        // 3.1.01.02 (Resultados Acumulados / Restringidos) y 3.1.01.01 (Operativo Liberado)
        const { rows: ctaRows } = await cliente.query<{ id: string; codigo: string }>(
          `SELECT id, codigo FROM contabilidad.cuenta_contable
            WHERE codigo IN ('3.1.01.02', '3.1.01.01')
            ORDER BY codigo ASC`
        );

        if (ctaRows.length >= 2) {
          const ctaRestringida = ctaRows.find((c) => c.codigo === "3.1.01.02")?.id ?? ctaRows[0].id;
          const ctaLiberada = ctaRows.find((c) => c.codigo === "3.1.01.01")?.id ?? ctaRows[1].id;

          const { rows: secRows } = await cliente.query<{ num: string }>(
            `SELECT contabilidad.siguiente_numero('AS')::text AS num`
          );
          const numAsiento = Number(secRows[0].num);

          const { rows: asRows } = await cliente.query<{ id: string }>(
            `INSERT INTO contabilidad.asiento (
               numero, fecha, periodo_id, concepto, tipo, creado_por
             ) VALUES ($1, $2, $3, $4, 'automatico', $5)
             RETURNING id`,
            [
              numAsiento,
              fecha,
              periodoId,
              `Liberación de fondos restringidos: ${f.nombre} (${justificacion})`,
              usuario.id,
            ]
          );
          asientoId = asRows[0].id;

          // Débito: Reclasificación Fondo Restringido
          await cliente.query(
            `INSERT INTO contabilidad.asiento_linea (
               asiento_id, cuenta_id, descripcion, debe, haber, fondo_id
             ) VALUES ($1, $2, $3, $4, 0, $5)`,
            [asientoId, ctaRestringida, `Liberación de restricción - ${f.nombre}`, monto, datos.fondoId]
          );

          // Crédito: Ingreso / Fondo Liberado para operaciones
          await cliente.query(
            `INSERT INTO contabilidad.asiento_linea (
               asiento_id, cuenta_id, descripcion, debe, haber, fondo_id
             ) VALUES ($1, $2, $3, 0, $4, $5)`,
            [asientoId, ctaLiberada, `Fondo liberado para operaciones - ${f.nombre}`, monto, datos.fondoId]
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
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Error al liberar fondo restringido" };
  }
}
