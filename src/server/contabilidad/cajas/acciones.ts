"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";

import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import {
  JUSTIFICACION_MINIMA,
  UMBRAL_ALERTA_DIFERENCIA,
  denominacionesDe,
  redondear,
  totalContado,
  type ErrorCaja,
  type ResultadoCaja,
} from "@/lib/contabilidad/cajas";
import { formatearNumeroComprobante } from "@/lib/contabilidad/comprobantes-rd";
import { MAXIMO_ADJUNTO, TIPOS_ADJUNTO, esFechaIso, esUuid } from "@/lib/contabilidad/formato";
import { subirContable } from "@/lib/supabase/almacen";
import { construirLineasPorCodigo, ErrorCodigosTransaccion } from "@/server/contabilidad/codigos-transaccion/asiento";
import { fijarAccion } from "../bitacora";
import { aJsonDeAsiento, cuentaDeCajaPorDefecto, lineasDeGastoCaja, partidasDeArqueo } from "./asiento";
import { contextoDe, otrosConPermiso } from "../sesion";

/**
 * Acciones del cuadre de caja chica de fondo fijo (imprest).
 *
 * Reglas que sostienen el cuadre:
 *   · Cada gasto con comprobante se contabiliza al momento (gasto contra la
 *     cuenta de la caja) y queda "pendiente" de reposición.
 *   · Un vale es dinero fuera de la caja sin comprobante todavía: no tiene
 *     asiento hasta que se liquida.
 *   · La reposición sale del banco por lo gastado (caja contra banco) y marca
 *     repuestos los gastos pendientes; nunca deja la caja por encima del fondo.
 *   · El arqueo lo registra quien cuenta y lo aprueba otra persona; al
 *     aprobarse, la diferencia va a faltante o sobrante de caja con su asiento.
 *
 * Los errores vuelven como clave (`ErrorCaja`) para que la pantalla los diga
 * en el idioma de quien la usa.
 */

class Rechazo extends Error {
  constructor(readonly clave: ErrorCaja) {
    super(clave);
  }
}

function fallo(error: unknown): ResultadoCaja {
  if (error instanceof Rechazo) return { exito: false, error: error.clave };
  // Un código de transacción sin cuenta (p. ej. el sobrante de caja, que el
  // catálogo no trae) detiene el asiento; «Asiento» dice cuál falta.
  if (error instanceof ErrorCodigosTransaccion) return { exito: false, error: "codigo_sin_cuenta" };
  const mensaje = error instanceof Error ? error.message : String(error);
  if (mensaje.includes("período contable está cerrado")) return { exito: false, error: "periodo_cerrado" };
  if (mensaje.includes("caja_codigo_key")) return { exito: false, error: "codigo_repetido" };
  console.error("[cajas]", error);
  return { exito: false, error: "error" };
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad/cajas", "layout");
  revalidatePath("/[locale]/portal/contabilidad", "page");
}

type CajaBloqueada = {
  id: string;
  nombre: string;
  tipo: "caja_chica" | "caja";
  moneda: "DOP" | "USD";
  fondo_fijo: string;
  saldo_actual: string;
  umbral_adjunto: string;
  estado: string;
  desglose_configurado: boolean;
  supervisor_id: string | null;
  cuenta_id: string | null;
};

/** Bloquea la fila: dos gastos simultáneos no pueden gastar el mismo efectivo. */
async function bloquearCaja(
  cliente: PoolClient,
  cajaId: string,
): Promise<CajaBloqueada & { cuenta_id: string }> {
  const { rows } = await cliente.query<CajaBloqueada>(
    `SELECT id, nombre, tipo, moneda, fondo_fijo, saldo_actual, umbral_adjunto, estado,
            desglose_configurado, supervisor_id,
            COALESCE(cuenta_contable_id,
                     (SELECT cuenta_id FROM contabilidad.codigo_transaccion
                       WHERE codigo = 'CAJ_CAJA_CHICA')) AS cuenta_id
       FROM contabilidad.caja WHERE id = $1 FOR UPDATE`,
    [cajaId],
  );
  const caja = rows[0];
  if (!caja) throw new Rechazo("no_encontrada");
  if (caja.estado !== "activa") throw new Rechazo("inactiva");
  if (!caja.cuenta_id) throw new Rechazo("sin_cuenta_contable");
  return { ...caja, cuenta_id: caja.cuenta_id };
}

