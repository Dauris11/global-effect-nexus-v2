/**
 * Datos de la Fundación que la landing muestra tal cual (mapa, tarjeta de contacto, pie).
 *
 * Una sola fuente: si cambia la dirección o el horario, se cambia aquí y el
 * mapa, el botón de «Cómo llegar» y el pie se corrigen juntos.
 *
 * `provisional` sigue en `true` hasta que el cliente entregue la dirección, el
 * horario y las coordenadas reales: las coordenadas actuales son solo el centro
 * de La Vega. Mientras lo sea, la tarjeta lo avisa con una etiqueta, pero solo
 * fuera de producción, para que el visitante nunca vea el aviso interno.
 */
export const ENTIDAD = {
  nombre: "Fundación Global Effect",
  ciudad: "La Vega",
  pais: { es: "República Dominicana", en: "Dominican Republic" },
  latitud: 19.221,
  longitud: -70.529,
  /** Calle y número; `null` = pendiente del cliente. */
  direccion: null as string | null,
  /** Horario de atención; `null` = pendiente del cliente. */
  horario: null as { es: string; en: string } | null,
  correo: "info@globaleffect.org",
  provisional: true,
} as const;

export type Idioma = "es" | "en";
