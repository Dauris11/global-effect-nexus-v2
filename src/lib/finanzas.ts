/**
 * Vocabulario compartido de finanzas.
 *
 * Vive en `src/lib` por la razón de siempre en este proyecto: el formulario de
 * transacciones es un componente CLIENTE y necesita la lista de categorías.
 * Importar un valor desde `@/server/finanzas/consultas` arrastraría `pg` al
 * navegador (ver la cabecera de `src/lib/operaciones.ts`).
 *
 * Las dos listas replican lo que admite la base:
 *   · `tipo` es el ENUM `tipo_transaccion` de la migración 0011.
 *   · `categoria` es TEXT **sin CHECK**, con los valores que documenta esa
 *     misma migración en su comentario. Que la base no los imponga es
 *     justamente el motivo de escribirlos aquí una sola vez: si cada pantalla
 *     hiciera su propio desplegable, la primera errata crearía una categoría
 *     nueva que solo existe en una fila.
 */

export const TIPOS_MOVIMIENTO = ["ingreso", "egreso"] as const;

export type TipoTransaccion = (typeof TIPOS_MOVIMIENTO)[number];

/**
 * Las categorías del comentario de la 0011, en el orden en que se usan.
 *
 * `beca` y `donacion` son de entrada; `operativo`, `salario`, `material` y
 * `evento` de salida. No se separan en dos listas a propósito: una beca
 * devuelta es un egreso y un material revendido un ingreso, y partir la lista
 * obligaría a inventar categorías espejo para esos casos.
 */
export const CATEGORIAS = [
  "beca",
  "donacion",
  "operativo",
  "salario",
  "material",
  "evento",
  "otro",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export function esTipoTransaccion(valor: string): valor is TipoTransaccion {
  return (TIPOS_MOVIMIENTO as readonly string[]).includes(valor);
}

export function esCategoria(valor: string): valor is Categoria {
  return (CATEGORIAS as readonly string[]).includes(valor);
}

/**
 * Dinero en dólares, con sus dos decimales.
 *
 * `en-US` fijo y no el idioma de la interfaz: el monto es en dólares y el
 * símbolo tiene que ser el mismo en las dos versiones del sitio. Un
 * "US$ 250,00" en español y un "$250.00" en inglés serían la misma cifra
 * escrita de dos formas, y en una tabla de movimientos eso se lee como dos
 * monedas distintas.
 */
export function montoUsd(valor: number, decimales = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}
