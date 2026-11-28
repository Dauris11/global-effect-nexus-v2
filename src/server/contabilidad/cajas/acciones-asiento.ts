"use server";

import { requerirPermiso } from "@/lib/auth";
import { enTransaccion } from "@/lib/db";
import { esFechaIso, esUuid } from "@/lib/contabilidad/formato";
import { claveDia } from "@/lib/fechas";
import { armarVista, type VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { vistaDeLineasPorCodigo } from "@/server/contabilidad/asientos/vista";
import { vistaDeAsientoDeOrigen } from "@/server/contabilidad/tesoreria/asiento-origen";
import { lineasDeGastoCaja, partidasDeArqueo } from "./asiento";

/**
 * Opción «Asiento» de las cajas: antes de contabilizar muestra el asiento que
 * saldría (con el mismo armado que las acciones reales, ver `./asiento`) y
 * ya contabilizado muestra el que quedó en el libro.
 *
 * Ver un asiento es leer contabilidad, por eso `contabilidad.leer` y no el
 * permiso de registrar: un botón escondido no es control de acceso y quien
 * solo consulta debe poder validar un descuadre.
 */

/** Cuenta de la caja: la propia o, si no tiene, la del código CAJ_CAJA_CHICA. */
const CUENTA_DE_CAJA = `
  SELECT c.nombre, c.moneda,
         COALESCE(c.cuenta_contable_id,
                  (SELECT cuenta_id FROM contabilidad.codigo_transaccion WHERE codigo = 'CAJ_CAJA_CHICA'))
           AS cuenta_id
    FROM contabilidad.caja c WHERE c.id = $1`;

type CajaCuenta = { nombre: string; moneda: string; cuenta_id: string | null };

/** Asiento de un movimiento de caja: el suyo (gasto) o el del recibo (reposición). */
export async function asientoDeMovimientoCaja(movimientoId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(movimientoId)) return armarVista([], [], { estado: "contabilizado" });
  return enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<{ recibo_id: string | null }>(
      `SELECT recibo_id FROM contabilidad.caja_movimiento WHERE id = $1`,
      [movimientoId],
    );
    if (!rows[0]) return armarVista([], [], { estado: "contabilizado" });
    const propio = await vistaDeAsientoDeOrigen("caja_movimiento", movimientoId);
    if (propio.lineas.length || !rows[0].recibo_id) return propio;
    return vistaDeAsientoDeOrigen("recibo", rows[0].recibo_id);
  });
}

/** Vista previa de un gasto de caja que todavía no se registra. */
export async function asientoPreviaGastoCaja(datos: {
  cajaId: string;
  categoriaId: string | null;
  monto: number;
  concepto: string;
  fecha: string;
}): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(datos.cajaId)) return armarVista([], [], { estado: "previa" });
  return enTransaccion(async (cliente) => {
    const caja = (await cliente.query<CajaCuenta>(CUENTA_DE_CAJA, [datos.cajaId])).rows[0];
    if (!caja) return armarVista([], [], { estado: "previa" });
    const categoria = esUuid(datos.categoriaId)
      ? (
          await cliente.query<{ cuenta_id: string | null }>(
            `SELECT cuenta_id FROM contabilidad.categoria WHERE id = $1 AND activa`,
            [datos.categoriaId],
          )
        ).rows[0]
      : undefined;
    const monto = Number.isFinite(datos.monto) && datos.monto > 0 ? datos.monto : 0;
    const concepto = datos.concepto.trim().slice(0, 200);
    return vistaDeLineasPorCodigo(cliente, [], {
      descripcion: `${caja.nombre}: ${concepto}`,
      fecha: esFechaIso(datos.fecha) ? datos.fecha : undefined,
      lineasExtra: lineasDeGastoCaja({
        cuentaGasto: categoria?.cuenta_id ?? null,
        cuentaCaja: caja.cuenta_id,
        monto,
        concepto,
        nombreCaja: caja.nombre,
      }),
    });
  });
}

/**
 * Vista previa de la reposición desde banco: la caja entra por débito y el
 * banco elegido sale por crédito (el recibo de egreso lleva la caja como
 * contrapartida, ver `reponerCajaDesdeBancoAction`).
 */
