"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccionComo } from "@/lib/db";
import { esFechaIso, esUuid, montoValido, tasaValida } from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import { obtenerAdaptador, type ColumnasEstado } from "@/server/contabilidad/bancos";
import { claveDeTransaccion } from "@/lib/contabilidad/extracto";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe, estadoDeError, type EstadoErrorContable } from "@/server/contabilidad/sesion";

/**
 * Transferencias entre cuentas propias, tasa del día, estado de cuenta y
 * conciliación.
 *
 * Una transferencia mueve dinero en el acto (dos movimientos y un asiento),
 * por eso exige `aprobar` y no solo `registrar`. Conciliar exige
 * `conciliar`. La tasa es un dato de configuración del día y la registra
 * quien registra.
 */

export type EstadoBanco = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "datos_invalidos"
    | "monto_invalido"
    | "misma_cuenta"
    | "archivo_invalido"
    | "archivo_vacio"
    | "montos_distintos"
    | EstadoErrorContable;
  /** Error de lectura del CSV ("Línea 12: fecha inválida…"). Es dato, no texto de interfaz. */
  detalle?: string;
  id?: string;
  /** Subida del estado de cuenta: transacciones nuevas y las que ya estaban. */
  nuevas?: number;
  repetidas?: number;
};

function texto(datos: FormData, campo: string, maximo = 200): string {
  return String(datos.get(campo) ?? "").trim().slice(0, maximo);
}

