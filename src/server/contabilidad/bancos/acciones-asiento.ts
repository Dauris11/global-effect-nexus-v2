"use server";

import { requerirPermiso } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { esFechaIso, esUuid, montoValido } from "@/lib/contabilidad/formato";
import { armarVista, type VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { vistaDeFuncionSql } from "@/server/contabilidad/asientos/vista-sql";
import { vistaDeAsientoDeOrigen } from "@/server/contabilidad/tesoreria/asiento-origen";

/**
 * Opción «Asiento» de bancos: la transferencia entre cuentas propias antes de
 * hacerla (misma función SQL que usa `transferir`, así que la diferencia
 * cambiaria sale por el código de ganancia o pérdida igual que al contabilizar)
 * y el asiento de un movimiento del libro de banco ya contabilizado.
 *
 * Ver un asiento es leer contabilidad: `contabilidad.leer`. Hacer la
 * transferencia sigue exigiendo `contabilidad.aprobar`.
 */

const texto = (datos: FormData, campo: string, maximo = 200): string =>
  String(datos.get(campo) ?? "").trim().slice(0, maximo);

/** Vista previa con lo que hay escrito en el formulario de transferencia. */
export async function asientoPreviaTransferencia(datos: FormData): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  const origen = texto(datos, "origen", 40);
  const destino = texto(datos, "destino", 40);
  const fecha = texto(datos, "fecha", 10);
  const montoOrigen = montoValido(texto(datos, "monto_origen", 20));
  const destinoTexto = texto(datos, "monto_destino", 20);
  // Vacío = lo mismo que salió (cuentas de la misma moneda), igual que al transferir.
  const montoDestino = destinoTexto ? montoValido(destinoTexto) : montoOrigen;
  const usarTarifa = datos.get("usar_tarifa") === "true" || datos.get("usar_tarifa") === "on";

  // Sin los datos mínimos no hay nada que calcular: la vista vacía lo muestra.
  if (!esUuid(origen) || !esUuid(destino) || origen === destino || !esFechaIso(fecha) || !montoOrigen || !montoDestino) {
    return armarVista([], [], { estado: "previa" });
  }
  return vistaDeFuncionSql(
    "contabilidad.lineas_transferencia",
    [origen, destino, fecha, montoOrigen, montoDestino, usarTarifa],
    { fecha, descripcion: texto(datos, "concepto") || undefined },
  );
}

/** Asiento de un movimiento del libro de banco (recibo o transferencia). */
export async function asientoDeMovimientoBancario(movimientoId: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(movimientoId)) return armarVista([], [], { estado: "contabilizado" });
  const mov = await consultarUna<{ origen_tabla: string | null; origen_id: string | null }>(
    `SELECT origen_tabla, origen_id FROM contabilidad.movimiento_bancario WHERE id = $1`,
    [movimientoId],
  );
  if (!mov?.origen_tabla || !mov.origen_id) return armarVista([], [], { estado: "contabilizado" });
  return vistaDeAsientoDeOrigen(mov.origen_tabla, mov.origen_id);
}
