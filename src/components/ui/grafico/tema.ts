import { AZUL, AZUL_MEDIO, AZUL_OSCURO, AZUL_SUAVE, NEUTRO, TINTA } from "@/lib/paleta";

/**
 * Tema común de todos los gráficos.
 *
 * Los colores son variables CSS y no hex: el acento es azul o negro a elección
 * de cada persona y se logra reasignando `--color-marca-*` en globals.css. Una
 * gráfica pintada con `#2096BA` se quedaría azul aunque el resto de la pantalla
 * pasara a negro; con `var(--color-marca-500)` el SVG sigue al resto.
 */
export const TONO = {
  suave: "var(--color-marca-300)",
  base: "var(--color-marca-500)",
  oscuro: "var(--color-marca-700)",
  tinta: "var(--tinta)",
  neutro: "var(--tinta-3)",
} as const;

/**
 * Serie categórica: la rampa de un solo acento y los grises, de más pesado a
 * más ligero. Cinco tonos; con más, dos vecinos se confunden.
 */
export const SERIE_GRAFICO = [TONO.oscuro, TONO.base, TONO.suave, TONO.neutro, TONO.tinta] as const;

/**
 * Los datos aún traen colores de `paleta.ts` (hex). Aquí se traducen al tono
 * equivalente para que sigan el acento elegido sin tocar a quien los produce.
 */
const EQUIVALENTE: Record<string, string> = {
  [AZUL.toLowerCase()]: TONO.base,
  [AZUL_MEDIO.toLowerCase()]: TONO.oscuro,
  [AZUL_OSCURO.toLowerCase()]: TONO.oscuro,
  [AZUL_SUAVE.toLowerCase()]: TONO.suave,
  [TINTA.toLowerCase()]: TONO.tinta,
  [NEUTRO.toLowerCase()]: TONO.neutro,
};

export function resolverColor(color: string | undefined, indice: number): string {
  if (!color) return SERIE_GRAFICO[indice % SERIE_GRAFICO.length];
  return EQUIVALENTE[color.toLowerCase()] ?? color;
}

/** Duración de la animación de entrada: suficiente para notarla, no para esperarla. */
export const DURACION_ENTRADA = 600;

/**
 * Globo de datos: el estilo de un popover de la norma (`rounded-control`,
 * `shadow-elevada`, borde `linea`). Es HTML y no SVG, así que usa variables CSS
 * y sigue al modo oscuro.
 */
export const GLOBO = {
  contentStyle: {
    borderRadius: "var(--radius-control)",
    border: "1px solid var(--linea)",
    background: "var(--card)",
    color: "var(--tinta)",
    fontSize: 13,
    padding: "8px 12px",
    boxShadow: "var(--shadow-elevada)",
  },
  labelStyle: { fontWeight: 600, color: "var(--tinta)", marginBottom: 2 },
  itemStyle: { padding: 0 },
  cursor: { fill: "var(--linea)", fillOpacity: 0.5 },
} as const;

/** Rejilla horizontal y discreta: se lee la altura sin cuadricular la tarjeta. */
export const REJILLA = {
  vertical: false,
  stroke: "var(--linea)",
  strokeDasharray: "3 3",
} as const;

export const EJE = { fontSize: 11, fill: "var(--tinta-3)" } as const;
export const LINEA_EJE = { stroke: "var(--linea)" } as const;

/** Acorta una etiqueta de eje para que no se gire ni se monte con la vecina. */
export function acortar(texto: string, maximo = 14): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}
