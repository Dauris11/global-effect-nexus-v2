"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";

import { requerirPermiso } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import {
  CUENTA_CAJA_CHICA,
  CUENTA_FALTANTE_CAJA,
  CUENTA_SOBRANTE_CAJA,
  JUSTIFICACION_MINIMA,
  UMBRAL_ALERTA_DIFERENCIA,
  denominacionesDe,
  redondear,
  totalContado,
  type ErrorCaja,
  type ResultadoCaja,
} from "@/lib/contabilidad/cajas";
import { MAXIMO_ADJUNTO, TIPOS_ADJUNTO, esFechaIso, esUuid } from "@/lib/contabilidad/formato";
import { subirContable } from "@/lib/supabase/almacen";
import { fijarAccion } from "../bitacora";
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

async function idCuenta(cliente: PoolClient, codigo: string): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `SELECT id FROM contabilidad.cuenta_contable WHERE codigo = $1`,
    [codigo],
  );
  if (!rows[0]) throw new Rechazo("sin_cuenta_contable");
  return rows[0].id;
}

type CajaBloqueada = {
  id: string;
  nombre: string;
  moneda: "DOP" | "USD";
  fondo_fijo: string;
  saldo_actual: string;
  umbral_adjunto: string;
  estado: string;
  cuenta_id: string | null;
};

/** Bloquea la fila: dos gastos simultáneos no pueden gastar el mismo efectivo. */
async function bloquearCaja(cliente: PoolClient, cajaId: string): Promise<CajaBloqueada> {
  const { rows } = await cliente.query<CajaBloqueada>(
    `SELECT id, nombre, moneda, fondo_fijo, saldo_actual, umbral_adjunto, estado,
            COALESCE(cuenta_contable_id,
                     (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = $2)) AS cuenta_id
       FROM contabilidad.caja WHERE id = $1 FOR UPDATE`,
    [cajaId, CUENTA_CAJA_CHICA],
  );
  const caja = rows[0];
  if (!caja) throw new Rechazo("no_encontrada");
  if (caja.estado !== "activa") throw new Rechazo("inactiva");
  if (!caja.cuenta_id) throw new Rechazo("sin_cuenta_contable");
  return caja;
}

const texto = (datos: FormData, campo: string, maximo = 200): string =>
  String(datos.get(campo) ?? "").trim().slice(0, maximo);

// ---------------------------------------------------------------------------
// Alta de caja
// ---------------------------------------------------------------------------

