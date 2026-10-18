"use server";

import { revalidatePath } from "next/cache";
import { enTransaccionComo, consultarUna } from "@/lib/db";
import { requerirRol, requerirUsuario } from "@/lib/auth";
import { contextoDe } from "../sesion";

export type ResultadoAccionCaja =
  | { exito: true; id?: string; mensaje?: string }
  | { exito: false; error: string };

export async function crearCajaAction(datos: {
  codigo: string;
  nombre: string;
  departamento: string;
  responsableId: string;
  moneda: "DOP" | "USD";
  fondoFijo: number;
  umbralAdjunto?: number;
}): Promise<ResultadoAccionCaja> {
  const usuario = await requerirRol(["contabilidad", "super_admin"]);
  const contexto = await contextoDe(usuario);

  if (!datos.codigo.trim() || !datos.nombre.trim() || !datos.departamento.trim()) {
    return { exito: false, error: "Todos los campos de identificación son obligatorios." };
  }

  if (datos.fondoFijo <= 0) {
    return { exito: false, error: "El fondo fijo debe ser mayor a cero." };
  }

  try {
    const id = await enTransaccionComo(contexto, async (cliente) => {
      const res = await cliente.query(
        `INSERT INTO contabilidad.caja
           (codigo, nombre, departamento, responsable_id, moneda, fondo_fijo, saldo_actual, umbral_adjunto, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8)
         RETURNING id`,
        [
          datos.codigo.trim().toUpperCase(),
          datos.nombre.trim(),
          datos.departamento.trim(),
          datos.responsableId,
          datos.moneda,
          datos.fondoFijo,
          datos.umbralAdjunto ?? 500.0,
          usuario.id,
        ],
      );
      return res.rows[0].id as string;
    });

    revalidatePath("/[locale]/(portal)/contabilidad/cajas", "layout");
    return { exito: true, id };
  } catch (err: unknown) {
    console.error("[cajas] error al crear caja:", err);
    return { exito: false, error: (err as Error).message || "No se pudo crear la caja." };
  }
}

export async function registrarMovimientoCajaAction(datos: {
  cajaId: string;
  fecha: string;
  tipo: "vale" | "gasto";
  monto: number;
  concepto: string;
  personaId?: string | null;
  adjuntoRuta?: string | null;
}): Promise<ResultadoAccionCaja> {
  const usuario = await requerirRol(["contabilidad", "super_admin"]);
  const contexto = await contextoDe(usuario);

  if (datos.monto <= 0) {
    return { exito: false, error: "El monto debe ser mayor a cero." };
  }

  if (!datos.concepto.trim()) {
    return { exito: false, error: "El concepto es obligatorio." };
  }

  try {
    const id = await enTransaccionComo(contexto, async (cliente) => {
      // 1. Obtener caja y verificar saldo
      const resCaja = await cliente.query(
        `SELECT id, saldo_actual, umbral_adjunto, estado FROM contabilidad.caja WHERE id = $1 FOR UPDATE`,
        [datos.cajaId],
      );
      if (resCaja.rows.length === 0) throw new Error("Caja no encontrada.");
      const caja = resCaja.rows[0];

      if (caja.estado !== "activa") throw new Error("La caja chica se encuentra inactiva.");

      const saldoActual = parseFloat(caja.saldo_actual);
      if (saldoActual < datos.monto) {
        throw new Error(
          `Saldo insuficiente en caja (disponible: RD$${saldoActual.toFixed(2)}, requerido: RD$${datos.monto.toFixed(2)}). Realice una reposición primero.`,
        );
      }

      // 2. Verificar adjunto obligatorio según umbral
      const umbral = parseFloat(caja.umbral_adjunto);
      if (datos.tipo === "gasto" && datos.monto >= umbral && !datos.adjuntoRuta) {
        throw new Error(
          `Gastos mayores o iguales a RD$${umbral.toFixed(2)} requieren adjunto de soporte obligatorio.`,
        );
      }

      // 3. Insertar movimiento
      const resPeriodo = await cliente.query(
        `SELECT contabilidad.periodo_para($1::date) AS periodo_id`,
        [datos.fecha],
      );
      const periodoId = resPeriodo.rows[0].periodo_id;

      const resMov = await cliente.query(
        `INSERT INTO contabilidad.caja_movimiento
           (numero, caja_id, fecha, periodo_id, tipo, monto, concepto, persona_id, adjunto_ruta, estado, creado_por)
         VALUES (contabilidad.siguiente_numero('CJ'), $1, $2, $3, $4, $5, $6, $7, $8, 'completado', $9)
         RETURNING id`,
        [
          datos.cajaId,
          datos.fecha,
          periodoId,
          datos.tipo,
          datos.monto,
          datos.concepto.trim(),
          datos.personaId ?? null,
          datos.adjuntoRuta ?? null,
          usuario.id,
        ],
      );

      // 4. Descontar saldo de la caja
      await cliente.query(
        `UPDATE contabilidad.caja SET saldo_actual = saldo_actual - $1 WHERE id = $2`,
        [datos.monto, datos.cajaId],
      );

      return resMov.rows[0].id as string;
    });

    revalidatePath("/[locale]/(portal)/contabilidad/cajas", "layout");
    return { exito: true, id };
  } catch (err: unknown) {
    console.error("[cajas] error al registrar movimiento:", err);
    return { exito: false, error: (err as Error).message || "Error al registrar el movimiento." };
  }
}