const texto = (datos: FormData, campo: string, maximo = 200): string =>
  String(datos.get(campo) ?? "").trim().slice(0, maximo);

// ---------------------------------------------------------------------------
// Alta de caja
// ---------------------------------------------------------------------------

export async function crearCajaAction(datos: {
  numero: string;
  responsableId: string;
  supervisorId: string;
  tipo: "caja_chica" | "caja";
  moneda: "DOP" | "USD";
  fondo: number;
}): Promise<ResultadoCaja> {
  const usuario = await requerirPermiso("contabilidad.configurar");

  const numeroLimpio = datos.numero.trim().toUpperCase().slice(0, 30);
  if (
    !numeroLimpio ||
    !esUuid(datos.responsableId) ||
    !esUuid(datos.supervisorId) ||
    (datos.tipo !== "caja_chica" && datos.tipo !== "caja") ||
    !(datos.fondo > 0) ||
    !["DOP", "USD"].includes(datos.moneda)
  ) {
    return { exito: false, error: "datos_invalidos" };
  }

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      let cuenta: string | null = null;
      if (datos.tipo === "caja") {
        const { rows: cg } = await cliente.query<{ id: string }>(
          `SELECT id
             FROM contabilidad.cuenta_contable
            WHERE codigo = '1.1.1.1' AND activa AND admite_movimiento
            LIMIT 1`,
        );
        cuenta = cg[0]?.id ?? null;
      }
      if (!cuenta) {
        cuenta = await cuentaDeCajaPorDefecto(cliente);
      }
      if (!cuenta) throw new Rechazo("sin_cuenta_contable");

      const nombreGenerado =
        datos.tipo === "caja_chica" ? `Caja chica #${numeroLimpio}` : `Caja #${numeroLimpio}`;
      const departamentoGenerado = datos.tipo === "caja_chica" ? "Caja chica" : "Caja";

      await fijarAccion(cliente, "crear");
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.caja
           (codigo, nombre, departamento, tipo, responsable_id, supervisor_id, moneda,
            fondo_fijo, saldo_actual, umbral_adjunto, cuenta_contable_id, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11)
         RETURNING id`,
        [
          numeroLimpio,
          nombreGenerado.slice(0, 120),
          departamentoGenerado,
          datos.tipo,
          datos.responsableId,
          datos.supervisorId,
          datos.moneda,
          redondear(datos.fondo),
          500,
          cuenta,
          usuario.id,
        ],
      );
      return rows[0].id;
    });
    refrescar();
    return { exito: true, id };
  } catch (error) {
    return fallo(error);
  }
}

/**
 * Configura una caja existente. Exclusivo del usuario configurado como supervisor.
 * Permite cambiar número, responsable, supervisor, moneda y fondo (nunca el tipo).
 */
export async function actualizarCajaAction(datos: {
  cajaId: string;
  numero: string;
  responsableId: string;
  supervisorId: string;
  moneda: "DOP" | "USD";
  fondo: number;
}): Promise<ResultadoCaja> {
  const usuario = await requerirUsuario();
  const numeroLimpio = datos.numero.trim().toUpperCase().slice(0, 30);

  if (
    !esUuid(datos.cajaId) ||
    !numeroLimpio ||
    !esUuid(datos.responsableId) ||
    !esUuid(datos.supervisorId) ||
    !(datos.fondo > 0) ||
    !["DOP", "USD"].includes(datos.moneda)
  ) {
    return { exito: false, error: "datos_invalidos" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = await cliente.query<{
        id: string;
        tipo: "caja_chica" | "caja";
        supervisor_id: string | null;
        fondo_fijo: string;
        saldo_actual: string;
      }>(
        `SELECT id, tipo, supervisor_id, fondo_fijo, saldo_actual
           FROM contabilidad.caja
          WHERE id = $1
          FOR UPDATE`,
        [datos.cajaId],
      );
      const caja = rows[0];
      if (!caja) throw new Rechazo("no_encontrada");
      if (caja.supervisor_id !== usuario.id) throw new Rechazo("solo_supervisor");

      const { rows: [movs] } = await cliente.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM contabilidad.caja_movimiento WHERE caja_id = $1`,
        [datos.cajaId],
      );
      const fondoNuevo = redondear(datos.fondo);
      const utilizado = Math.max(0, redondear(Number(caja.fondo_fijo) - Number(caja.saldo_actual)));
      const saldoNuevo = movs.n === 0 ? fondoNuevo : Math.max(0, redondear(fondoNuevo - utilizado));

      const nombreGenerado =
        caja.tipo === "caja_chica" ? `Caja chica #${numeroLimpio}` : `Caja #${numeroLimpio}`;

      await fijarAccion(cliente, "editar");
      await cliente.query(
        `UPDATE contabilidad.caja
            SET codigo = $2,
                nombre = $3,
                responsable_id = $4,
                supervisor_id = $5,
                moneda = $6,
                fondo_fijo = $7,
                saldo_actual = $8
          WHERE id = $1`,
        [
          datos.cajaId,
          numeroLimpio,
          nombreGenerado.slice(0, 120),
          datos.responsableId,
          datos.supervisorId,
          datos.moneda,
          fondoNuevo,
          saldoNuevo,
        ],
      );
    });
    refrescar();
    return { exito: true, id: datos.cajaId };
  } catch (error) {
    return fallo(error);
  }
}

