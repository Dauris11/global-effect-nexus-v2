import { consultarUna } from "@/lib/db";
import { vistaDeAsientoContabilizado } from "@/server/contabilidad/asientos/vista";
import { armarVista, type VistaAsiento } from "@/lib/contabilidad/vista-asiento";

/**
 * Busca el asiento que escribió un documento (recibo, transferencia, gasto de
 * caja, arqueo) por su origen. Si el documento se anuló, `revertir_asiento`
 * deja un segundo asiento con el mismo origen y número posterior; se toma el
 * primero, que es el original, para que «Asiento» muestre lo que se contabilizó.
 *
 * SEGURIDAD: no comprueba permisos; la acción que lo llama ya hizo
 * `requerirPermiso`.
 */
export async function asientoIdDeOrigen(origenTabla: string, origenId: string): Promise<string | null> {
  const fila = await consultarUna<{ id: string }>(
    `SELECT id FROM contabilidad.asiento
      WHERE origen_tabla = $1 AND origen_id = $2
      ORDER BY numero LIMIT 1`,
    [origenTabla, origenId],
  );
  return fila?.id ?? null;
}

/** Vista del asiento real de un documento, o una vista vacía si no generó asiento. */
export async function vistaDeAsientoDeOrigen(origenTabla: string, origenId: string): Promise<VistaAsiento> {
  const id = await asientoIdDeOrigen(origenTabla, origenId);
  if (!id) return armarVista([], [], { estado: "contabilizado" });
  return vistaDeAsientoContabilizado(id);
}
