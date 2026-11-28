/** Correo al que la Fundación atiende los problemas de acceso al portal. */
export const CORREO_SOPORTE = "info@globaleffect.org";

/** `mailto:` con asunto ya codificado: el asunto sale traducido de quien lo llama. */
export function mailtoSoporte(asunto: string): string {
  return `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent(asunto)}`;
}