/**
 * Guarda el desglose inicial/actual de efectivo de la caja por denominación.
 * Exclusivo del usuario configurado como supervisor; al guardarse habilita el
 * acceso a «Movimientos de caja».
 */
export async function guardarDesgloseCajaAction(datos: {
  cajaId: string;
  fondo?: number;
  conteos: { denominacion: number; cantidad: number }[];
}): Promise<ResultadoCaja> {
  const usuario = await requerirUsuario();
  if (!esUuid(datos.cajaId) || !Array.isArray(datos.conteos)) {
    return { exito: false, error: "datos_invalidos" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = await cliente.query<{
        id: string;
        moneda: "DOP" | "USD";
        fondo_fijo: string;
        supervisor_id: string | null;
      }>(
        `SELECT id, moneda, fondo_fijo, supervisor_id
           FROM contabilidad.caja
          WHERE id = $1
          FOR UPDATE`,
        [datos.cajaId],
      );
      const caja = rows[0];
      if (!caja) throw new Rechazo("no_encontrada");
      if (caja.supervisor_id !== usuario.id) throw new Rechazo("solo_supervisor");

      const permitidas = denominacionesDe(caja.moneda);
      const porValor = new Map(permitidas.map((d) => [d.valor, d.tipo]));
      const limpias = datos.conteos
        .filter((c) => porValor.has(Number(c.denominacion)))
        .map((c) => ({
          denominacion: Number(c.denominacion),
          tipo: porValor.get(Number(c.denominacion))!,
          cantidad: Math.max(0, Math.trunc(Number(c.cantidad) || 0)),
        }));

      const total = redondear(totalContado(limpias));
      const objetivo = redondear(datos.fondo && datos.fondo > 0 ? datos.fondo : Number(caja.fondo_fijo));
      if (!(total > 0) || Math.abs(total - objetivo) > 0.005) {
        throw new Rechazo("desglose_no_coincide");
      }

      await fijarAccion(cliente, "editar");
      await cliente.query(`DELETE FROM contabilidad.caja_desglose WHERE caja_id = $1`, [datos.cajaId]);

      for (const item of limpias) {
        await cliente.query(
          `INSERT INTO contabilidad.caja_desglose (caja_id, denominacion, tipo, cantidad)
           VALUES ($1, $2, $3, $4)`,
          [datos.cajaId, item.denominacion, item.tipo, item.cantidad],
        );
      }

      await cliente.query(
        `UPDATE contabilidad.caja
            SET desglose_configurado = true,
                fondo_fijo = $2,
                saldo_actual = CASE
                  WHEN EXISTS (SELECT 1 FROM contabilidad.caja_movimiento WHERE caja_id = $1)
                  THEN saldo_actual
                  ELSE $2
                END
          WHERE id = $1`,
        [datos.cajaId, objetivo],
      );
    });
    refrescar();
    return { exito: true, id: datos.cajaId };
  } catch (error) {
    return fallo(error);
  }
}

// ---------------------------------------------------------------------------
// Salidas de caja
// ---------------------------------------------------------------------------

/**
 * Registra una salida de caja chica con comprobante (B11 automático vigente o
 * comprobante de factura manual si se marca «Factura con comprobante»),
 * persona a quien fue entregado y desglose exacto del efectivo utilizado.
 */
