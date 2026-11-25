import type { Partida } from "@/server/contabilidad/codigos-transaccion/asiento";

/**
 * Partidas del asiento de liberar un fondo restringido. Las comparten la
 * liberación real y la vista previa «Asiento». Vive aparte de `acciones.ts`
 * porque ese archivo es "use server".
 */
export function partidasDeLiberacion(nombreFondo: string, monto: number): Partida[] {
  return [
    // Débito: sale del patrimonio con restricción.
    { codigo: "FON_LIBERACION_RESTRINGIDO", monto, descripcion: `Liberación de restricción - ${nombreFondo}` },
    // Crédito: entra al patrimonio sin restricción, disponible para operar.
    { codigo: "FON_LIBERACION_OPERATIVO", monto, descripcion: `Fondo liberado para operaciones - ${nombreFondo}` },
  ];
}

export function conceptoDeLiberacion(nombreFondo: string, justificacion: string): string {
  return `Liberación de fondos restringidos: ${nombreFondo} (${justificacion})`;
}
