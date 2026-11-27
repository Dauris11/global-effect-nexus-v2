"use server";

import { revalidatePath } from "next/cache";

import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccionComo } from "@/lib/db";
import { esFechaIso, esFormaPago, esUuid, montoValido, tasaValida } from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import type { VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { vistaDeAsientoContabilizado } from "@/server/contabilidad/asientos/vista";
import { errorDeCodigoSql, vistaPreviaDePagoCxp } from "@/server/contabilidad/proveedores/asiento";
import { contextoDe, estadoDeError, type EstadoErrorContable } from "@/server/contabilidad/sesion";

/**
 * Programar y pagar cuentas por pagar (§4.5).
 *
 * Programar es planificación (fecha prevista, cuenta de salida y, para lo
 * que vino de una solicitud, su categoría real): `registrar`. Pagar mueve
 * dinero: `aprobar`, y lo hace la función `pagar_cxp` de la 0037 en una
 * sola transacción.
 */

export type EstadoCxpAccion = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "datos_invalidos"
    | "monto_invalido"
    | "tasa_requerida"
    | "supera_saldo"
    | "moneda_distinta"
    | "no_admite"
    | "proveedor_codigo_sin_cuenta"
    | "proveedor_cuenta_no_valida"
    | EstadoErrorContable;
  id?: string;
  /** Nombre del código de transacción implicado (para el texto del error). */
  codigo?: string;
};

function texto(datos: FormData, campo: string, maximo = 200): string {
  return String(datos.get(campo) ?? "").trim().slice(0, maximo);
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "layout");
  revalidatePath("/[locale]/portal/contabilidad", "page");
}

export async function programarCxp(
  _previo: EstadoCxpAccion,
  datos: FormData,
): Promise<EstadoCxpAccion> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const fecha = texto(datos, "fecha", 10);
  const cuenta = texto(datos, "cuenta", 40);
  const categoria = texto(datos, "categoria", 40);
  const fondo = texto(datos, "fondo", 40);
  const proyecto = texto(datos, "proyecto", 40);
  if (!esUuid(id) || !esFechaIso(fecha) || !esUuid(cuenta) || (categoria && !esUuid(categoria)) || !esUuid(fondo)
      || (proyecto && !esUuid(proyecto))) {
    return { estado: "datos_invalidos" };
  }

  try {
    const ok = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rowCount } = await cliente.query(
        `UPDATE contabilidad.cuenta_por_pagar x
            SET fecha_programada = $2, cuenta_salida_id = $3,
                categoria_id = CASE
                  WHEN NULLIF($4, '') IS NOT NULL THEN $4::uuid
                  WHEN x.origen = 'factura' THEN NULL
                  ELSE x.categoria_id
                END,
                fondo_id = $5,
                proyecto_id = NULLIF($6, '')::uuid,
                estado = CASE WHEN estado = 'pendiente' THEN 'programada' ELSE estado END
          WHERE x.id = $1 AND x.estado IN ('pendiente', 'programada', 'pagada_parcial')
            AND (SELECT moneda FROM contabilidad.cuenta_bancaria WHERE id = $3) = x.moneda
            AND (NULLIF($4, '') IS NOT NULL OR x.origen = 'factura' OR x.categoria_id IS NOT NULL)`,
        [id, fecha, cuenta, categoria, fondo, proyecto],
      );
      return (rowCount ?? 0) > 0;
    });
    if (!ok) return { estado: "moneda_distinta" };
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

export async function pagarCxp(
  _previo: EstadoCxpAccion,
  datos: FormData,
): Promise<EstadoCxpAccion> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.aprobar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const cuenta = texto(datos, "cuenta", 40);
  const fecha = texto(datos, "fecha", 10);
  const forma = texto(datos, "forma_pago", 20);
  const monto = montoValido(texto(datos, "monto", 20));
  const moneda = texto(datos, "moneda", 3);
  const tasaTexto = texto(datos, "tasa", 20);
  if (!esUuid(id) || !esUuid(cuenta) || !esFechaIso(fecha) || !esFormaPago(forma)) {
    return { estado: "datos_invalidos" };
  }
  if (!monto) return { estado: "monto_invalido" };
  const tasa = moneda === "USD" ? tasaValida(tasaTexto) : null;
  if (moneda === "USD" && !tasa) return { estado: "tasa_requerida" };

  try {
    await enTransaccionComo(await contextoDe(usuario), (cliente) =>
      cliente.query(`SELECT contabilidad.pagar_cxp($1, $2, $3, $4, $5, $6, $7)`, [
        id, cuenta, fecha, monto, forma, texto(datos, "referencia", 120) || null, tasa,
      ]),
    );
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "";
    if (mensaje.includes("supera el saldo")) return { estado: "supera_saldo" };
    if (mensaje.includes("la cuenta de salida en")) return { estado: "moneda_distinta" };
    if (mensaje.includes("no admite pagos")) return { estado: "no_admite" };
    const deCodigo = await errorDeCodigoSql(error);
    if (deCodigo) return deCodigo;
    return { estado: estadoDeError(error) };
  }
}

/**
 * Opción «Asiento» del formulario de pago: el asiento que saldría con la cuenta
 * de salida, el monto y la tasa que la persona lleva escritos. No escribe nada.
 */
export async function asientoDePagoPrevio(
  id: string,
  cuenta: string,
  monto: string,
  tasa: string,
  formaPago = "transferencia",
): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const montoLimpio = montoValido(monto.trim());
  if (!esUuid(id) || !esUuid(cuenta) || !montoLimpio) throw new Error("Datos del pago no válidos.");
  const forma = esFormaPago(formaPago) ? formaPago : "transferencia";
  return vistaPreviaDePagoCxp(id, cuenta, montoLimpio, tasaValida(tasa.trim()), forma);
}

/** Opción «Asiento» de un pago ya hecho: el asiento real de su recibo de egreso. */
export async function asientoDePagoCxp(pagoId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(pagoId)) throw new Error("Pago no válido.");
  const pago = await consultarUna<{ asiento_id: string | null }>(
    `SELECT r.asiento_id FROM contabilidad.pago p JOIN contabilidad.recibo r ON r.id = p.recibo_id WHERE p.id = $1`,
    [pagoId],
  );
  if (!pago?.asiento_id) throw new Error("El pago no tiene asiento.");
  return vistaDeAsientoContabilizado(pago.asiento_id);
}