export async function crearCajaAction(datos: {
  codigo: string;
  nombre: string;
  departamento: string;
  responsableId: string;
  moneda: "DOP" | "USD";
  fondoFijo: number;
  umbralAdjunto?: number;
}): Promise<ResultadoCaja> {
  const usuario = await requerirPermiso("contabilidad.configurar");

  if (
    !datos.codigo.trim() ||
    !datos.nombre.trim() ||
    !datos.departamento.trim() ||
    !esUuid(datos.responsableId) ||
    !(datos.fondoFijo > 0) ||
    !["DOP", "USD"].includes(datos.moneda)
  ) {
    return { exito: false, error: "datos_invalidos" };
  }

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const cuenta = await idCuenta(cliente, CUENTA_CAJA_CHICA);
      await fijarAccion(cliente, "crear");
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.caja
           (codigo, nombre, departamento, responsable_id, moneda, fondo_fijo, saldo_actual,
            umbral_adjunto, cuenta_contable_id, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9)
         RETURNING id`,
        [
          datos.codigo.trim().toUpperCase().slice(0, 30),
          datos.nombre.trim().slice(0, 120),
          datos.departamento.trim().slice(0, 80),
          datos.responsableId,
          datos.moneda,
          redondear(datos.fondoFijo),
          redondear(datos.umbralAdjunto ?? 500),
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

// ---------------------------------------------------------------------------
// Gastos y vales
// ---------------------------------------------------------------------------

/**
 * Gasto o vale de caja. Llega como FormData porque trae el comprobante: el
 * archivo se sube al bucket privado antes de abrir la transacción y la ruta
 * la arman ids, nunca el nombre que puso el usuario.
 */
export async function registrarMovimientoCajaAction(datos: FormData): Promise<ResultadoCaja> {
  const usuario = await requerirPermiso("contabilidad.registrar");

  const cajaId = texto(datos, "cajaId", 40);
  const tipo = texto(datos, "tipo", 10);
  const fecha = texto(datos, "fecha", 10);
  const monto = redondear(Number(texto(datos, "monto", 20)));
  const concepto = texto(datos, "concepto");
  const personaId = texto(datos, "personaId", 40) || null;
  const categoriaId = texto(datos, "categoriaId", 40) || null;
  const archivo = datos.get("adjunto");

  if (
    !esUuid(cajaId) ||
    (tipo !== "gasto" && tipo !== "vale") ||
    !esFechaIso(fecha) ||
    !(monto > 0) ||
    concepto.length < 3 ||
    (personaId !== null && !esUuid(personaId))
  ) {
    return { exito: false, error: "datos_invalidos" };
  }
  if (tipo === "gasto" && !esUuid(categoriaId)) return { exito: false, error: "falta_categoria" };
  // Un vale sin persona es dinero que salió sin que nadie responda por él.
  if (tipo === "vale" && !personaId) return { exito: false, error: "falta_persona" };

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
      if (Number(caja.saldo_actual) < monto) throw new Rechazo("saldo_insuficiente");
      if (tipo === "gasto" && monto >= Number(caja.umbral_adjunto) && !ruta) {
        throw new Rechazo("falta_adjunto");
      }

      let cuentaGasto: string | null = null;
      if (tipo === "gasto") {
        const { rows } = await cliente.query<{ cuenta_id: string | null }>(
          `SELECT cuenta_id FROM contabilidad.categoria WHERE id = $1 AND activa`,
          [categoriaId],
        );
        cuentaGasto = rows[0]?.cuenta_id ?? null;
        if (!cuentaGasto) throw new Rechazo("falta_categoria");
      }

      await fijarAccion(cliente, "crear");
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.caja_movimiento
           (numero, caja_id, fecha, periodo_id, tipo, monto, concepto, persona_id,
            adjunto_ruta, estado, creado_por)
         VALUES (contabilidad.siguiente_numero('CJ'), $1, $2, contabilidad.periodo_para($2::date),
                 $3, $4, $5, $6, $7, 'pendiente', $8)
         RETURNING id`,
        [cajaId, fecha, tipo, monto, concepto, personaId, ruta, usuario.id],
      );
      const movimientoId = rows[0].id;

      if (cuentaGasto) {
        await cliente.query(
          `SELECT contabilidad.crear_asiento($1::date, $2, 'automatico', 'caja_movimiento', $3, $4::jsonb)`,
          [
            fecha,
            `${caja.nombre}: ${concepto}`,
            movimientoId,
            JSON.stringify([
              { cuenta_id: cuentaGasto, debe: monto, descripcion: concepto },
              { cuenta_id: caja.cuenta_id, haber: monto, descripcion: caja.nombre },
            ]),
          ],
        );
      }

      await cliente.query(
        `UPDATE contabilidad.caja SET saldo_actual = saldo_actual - $1 WHERE id = $2`,
        [monto, cajaId],
      );
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
            JSON.stringify([
              { cuenta_id: cat[0].cuenta_id, debe: gastado, descripcion: vale.concepto },
              { cuenta_id: caja.cuenta_id, haber: gastado, descripcion: caja.nombre },
            ]),
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
        const faltante = diferencia < 0;
        const contra = await idCuenta(cliente, faltante ? CUENTA_FALTANTE_CAJA : CUENTA_SOBRANTE_CAJA);
        const monto = Math.abs(diferencia);
        await cliente.query(
          `SELECT contabilidad.crear_asiento($1::date, $2, 'ajuste', 'arqueo', $3, $4::jsonb)`,
          [
            arqueo.fecha,
            `AR-${arqueo.numero} ${caja.nombre}`,
            arqueoId,
            JSON.stringify(
              faltante
                ? [
                    { cuenta_id: contra, debe: monto },
                    { cuenta_id: caja.cuenta_id, haber: monto },
                  ]
                : [
                    { cuenta_id: caja.cuenta_id, debe: monto },
                    { cuenta_id: contra, haber: monto },
                  ],
            ),
          ],
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