export async function registrarMovimientoCajaAction(datos: FormData): Promise<ResultadoCaja> {
  const usuario = await requerirPermiso("contabilidad.registrar");

  const cajaId = texto(datos, "cajaId", 40);
  const fecha = texto(datos, "fecha", 10);
  const monto = redondear(Number(texto(datos, "monto", 20)));
  const concepto = texto(datos, "concepto");
  const entregadoA = texto(datos, "entregadoA", 160);
  const facturaConComprobante = texto(datos, "facturaConComprobante", 5) === "1";
  const comprobanteManual = texto(datos, "comprobante", 40).toUpperCase();
  const categoriaId = texto(datos, "categoriaId", 40) || null;
  const desgloseCrudo = String(datos.get("desglose") ?? "");
  const archivo = datos.get("adjunto");

  if (!esUuid(cajaId) || !esFechaIso(fecha) || !(monto > 0) || concepto.length < 2) {
    return { exito: false, error: "datos_invalidos" };
  }
  if (entregadoA.length < 2) return { exito: false, error: "entregado_requerido" };
  if (facturaConComprobante && !comprobanteManual) {
    return { exito: false, error: "comprobante_requerido" };
  }

  let conteosEntrada: { denominacion: number; cantidad: number }[] = [];
  try {
    const parsed = JSON.parse(desgloseCrudo);
    if (Array.isArray(parsed)) conteosEntrada = parsed;
  } catch {
    return { exito: false, error: "desglose_no_coincide" };
  }

  const hayArchivo = archivo instanceof File && archivo.size > 0;
  if (
    hayArchivo &&
    (archivo.size > MAXIMO_ADJUNTO || !(TIPOS_ADJUNTO as readonly string[]).includes(archivo.type))
  ) {
    return { exito: false, error: "archivo_invalido" };
  }

  try {
    let ruta: string | null = null;
    if (hayArchivo) {
      const extension = archivo.type === "application/pdf" ? "pdf" : archivo.type.split("/")[1];
      ruta = `${fecha.slice(0, 4)}/${fecha.slice(5, 7)}/cajas/${cajaId}/${randomUUID()}.${extension}`;
      const subida = await subirContable(ruta, archivo);
      if (!subida.ok) return { exito: false, error: "error" };
    }

    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const caja = await bloquearCaja(cliente, cajaId);
      if (!caja.desglose_configurado) throw new Rechazo("desglose_requerido");
      if (Number(caja.saldo_actual) < monto) throw new Rechazo("saldo_insuficiente");

      // Validar que el desglose del efectivo utilizado coincida exactamente con el monto.
      const permitidas = denominacionesDe(caja.moneda);
      const porValor = new Map(permitidas.map((d) => [d.valor, d.tipo]));
      const desgloseLimpio = conteosEntrada
        .filter((c) => porValor.has(Number(c.denominacion)))
        .map((c) => ({
          denominacion: Number(c.denominacion),
          tipo: porValor.get(Number(c.denominacion))!,
          cantidad: Math.max(0, Math.trunc(Number(c.cantidad) || 0)),
        }))
        .filter((c) => c.cantidad > 0);

      const totalDesglose = redondear(totalContado(desgloseLimpio));
      if (Math.abs(totalDesglose - monto) > 0.005) {
        throw new Rechazo("desglose_no_coincide");
      }

      // Resolver comprobante: manual si es factura con comprobante, o siguiente B11 vigente.
      let comprobanteNumero = comprobanteManual;
      let comprobanteSecuenciaId: string | null = null;

      if (!facturaConComprobante) {
        const { rows: [seq] } = await cliente.query<{
          id: string;
          desde: string;
          cantidad: number;
          usados: number;
        }>(
          `SELECT id, desde::text AS desde, cantidad::int AS cantidad, usados::int AS usados
             FROM contabilidad.comprobante_secuencia
            WHERE tipo = 'B11'
              AND vigente IS NOT FALSE
              AND usados < cantidad
            ORDER BY desde ASC, creado_en ASC
            LIMIT 1
            FOR UPDATE`,
        );
        if (!seq) throw new Rechazo("sin_comprobante_vigente");

        comprobanteSecuenciaId = seq.id;
        comprobanteNumero = formatearNumeroComprobante("B11", Number(seq.desde) + seq.usados);

        await cliente.query(
          `UPDATE contabilidad.comprobante_secuencia
              SET usados = usados + 1,
                  actualizado_por = $2,
                  actualizado_en = now()
            WHERE id = $1`,
          [seq.id, usuario.id],
        );
      }

      let cuentaGasto: string | null = null;
      if (categoriaId && esUuid(categoriaId)) {
        const { rows } = await cliente.query<{ cuenta_id: string | null }>(
          `SELECT cuenta_id FROM contabilidad.categoria WHERE id = $1 AND activa`,
          [categoriaId],
        );
        cuentaGasto = rows[0]?.cuenta_id ?? null;
      }

      await fijarAccion(cliente, "crear");
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.caja_movimiento
           (numero, caja_id, fecha, periodo_id, tipo, monto, concepto, entregado_a,
            factura_con_comprobante, comprobante_numero, comprobante_secuencia_id,
            desglose, adjunto_ruta, estado, creado_por)
         VALUES (contabilidad.siguiente_numero('CJ'), $1, $2, contabilidad.periodo_para($2::date),
                 'gasto', $3, $4, $5, $6, $7, $8, $9::jsonb, $10, 'pendiente', $11)
         RETURNING id`,
        [
          cajaId,
          fecha,
          monto,
          concepto,
          entregadoA,
          facturaConComprobante,
          comprobanteNumero,
          comprobanteSecuenciaId,
          JSON.stringify(desgloseLimpio),
          ruta,
          usuario.id,
        ],
      );
      const movimientoId = rows[0].id;

      if (cuentaGasto) {
        await cliente.query(
          `SELECT contabilidad.crear_asiento($1::date, $2, 'automatico', 'caja_movimiento', $3, $4::jsonb)`,
          [
            fecha,
            `${caja.nombre}: ${concepto}`,
            movimientoId,
            aJsonDeAsiento(
              lineasDeGastoCaja({
                cuentaGasto,
                cuentaCaja: caja.cuenta_id,
                monto,
                concepto,
                nombreCaja: caja.nombre,
              }),
            ),
          ],
        );
      }

      await cliente.query(
        `UPDATE contabilidad.caja SET saldo_actual = saldo_actual - $1 WHERE id = $2`,
        [monto, cajaId],
      );

      for (const item of desgloseLimpio) {
        await cliente.query(
          `UPDATE contabilidad.caja_desglose
              SET cantidad = GREATEST(0, cantidad - $3),
                  actualizado_en = now()
            WHERE caja_id = $1 AND denominacion = $2`,
          [cajaId, item.denominacion, item.cantidad],
        );
      }

      return movimientoId;
    });

    refrescar();
    return { exito: true, id };
  } catch (error) {
    return fallo(error);
  }
}

/**
 * Liquida un vale: lo gastado pasa a gasto con su asiento y lo que sobra
 * vuelve al efectivo. Gastado = 0 es una devolución completa.
 */
export async function liquidarValeAction(datos: {
  movimientoId: string;
  fecha: string;
  montoGastado: number;
  categoriaId?: string | null;
}): Promise<ResultadoCaja> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const gastado = redondear(datos.montoGastado);

  if (!esUuid(datos.movimientoId) || !esFechaIso(datos.fecha) || !(gastado >= 0)) {
    return { exito: false, error: "datos_invalidos" };
  }
  if (gastado > 0 && !esUuid(datos.categoriaId)) return { exito: false, error: "falta_categoria" };

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows: vales } = await cliente.query<{
        caja_id: string;
        monto: string;
        concepto: string;
        persona_id: string | null;
      }>(
        `SELECT caja_id, monto, concepto, persona_id FROM contabilidad.caja_movimiento
          WHERE id = $1 AND tipo = 'vale' AND estado = 'pendiente' FOR UPDATE`,
        [datos.movimientoId],
      );
      const vale = vales[0];
      if (!vale) throw new Rechazo("no_encontrada");
      if (gastado > Number(vale.monto)) throw new Rechazo("datos_invalidos");

      const caja = await bloquearCaja(cliente, vale.caja_id);
      await fijarAccion(cliente, "editar");
      await cliente.query(
        `UPDATE contabilidad.caja_movimiento SET estado = 'completado' WHERE id = $1`,
        [datos.movimientoId],
      );

      if (gastado > 0) {
        const { rows: cat } = await cliente.query<{ cuenta_id: string | null }>(
          `SELECT cuenta_id FROM contabilidad.categoria WHERE id = $1 AND activa`,
          [datos.categoriaId],
        );
        if (!cat[0]?.cuenta_id) throw new Rechazo("falta_categoria");

        await fijarAccion(cliente, "crear");
        const { rows } = await cliente.query<{ id: string }>(
          `INSERT INTO contabilidad.caja_movimiento
             (numero, caja_id, fecha, periodo_id, tipo, monto, concepto, persona_id,
              estado, creado_por)
           VALUES (contabilidad.siguiente_numero('CJ'), $1, $2, contabilidad.periodo_para($2::date),
                   'gasto', $3, $4, $5, 'pendiente', $6)
           RETURNING id`,
          [vale.caja_id, datos.fecha, gastado, vale.concepto, vale.persona_id, usuario.id],
        );
        await cliente.query(
          `SELECT contabilidad.crear_asiento($1::date, $2, 'automatico', 'caja_movimiento', $3, $4::jsonb)`,
          [
            datos.fecha,
            `${caja.nombre}: ${vale.concepto}`,
            rows[0].id,
            aJsonDeAsiento(
              lineasDeGastoCaja({
                cuentaGasto: cat[0].cuenta_id,
                cuentaCaja: caja.cuenta_id,
                monto: gastado,
                concepto: vale.concepto,
                nombreCaja: caja.nombre,
              }),
            ),
          ],
        );
      }

      const devuelto = redondear(Number(vale.monto) - gastado);
      if (devuelto > 0) {
        await cliente.query(
          `UPDATE contabilidad.caja SET saldo_actual = saldo_actual + $1 WHERE id = $2`,
          [devuelto, vale.caja_id],
        );
      }
      return datos.movimientoId;
    });

    refrescar();
    return { exito: true, id };
  } catch (error) {
    return fallo(error);
  }
}

// ---------------------------------------------------------------------------
// Arqueo: conteo y aprobación
// ---------------------------------------------------------------------------

/**
 * Registra el conteo físico. No toca el saldo ni la contabilidad: eso pasa al
 * aprobarlo, para que una sola persona no pueda contar y a la vez ajustar.
 */
export async function realizarArqueoAction(datos: {
  cajaId: string;
  fecha: string;
  conteos: { denominacion: number; cantidad: number }[];
  justificacion?: string;
}): Promise<ResultadoCaja> {
  const usuario = await requerirPermiso("contabilidad.registrar");

  if (!esUuid(datos.cajaId) || !esFechaIso(datos.fecha) || !Array.isArray(datos.conteos)) {
    return { exito: false, error: "datos_invalidos" };
  }

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const caja = await bloquearCaja(cliente, datos.cajaId);

      const { rows: abiertos } = await cliente.query(
        `SELECT 1 FROM contabilidad.arqueo
          WHERE caja_id = $1 AND estado IN ('abierto', 'cerrado') LIMIT 1`,
        [datos.cajaId],
      );
      if (abiertos.length > 0) throw new Rechazo("arqueo_pendiente");

      // Solo cuentan las denominaciones que existen para la moneda de la caja:
      // la lista viene del cliente y no se le cree.
      const validas = new Map(denominacionesDe(caja.moneda).map((d) => [d.valor, d.tipo]));
      const conteos = datos.conteos
        .filter((c) => validas.has(c.denominacion) && Number.isInteger(c.cantidad) && c.cantidad > 0)
        .map((c) => ({ ...c, tipo: validas.get(c.denominacion)! }));

      const saldoSistema = Number(caja.saldo_actual);
      const saldoContado = totalContado(conteos);
      const diferencia = redondear(saldoContado - saldoSistema);
      const justificacion = datos.justificacion?.trim().slice(0, 500) || null;

      if (diferencia !== 0 && (justificacion?.length ?? 0) < JUSTIFICACION_MINIMA) {
        throw new Rechazo("falta_justificacion");
      }

      await fijarAccion(cliente, "crear");
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.arqueo
           (numero, caja_id, fecha, periodo_id, saldo_sistema, saldo_contado, estado,
            justificacion, creado_por)
         VALUES (contabilidad.siguiente_numero('AR'), $1, $2, contabilidad.periodo_para($2::date),
                 $3, $4, 'cerrado', $5, $6)
         RETURNING id`,
        [datos.cajaId, datos.fecha, saldoSistema, saldoContado, justificacion, usuario.id],
      );
      const arqueoId = rows[0].id;

      for (const c of conteos) {
        await cliente.query(
          `INSERT INTO contabilidad.arqueo_denominacion (arqueo_id, denominacion, tipo, cantidad)
           VALUES ($1, $2, $3, $4)`,
          [arqueoId, c.denominacion, c.tipo, c.cantidad],
        );
      }

      if (Math.abs(diferencia) >= UMBRAL_ALERTA_DIFERENCIA) {
        await cliente.query(
          `INSERT INTO contabilidad.alerta (tipo, severidad, tabla, registro_id, detalle)
           VALUES ('diferencia_caja', 'alta', 'arqueo', $1, $2::jsonb)`,
          [
            arqueoId,
            JSON.stringify({
              caja: caja.nombre,
              saldo_sistema: saldoSistema,
              saldo_contado: saldoContado,
              diferencia,
              justificacion,
            }),
          ],
        );
      }
      return arqueoId;
    });

    refrescar();
    return { exito: true, id };
  } catch (error) {
    return fallo(error);
  }
}

