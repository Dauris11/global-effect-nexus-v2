/** Días sin visita a partir de los cuales un liceo pide atención. */
export const DIAS_SIN_VISITA = 30;

export type EstadoLiceo = "activa" | "por_vencer" | "pendiente";

/**
 * Estado de un liceo según su última visita: al día (< 30 días), sin visitar hace
 * un mes o más, o sin ninguna visita. `hoy` y `ultimaVisita` son claves
 * `YYYY-MM-DD` de La Vega; se restan como fechas UTC para que la zona del
 * proceso no corra el día.
 */
export function estadoDeLiceo(ultimaVisita: string | null, hoy: string): EstadoLiceo {
  if (!ultimaVisita) return "pendiente";
  const aMs = (clave: string) => {
    const [a, m, d] = clave.split("-").map(Number);

    return Date.UTC(a, m - 1, d);
  };
  const dias = Math.floor((aMs(hoy) - aMs(ultimaVisita)) / 86_400_000);

  return dias < DIAS_SIN_VISITA ? "activa" : "por_vencer";
}
