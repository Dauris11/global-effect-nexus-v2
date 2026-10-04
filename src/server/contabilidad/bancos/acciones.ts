"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccionComo } from "@/lib/db";
import { esFechaIso, esUuid, montoValido, tasaValida } from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import { obtenerAdaptador, type ColumnasEstado } from "@/server/contabilidad/bancos";
import { contextoDe, estadoDeError, type EstadoErrorContable } from "@/server/contabilidad/sesion";

/**
 * Transferencias entre cuentas propias, tasa del día y conciliación.
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
    | EstadoErrorContable;
  /** Error de lectura del CSV ("Línea 12: fecha inválida…"). Es dato, no texto de interfaz. */
  detalle?: string;
  id?: string;
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

/**
 * Importa el estado de cuenta (CSV) y abre la conciliación.
 *
 * El archivo se lee en el servidor con el adaptador del banco y las
 * columnas que confirmó el contable en el formulario. Las líneas se guardan
 * todas, en una transacción, y enseguida se pide a la base que proponga
 * emparejamientos: así la primera pantalla que ve el contable ya tiene el
 * trabajo hecho y solo le toca confirmar.
 */
export async function importarEstadoCuenta(
  _previo: EstadoBanco,
  datos: FormData,
): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const desde = texto(datos, "desde", 10);
  const hasta = texto(datos, "hasta", 10);
  const saldoTexto = texto(datos, "saldo_banco", 20).replace(/,/g, "");
  const archivo = datos.get("archivo");

  if (!esUuid(cuenta) || !esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) {
    return { estado: "datos_invalidos" };
  }
  // El saldo del banco puede ser negativo (sobregiro) o cero: no sirve
  // montoValido, que exige positivo.
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(saldoTexto)) return { estado: "monto_invalido" };
  if (!(archivo instanceof File) || archivo.size === 0 || archivo.size > 5 * 1024 * 1024) {
    return { estado: "archivo_invalido" };
  }

  const banco = await consultarUna<{ adaptador: string }>(
    `SELECT b.adaptador FROM contabilidad.cuenta_bancaria cb
       JOIN contabilidad.banco b ON b.id = cb.banco_id WHERE cb.id = $1`,
    [cuenta],
  );
  if (!banco) return { estado: "datos_invalidos" };

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
  if (!columnas.fecha || !columnas.descripcion || !(columnas.monto || columnas.debito || columnas.credito)) {
    return { estado: "datos_invalidos" };
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());
  let movimientos;
  try {
    movimientos = obtenerAdaptador(banco.adaptador).parsearEstadoCuenta(bytes.toString("utf8"), columnas);
  } catch (error) {
    return { estado: "archivo_invalido", detalle: error instanceof Error ? error.message : undefined };
  }
  const enRango = movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  if (enRango.length === 0) return { estado: "archivo_vacio" };

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.conciliacion
           (cuenta_id, desde, hasta, saldo_banco, archivo_nombre, archivo_sha256, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [cuenta, desde, hasta, saldoTexto, archivo.name.slice(0, 200),
         createHash("sha256").update(bytes).digest("hex"), usuario.id],
      );
      const conciliacion = rows[0].id;

      // Una sola sentencia con arreglos en vez de cien INSERT: la bitácora
      // igual escribe una fila por línea, pero el viaje a la base es uno.
      await cliente.query(
        `INSERT INTO contabilidad.conciliacion_linea
           (conciliacion_id, linea, fecha, descripcion, referencia, monto, saldo)
         SELECT $1, t.linea, t.fecha, t.descripcion, t.referencia, t.monto, t.saldo
           FROM unnest($2::int[], $3::date[], $4::text[], $5::text[], $6::numeric[], $7::numeric[])
                AS t(linea, fecha, descripcion, referencia, monto, saldo)`,
        [
          conciliacion,
          enRango.map((_, i) => i + 1),
          enRango.map((m) => m.fecha),
          enRango.map((m) => m.descripcion.slice(0, 300)),
          enRango.map((m) => m.referencia),
          enRango.map((m) => m.monto),
          enRango.map((m) => m.saldo),
        ],
      );
      await cliente.query(`SELECT contabilidad.proponer_emparejamientos($1)`, [conciliacion]);
      return conciliacion;
    });
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/**
 * Confirma o descarta la pareja propuesta de una línea. Descartar deja la
 * línea sin pareja (lo que el banco trae y los libros no).
 */
export async function decidirLinea(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const linea = texto(datos, "linea", 40);
  const confirmar = texto(datos, "decision", 12) === "confirmar";
  if (!esUuid(linea)) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await cliente.query(
        confirmar
          ? `UPDATE contabilidad.conciliacion_linea SET confirmada = true
              WHERE id = $1 AND movimiento_id IS NOT NULL`
          : `UPDATE contabilidad.conciliacion_linea SET confirmada = false, movimiento_id = NULL
              WHERE id = $1`,
        [linea],
      );
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/** Confirma de una vez todas las propuestas pendientes de la conciliación. */
export async function confirmarTodas(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  return operarConciliacion(datos, `UPDATE contabilidad.conciliacion_linea SET confirmada = true
     WHERE conciliacion_id = $1 AND movimiento_id IS NOT NULL AND NOT confirmada`);
}

/** Vuelve a buscar parejas para las líneas que quedaron sin ninguna. */
export async function volverAProponer(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  return operarConciliacion(datos, `SELECT contabilidad.proponer_emparejamientos($1)`);
}

export async function cerrarConciliacion(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  return operarConciliacion(datos, `SELECT contabilidad.cerrar_conciliacion($1)`);
}

async function operarConciliacion(datos: FormData, sql: string): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  if (!esUuid(id)) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), (cliente) => cliente.query(sql, [id]));
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "layout");
  revalidatePath("/[locale]/portal/contabilidad", "page");
}