/**
 * Aprobación del supervisor. Quien contó no aprueba, salvo que nadie más
 * tenga el permiso (misma salida que el resto del módulo, §2.2). La
 * diferencia se aplica sobre el saldo de ESTE momento y no se sustituye por lo
 * contado, para no borrar gastos registrados entre el conteo y la firma.
 */
export async function aprobarArqueoAction(arqueoId: string): Promise<ResultadoCaja> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  if (!esUuid(arqueoId)) return { exito: false, error: "datos_invalidos" };

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = await cliente.query<{
        caja_id: string;
        fecha: string;
        numero: string;
        diferencia: string;
        estado: string;
        creado_por: string;
      }>(
        `SELECT caja_id, to_char(fecha, 'YYYY-MM-DD') AS fecha, numero, diferencia, estado, creado_por
           FROM contabilidad.arqueo WHERE id = $1 FOR UPDATE`,
        [arqueoId],
      );
      const arqueo = rows[0];
      if (!arqueo) throw new Rechazo("no_encontrada");
      if (arqueo.estado === "aprobado") throw new Rechazo("ya_aprobado");
      if (
        arqueo.creado_por === usuario.id &&
        (await otrosConPermiso(usuario.id, "contabilidad.aprobar")) > 0
      ) {
        throw new Rechazo("mismo_usuario");
      }

      const caja = await bloquearCaja(cliente, arqueo.caja_id);
      const diferencia = Number(arqueo.diferencia);

      if (diferencia !== 0) {
        if (Number(caja.saldo_actual) + diferencia < 0) throw new Rechazo("saldo_insuficiente");
        // Faltante o sobrante salen de un código de transacción; la línea de la
        // caja es la cuenta de esa caja. Si el código no tiene cuenta, el motor
        // lanza y no se aprueba nada a medias.
        const armado = partidasDeArqueo(diferencia, caja.cuenta_id)!;
        const lineas = await construirLineasPorCodigo(cliente, armado.partidas, armado.lineasExtra);
        await cliente.query(
          `SELECT contabilidad.crear_asiento($1::date, $2, 'ajuste', 'arqueo', $3, $4::jsonb)`,
          [arqueo.fecha, `AR-${arqueo.numero} ${caja.nombre}`, arqueoId, aJsonDeAsiento(lineas)],
        );
        await cliente.query(
          `UPDATE contabilidad.caja SET saldo_actual = saldo_actual + $1 WHERE id = $2`,
          [diferencia, arqueo.caja_id],
        );
      }

      await fijarAccion(cliente, "aprobar");
      await cliente.query(
        `UPDATE contabilidad.arqueo
            SET estado = 'aprobado', revisado_por = $2, revisado_en = now()
          WHERE id = $1`,
        [arqueoId, usuario.id],
      );
      // Los movimientos hasta la fecha del arqueo quedan cubiertos por él.
      await cliente.query(
        `UPDATE contabilidad.caja_movimiento SET arqueo_id = $1
          WHERE caja_id = $2 AND arqueo_id IS NULL AND fecha <= $3::date`,
        [arqueoId, arqueo.caja_id, arqueo.fecha],
      );
      return arqueoId;
    });

    refrescar();
    return { exito: true, id };
  } catch (error) {
    return fallo(error);
  }
}