export async function realizarArqueoAction(datos: {
  cajaId: string;
  fecha: string;
  conteos: { denominacion: number; tipo: "billete" | "moneda"; cantidad: number }[];
  justificacion?: string;
}): Promise<ResultadoAccionCaja> {
  const usuario = await requerirRol(["contabilidad", "super_admin"]);
  const contexto = await contextoDe(usuario);

  try {
    const id = await enTransaccionComo(contexto, async (cliente) => {
      // 1. Obtener caja y saldo según sistema
      const resCaja = await cliente.query(
        `SELECT id, nombre, saldo_actual FROM contabilidad.caja WHERE id = $1 FOR UPDATE`,
        [datos.cajaId],
      );
      if (resCaja.rows.length === 0) throw new Error("Caja no encontrada.");
      const caja = resCaja.rows[0];
      const saldoSistema = parseFloat(caja.saldo_actual);

      // 2. Calcular saldo contado físico
      let saldoContado = 0;
      for (const c of datos.conteos) {
        if (c.cantidad > 0) {
          saldoContado += c.denominacion * c.cantidad;
        }
      }
      saldoContado = Math.round(saldoContado * 100) / 100;
      const diferencia = Math.round((saldoContado - saldoSistema) * 100) / 100;

      if (diferencia !== 0 && (!datos.justificacion || datos.justificacion.trim().length < 5)) {
        throw new Error(
          `Existe una diferencia de caja de RD$${diferencia.toFixed(2)}. Debe proveer una justificación de al menos 5 caracteres.`,
        );
      }

      // 3. Crear arqueo
      const resPeriodo = await cliente.query(
        `SELECT contabilidad.periodo_para($1::date) AS periodo_id`,
        [datos.fecha],
      );
      const periodoId = resPeriodo.rows[0].periodo_id;

      const resArqueo = await cliente.query(
        `INSERT INTO contabilidad.arqueo
           (numero, caja_id, fecha, periodo_id, saldo_sistema, saldo_contado, estado, justificacion, revisado_por, revisado_en, creado_por)
         VALUES (contabilidad.siguiente_numero('AR'), $1, $2, $3, $4, $5, 'cerrado', $6, $7, now(), $7)
         RETURNING id`,
        [
          datos.cajaId,
          datos.fecha,
          periodoId,
          saldoSistema,
          saldoContado,
          datos.justificacion?.trim() ?? null,
          usuario.id,
        ],
      );
      const arqueoId = resArqueo.rows[0].id as string;

      // 4. Guardar desglose de denominaciones
      for (const c of datos.conteos) {
        if (c.cantidad > 0) {
          await cliente.query(
            `INSERT INTO contabilidad.arqueo_denominacion
               (arqueo_id, denominacion, tipo, cantidad)
             VALUES ($1, $2, $3, $4)`,
            [arqueoId, c.denominacion, c.tipo, c.cantidad],
          );
        }
      }

      // 5. Vincular y cerrar los movimientos anteriores sin arqueo
      await cliente.query(
        `UPDATE contabilidad.caja_movimiento
            SET arqueo_id = $1
          WHERE caja_id = $2 AND arqueo_id IS NULL`,
        [arqueoId, datos.cajaId],
      );

      // 6. Alerta si hay diferencia significativa (umbral: más de RD$200 o USD$10)
      if (Math.abs(diferencia) >= 200) {
        await cliente.query(
          `INSERT INTO contabilidad.alerta
             (tipo, severidad, tabla, registro_id, detalle)
           VALUES ('diferencia_caja', 'alta', 'arqueo', $1, $2)`,
          [
            arqueoId,
            JSON.stringify({
              caja: caja.nombre,
              saldo_sistema: saldoSistema,
              saldo_contado: saldoContado,
              diferencia,
              justificacion: datos.justificacion,
            }),
          ],
        );
      }

      // 7. Ajustar saldo actual de la caja al saldo físico verificado
      await cliente.query(
        `UPDATE contabilidad.caja SET saldo_actual = $1 WHERE id = $2`,
        [saldoContado, datos.cajaId],
      );

      return arqueoId;
    });

    revalidatePath("/[locale]/(portal)/contabilidad/cajas", "layout");
    return { exito: true, id };
  } catch (err: unknown) {
    console.error("[cajas] error en arqueo:", err);
    return { exito: false, error: (err as Error).message || "Error al registrar el arqueo." };
  }
}

export async function reponerCajaDesdeBancoAction(datos: {
  cajaId: string;
  cuentaBancoId: string;
  monto: number;
  fecha: string;
  concepto: string;
}): Promise<ResultadoAccionCaja> {
  const usuario = await requerirRol(["contabilidad", "super_admin"]);
  const contexto = await contextoDe(usuario);

  if (datos.monto <= 0) {
    return { exito: false, error: "El monto debe ser mayor a cero." };
  }

  try {
    const id = await enTransaccionComo(contexto, async (cliente) => {
      const res = await cliente.query(
        `SELECT contabilidad.reponer_caja($1, $2, $3, $4::date, $5) AS mov_id`,
        [datos.cajaId, datos.cuentaBancoId, datos.monto, datos.fecha, datos.concepto.trim()],
      );
      return res.rows[0].mov_id as string;
    });

    revalidatePath("/[locale]/(portal)/contabilidad/cajas", "layout");
    revalidatePath("/[locale]/(portal)/contabilidad/bancos", "layout");
    return { exito: true, id };
  } catch (err: unknown) {
    console.error("[cajas] error en reposición de caja:", err);
    return { exito: false, error: (err as Error).message || "Error en reposición de caja." };
  }
}