export async function transferirEntreCuentas(
  _previo: EstadoBanco,
  datos: FormData,
): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.aprobar")) return { estado: "no_permitido" };

  const origen = texto(datos, "origen", 40);
  const destino = texto(datos, "destino", 40);
  const fecha = texto(datos, "fecha", 10);
  const concepto = texto(datos, "concepto");
  const montoOrigen = montoValido(texto(datos, "monto_origen", 20));
  const destinoTexto = texto(datos, "monto_destino", 20);
  // Vacío = lo mismo que salió (cuentas de la misma moneda).
  const montoDestino = destinoTexto ? montoValido(destinoTexto) : montoOrigen;

  if (!esUuid(origen) || !esUuid(destino) || !esFechaIso(fecha) || !concepto) {
    return { estado: "datos_invalidos" };
  }
  if (origen === destino) return { estado: "misma_cuenta" };
  if (!montoOrigen || !montoDestino) return { estado: "monto_invalido" };

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.transferir($1, $2, $3, $4, $5, $6, $7) AS id`,
        [origen, destino, fecha, montoOrigen, montoDestino, concepto, texto(datos, "referencia", 120) || null],
      );
      return rows[0].id;
    });
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/** Tasa DOP/USD de un día. Si ya hay una para esa fecha, se corrige. */
export async function registrarTasa(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const fecha = texto(datos, "fecha", 10);
  const compra = tasaValida(texto(datos, "compra", 20));
  const venta = tasaValida(texto(datos, "venta", 20));
  if (!esFechaIso(fecha) || !compra || !venta) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await cliente.query(
        `INSERT INTO contabilidad.tasa_cambio (fecha, compra, venta, fuente)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (fecha) DO UPDATE SET compra = EXCLUDED.compra, venta = EXCLUDED.venta,
                                           fuente = EXCLUDED.fuente`,
        [fecha, compra, venta, texto(datos, "fuente", 60) || "BCRD"],
      );
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/** Lee las columnas del formulario de subida; las precarga la configuración del banco. */
function columnasDe(datos: FormData): ColumnasEstado | null {
  const formato = texto(datos, "formato_fecha", 12);
  const columnas: ColumnasEstado = {
    fecha: texto(datos, "col_fecha", 60),
    descripcion: texto(datos, "col_descripcion", 60),
    referencia: texto(datos, "col_referencia", 60) || undefined,
    debito: texto(datos, "col_debito", 60) || undefined,
    credito: texto(datos, "col_credito", 60) || undefined,
    monto: texto(datos, "col_monto", 60) || undefined,
    saldo: texto(datos, "col_saldo", 60) || undefined,
    formatoFecha:
      formato === "YYYY-MM-DD" || formato === "MM/DD/YYYY" ? formato : "DD/MM/YYYY",
    separadorDecimal: texto(datos, "separador", 1) === "," ? "," : ".",
  };
  const completo = columnas.fecha && columnas.descripcion && (columnas.monto || columnas.debito || columnas.credito);
  return completo ? columnas : null;
}

/**
 * Sube el estado de cuenta (.csv) a la cuenta (Observaciones #1).
 *
 * Se puede subir cuantas veces haga falta, también archivos que se solapan:
 * cada transacción se reconoce por su referencia (`claveDeTransaccion`) y
 * la base ignora la que ya estaba (`ON CONFLICT DO NOTHING` sobre
 * `UNIQUE (cuenta_id, clave)`). La respuesta dice cuántas entraron y
 * cuántas se saltaron, para que el contable sepa que no se duplicó nada.
 * Dentro del mismo archivo también se descartan las repetidas.
 */
export async function subirEstadoBanco(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const archivo = datos.get("archivo");
  const columnas = columnasDe(datos);
  if (!esUuid(cuenta) || !columnas) return { estado: "datos_invalidos" };
  if (!(archivo instanceof File) || archivo.size === 0 || archivo.size > 5 * 1024 * 1024) {
    return { estado: "archivo_invalido" };
  }

  const banco = await consultarUna<{ adaptador: string }>(
    `SELECT b.adaptador FROM contabilidad.cuenta_bancaria cb
       JOIN contabilidad.banco b ON b.id = cb.banco_id
      WHERE cb.id = $1 AND cb.estado = 'activa'`,
    [cuenta],
  );
  if (!banco) return { estado: "datos_invalidos" };

  let movimientos;
  try {
    movimientos = obtenerAdaptador(banco.adaptador).parsearEstadoCuenta(await archivo.text(), columnas);
  } catch (error) {
    return { estado: "archivo_invalido", detalle: error instanceof Error ? error.message : undefined };
  }
  if (movimientos.length === 0) return { estado: "archivo_vacio" };

  const vistas = new Set<string>();
  const unicas = movimientos
    .map((m) => ({ ...m, clave: claveDeTransaccion(m) }))
    .filter((m) => (vistas.has(m.clave) ? false : (vistas.add(m.clave), true)));

  try {
    const nuevas = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      // Una sola sentencia con arreglos en vez de cien INSERT: la bitácora
      // igual escribe una fila por línea, pero el viaje a la base es uno.
      const { rowCount } = await cliente.query(
        `INSERT INTO contabilidad.extracto_linea
           (cuenta_id, fecha, descripcion, referencia, monto, saldo, clave, archivo_nombre, importado_por)
         SELECT $1, t.fecha, t.descripcion, t.referencia, t.monto, t.saldo, t.clave, $8, $9
           FROM unnest($2::date[], $3::text[], $4::text[], $5::numeric[], $6::numeric[], $7::text[])
                AS t(fecha, descripcion, referencia, monto, saldo, clave)
         ON CONFLICT (cuenta_id, clave) DO NOTHING`,
        [
          cuenta,
          unicas.map((m) => m.fecha),
          unicas.map((m) => m.descripcion.slice(0, 300)),
          unicas.map((m) => m.referencia),
          unicas.map((m) => m.monto),
          unicas.map((m) => m.saldo),
          unicas.map((m) => m.clave),
          archivo.name.slice(0, 200),
          usuario.id,
        ],
      );
      return rowCount ?? 0;
    });
    refrescar();
    return { estado: "ok", nuevas, repetidas: movimientos.length - nuevas };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/**
 * Concilia una transacción del banco con una línea de asiento de la cuenta
 * auxiliar del banco. Se exige el MISMO monto con el mismo signo: si no
 * coinciden, no es la misma transacción y lo que falta es un ajuste.
 * Todo se vuelve a comprobar aquí, dentro de la transacción y con las filas
 * bloqueadas: la pantalla pudo quedarse vieja mientras otra persona
 * conciliaba la misma línea.
 */
export async function conciliarPartida(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const extracto = texto(datos, "extracto", 40);
  const linea = texto(datos, "linea", 40);
  if (!esUuid(cuenta) || !esUuid(extracto) || !esUuid(linea)) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "conciliar");
      const { rows } = await cliente.query<{ cuadra: boolean }>(
        `SELECT e.monto = (l.debe - l.haber) AS cuadra
           FROM contabilidad.extracto_linea e
           JOIN contabilidad.cuenta_bancaria cb ON cb.id = e.cuenta_id
           JOIN contabilidad.asiento_linea l ON l.id = $3 AND l.cuenta_id = cb.cuenta_contable_id
           JOIN contabilidad.asiento a ON a.id = l.asiento_id AND NOT a.anulado
          WHERE e.id = $2 AND e.cuenta_id = $1
            AND NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_partida p
                             WHERE p.anulado_en IS NULL
                               AND (p.extracto_linea_id = e.id OR p.asiento_linea_id = l.id))
            FOR UPDATE OF e, l`,
        [cuenta, extracto, linea],
      );
      if (!rows[0]) throw new RechazoBanco("datos_invalidos");
      if (!rows[0].cuadra) throw new RechazoBanco("montos_distintos");
      await cliente.query(
        `INSERT INTO contabilidad.conciliacion_partida
           (cuenta_id, extracto_linea_id, asiento_linea_id, conciliado_por)
         VALUES ($1, $2, $3, $4)`,
        [cuenta, extracto, linea, usuario.id],
      );
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    if (error instanceof RechazoBanco) return { estado: error.estado };
    return { estado: estadoDeError(error) };
  }
}

/** Anula una conciliación: las dos líneas vuelven a quedar por conciliar. */
export async function anularPartida(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  if (!esUuid(id)) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "anular");
      await cliente.query(
        `UPDATE contabilidad.conciliacion_partida
            SET anulado_en = now(), anulado_por = $2
          WHERE id = $1 AND anulado_en IS NULL`,
        [id, usuario.id],
      );
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/**
 * Vincula el banco con su cuenta contable auxiliar. Es configuración del
 * catálogo, así que pide `contabilidad.configurar`. No se permite cambiarla
 * con partidas conciliadas vivas: quedarían emparejadas con líneas de otra
 * cuenta.
 */
export async function vincularCuentaContable(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.configurar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const contable = texto(datos, "cuenta_contable", 40);
  if (!esUuid(cuenta) || !esUuid(contable)) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "editar");
      const { rowCount } = await cliente.query(
        `UPDATE contabilidad.cuenta_bancaria cb SET cuenta_contable_id = $2
          WHERE cb.id = $1
            AND EXISTS (SELECT 1 FROM contabilidad.cuenta_contable c
                         WHERE c.id = $2 AND c.tipo = 'activo' AND c.admite_movimiento AND c.activa)
            AND NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_partida p
                             WHERE p.cuenta_id = cb.id AND p.anulado_en IS NULL)`,
        [cuenta, contable],
      );
      if (!rowCount) throw new RechazoBanco("datos_invalidos");
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    if (error instanceof RechazoBanco) return { estado: error.estado };
    return { estado: estadoDeError(error) };
  }
}

class RechazoBanco extends Error {
  constructor(readonly estado: EstadoBanco["estado"]) {
    super(estado);
  }
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "layout");
  revalidatePath("/[locale]/portal/contabilidad", "page");
}