export async function asientoPreviaReposicion(datos: {
  cajaId: string;
  cuentaBancoId: string;
  monto: number;
  concepto: string;
  fecha: string;
}): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(datos.cajaId)) return armarVista([], [], { estado: "previa" });
  return enTransaccion(async (cliente) => {
    const caja = (await cliente.query<CajaCuenta>(CUENTA_DE_CAJA, [datos.cajaId])).rows[0];
    if (!caja) return armarVista([], [], { estado: "previa" });
    const banco = esUuid(datos.cuentaBancoId)
      ? (
          await cliente.query<{ cuenta_contable_id: string | null }>(
            `SELECT cuenta_contable_id FROM contabilidad.cuenta_bancaria WHERE id = $1`,
            [datos.cuentaBancoId],
          )
        ).rows[0]
      : undefined;
    const monto = Number.isFinite(datos.monto) && datos.monto > 0 ? datos.monto : 0;
    const concepto = datos.concepto.trim().slice(0, 200);
    return vistaDeLineasPorCodigo(cliente, [], {
      descripcion: `CE ${concepto}`,
      fecha: esFechaIso(datos.fecha) ? datos.fecha : undefined,
      lineasExtra: [
        { cuenta_id: caja.cuenta_id, debe: monto, haber: 0, descripcion: "" },
        { cuenta_id: banco?.cuenta_contable_id ?? null, debe: 0, haber: monto, descripcion: "" },
      ],
    });
  });
}

/**
 * Asiento de un arqueo. Aprobado: el que quedó en el libro (si hubo
 * diferencia). Sin aprobar: el que generaría la diferencia, con el código de
 * faltante o sobrante y la cuenta de la caja.
 */
export async function asientoDeArqueo(arqueoId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(arqueoId)) return armarVista([], [], { estado: "contabilizado" });
  return enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<{
      estado: string;
      diferencia: string;
      caja_id: string;
      numero: string;
      fecha: string;
    }>(
      `SELECT estado, diferencia::text, caja_id, numero::text, to_char(fecha, 'YYYY-MM-DD') AS fecha
         FROM contabilidad.arqueo WHERE id = $1`,
      [arqueoId],
    );
    const arqueo = rows[0];
    if (!arqueo) return armarVista([], [], { estado: "previa" });
    if (arqueo.estado === "aprobado") return vistaDeAsientoDeOrigen("arqueo", arqueoId);

    const caja = (await cliente.query<CajaCuenta>(CUENTA_DE_CAJA, [arqueo.caja_id])).rows[0];
    const armado = partidasDeArqueo(Number(arqueo.diferencia), caja?.cuenta_id ?? null);
    const extras = { descripcion: `AR-${arqueo.numero} ${caja?.nombre ?? ""}`.trim(), fecha: arqueo.fecha };
    // Sin diferencia no hay asiento: la vista vacía lo dice mejor que un error.
    if (!armado) return armarVista([], [], { estado: "previa", ...extras });
    return vistaDeLineasPorCodigo(cliente, armado.partidas, { ...extras, lineasExtra: armado.lineasExtra });
  });
}

/**
 * Vista previa del asiento al crear una nueva caja:
 * cuenta contable de la caja en débito contra la cuenta contable del banco en crédito.
 */