// ---------------------------------------------------------------------------
// Reposición del fondo
// ---------------------------------------------------------------------------

/**
 * Repone la caja desde banco. Se hace con un comprobante de egreso normal
 * (caja chica contra banco) para que la salida aparezca en el libro de banco
 * y en la conciliación como cualquier otro pago.
 */
export async function reponerCajaDesdeBancoAction(datos: {
  cajaId: string;
  cuentaBancoId: string;
  monto: number;
  fecha: string;
  concepto: string;
}): Promise<ResultadoCaja> {
  const usuario = await requerirPermiso("contabilidad.registrar");
  const monto = redondear(datos.monto);
  const concepto = datos.concepto.trim().slice(0, 200);

  if (
    !esUuid(datos.cajaId) ||
    !esUuid(datos.cuentaBancoId) ||
    !esFechaIso(datos.fecha) ||
    !(monto > 0) ||
    concepto.length < 3
  ) {
    return { exito: false, error: "datos_invalidos" };
  }

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const caja = await bloquearCaja(cliente, datos.cajaId);
      if (Number(caja.saldo_actual) + monto > Number(caja.fondo_fijo) + 0.001) {
        throw new Rechazo("excede_fondo");
      }

      const { rows: cuentas } = await cliente.query<{ moneda: string }>(
        `SELECT moneda FROM contabilidad.cuenta_bancaria WHERE id = $1 AND estado = 'activa'`,
        [datos.cuentaBancoId],
      );
      if (!cuentas[0]) throw new Rechazo("no_encontrada");
      if (cuentas[0].moneda !== caja.moneda) throw new Rechazo("moneda_distinta");

      // El recibo exige categoría y fondo; la cuenta real del débito la fija
      // cuenta_contrapartida_id (la caja), no la categoría.
      const { rows: ref } = await cliente.query<{ categoria: string | null; fondo: string | null }>(
        `SELECT (SELECT id FROM contabilidad.categoria
                  WHERE activa AND tipo IN ('egreso', 'ambos')
                  ORDER BY (nombre ILIKE 'caja chica') DESC, nombre LIMIT 1) AS categoria,
                (SELECT id FROM contabilidad.fondo
                  WHERE activo ORDER BY (codigo = 'FND-GENERAL') DESC NULLS LAST, creado_en
                  LIMIT 1) AS fondo`,
      );
      if (!ref[0]?.categoria || !ref[0]?.fondo) throw new Rechazo("sin_cuenta_contable");

      await fijarAccion(cliente, "crear");
      const { rows: recibo } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.recibo
           (tipo, numero, fecha, periodo_id, cuenta_bancaria_id, moneda, tasa, monto, concepto,
            categoria_id, fondo_id, beneficiario, forma_pago, cuenta_contrapartida_id, creado_por)
         VALUES ('egreso', contabilidad.siguiente_numero('CE'), $1, contabilidad.periodo_para($1::date),
                 $2, $3, 1, $4, $5, $6, $7, $8, 'transferencia', $9, $10)
         RETURNING id`,
        [
          datos.fecha,
          datos.cuentaBancoId,
          caja.moneda,
          monto,
          concepto,
          ref[0].categoria,
          ref[0].fondo,
          caja.nombre,
          caja.cuenta_id,
          usuario.id,
        ],
      );
      await fijarAccion(cliente, "aprobar");
      await cliente.query(`SELECT contabilidad.contabilizar_recibo($1)`, [recibo[0].id]);

      await fijarAccion(cliente, "crear");
      const { rows: mov } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.caja_movimiento
           (numero, caja_id, fecha, periodo_id, tipo, monto, concepto, recibo_id, estado, creado_por)
         VALUES (contabilidad.siguiente_numero('CJ'), $1, $2, contabilidad.periodo_para($2::date),
                 'reposicion', $3, $4, $5, 'completado', $6)
         RETURNING id`,
        [datos.cajaId, datos.fecha, monto, concepto, recibo[0].id, usuario.id],
      );

      await fijarAccion(cliente, "editar");
      await cliente.query(
        `UPDATE contabilidad.caja_movimiento SET estado = 'completado'
          WHERE caja_id = $1 AND tipo = 'gasto' AND estado = 'pendiente'`,
        [datos.cajaId],
      );
      await cliente.query(
        `UPDATE contabilidad.caja SET saldo_actual = saldo_actual + $1 WHERE id = $2`,
        [monto, datos.cajaId],
      );
      return mov[0].id;
    });

    refrescar();
    revalidatePath("/[locale]/contabilidad/bancos", "layout");
    return { exito: true, id };
  } catch (error) {
    return fallo(error);
  }
}
