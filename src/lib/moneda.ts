/**
 * Dólares con dos decimales.
 *
 * `en-US` fijo y no el idioma de la interfaz: el monto es en USD y el símbolo tiene
 * que ser el mismo en las dos versiones del sitio («US$ 250,00» y «$250.00» serían
 * la misma cifra escrita de dos formas).
 */
export function formatoUsd(valor: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(valor);
}