export async function asientoPreviaCrearCaja(datos: {
  cuentaContableId: string;
  cuentaBancariaId: string;
  moneda: "DOP" | "USD";
  fondo: number;
  numero: string;
  tipo: "caja_chica" | "caja";
}): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const hoy = claveDia();
  const fondo = Number.isFinite(datos.fondo) && datos.fondo > 0 ? Math.round(datos.fondo * 100) / 100 : 0;

  return enTransaccion(async (cliente) => {
    const banco = esUuid(datos.cuentaBancariaId)
      ? (
          await cliente.query<{ cuenta_contable_id: string | null; moneda: string }>(
            `SELECT cuenta_contable_id, moneda FROM contabilidad.cuenta_bancaria WHERE id = $1`,
            [datos.cuentaBancariaId],
          )
        ).rows[0]
      : undefined;

    let montoDop = fondo;
    if (datos.moneda === "USD" && fondo > 0) {
      const { rows: [tasaRow] } = await cliente.query<{ tasa: string | null }>(
        `SELECT contabilidad.tasa_referencia($1::date)::text AS tasa`,
        [hoy],
      );
      if (tasaRow?.tasa) {
        montoDop = Math.round(fondo * Number(tasaRow.tasa) * 100) / 100;
      }
    }

    const etiqueta = datos.tipo === "caja_chica" ? "Caja chica" : "Caja";
    const num = datos.numero.trim().toUpperCase();
    const descripcion = num ? `Apertura ${etiqueta} #${num}` : `Apertura ${etiqueta}`;

    return vistaDeLineasPorCodigo(cliente, [], {
      descripcion,
      fecha: hoy,
      lineasExtra: [
        {
          cuenta_id: esUuid(datos.cuentaContableId) ? datos.cuentaContableId : null,
          debe: montoDop,
          haber: 0,
          descripcion,
        },
        {
          cuenta_id: banco?.cuenta_contable_id ?? null,
          debe: 0,
          haber: montoDop,
          descripcion,
        },
      ],
    });
  });
}

/**
 * Vista previa del asiento al aumentar o disminuir el fondo de una caja:
 * aumento = débito Caja / crédito Banco; disminución = débito Banco / crédito Caja.
 */
export async function asientoPreviaAjusteFondo(datos: {
  cajaId: string;
  cuentaBancariaId: string;
  fondoNuevo: number;
}): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const hoy = claveDia();
  if (!esUuid(datos.cajaId)) return armarVista([], [], { estado: "previa" });

  return enTransaccion(async (cliente) => {
    const { rows: [caja] } = await cliente.query<{
      nombre: string;
      moneda: "DOP" | "USD";
      fondo_fijo: string;
      cuenta_id: string | null;
      cuenta_bancaria_id: string | null;
    }>(
      `SELECT c.nombre, c.moneda, c.fondo_fijo::text,
              COALESCE(c.cuenta_contable_id,
                       (SELECT cuenta_id FROM contabilidad.codigo_transaccion WHERE codigo = 'CAJ_CAJA_CHICA'))
                AS cuenta_id,
              c.cuenta_bancaria_id
         FROM contabilidad.caja c
        WHERE c.id = $1`,
      [datos.cajaId],
    );
    if (!caja) return armarVista([], [], { estado: "previa" });

    const delta = Math.round((datos.fondoNuevo - Number(caja.fondo_fijo)) * 100) / 100;
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.005) {
      return armarVista([], [], { estado: "previa" });
    }

    const bancoId = esUuid(datos.cuentaBancariaId) ? datos.cuentaBancariaId : caja.cuenta_bancaria_id;
    const banco = bancoId
      ? (
          await cliente.query<{ cuenta_contable_id: string | null }>(
            `SELECT cuenta_contable_id FROM contabilidad.cuenta_bancaria WHERE id = $1`,
            [bancoId],
          )
        ).rows[0]
      : undefined;

    let montoDop = Math.abs(delta);
    if (caja.moneda === "USD") {
      const { rows: [tasaRow] } = await cliente.query<{ tasa: string | null }>(
        `SELECT contabilidad.tasa_referencia($1::date)::text AS tasa`,
        [hoy],
      );
      if (tasaRow?.tasa) {
        montoDop = Math.round(Math.abs(delta) * Number(tasaRow.tasa) * 100) / 100;
      }
    }

    const aumento = delta > 0;
    const descripcion = aumento
      ? `Aumento de fondo · ${caja.nombre}`
      : `Disminución de fondo · ${caja.nombre}`;

    return vistaDeLineasPorCodigo(cliente, [], {
      descripcion,
      fecha: hoy,
      lineasExtra: aumento
        ? [
            { cuenta_id: caja.cuenta_id, debe: montoDop, haber: 0, descripcion },
            { cuenta_id: banco?.cuenta_contable_id ?? null, debe: 0, haber: montoDop, descripcion },
          ]
        : [
            { cuenta_id: banco?.cuenta_contable_id ?? null, debe: montoDop, haber: 0, descripcion },
            { cuenta_id: caja.cuenta_id, debe: 0, haber: montoDop, descripcion },
          ],
    });
  });
}
