/**
 * RNC y cédula dominicanos: formato y dígito verificador (§4.4).
 *
 * Sin imports, para que `scripts/probar-identificacion.mjs` la cargue con
 * `node --test` tal cual. La usan el formulario (para avisar al escribir)
 * y la server action (para rechazar), con el mismo código.
 *
 *   · RNC de persona jurídica: 9 dígitos. Pesos 7 9 8 6 5 4 3 2 sobre los
 *     ocho primeros; resto = suma mod 11; dígito = 2 si el resto es 0,
 *     1 si es 1, y 11 − resto en los demás casos. Es el algoritmo que
 *     publica la DGII.
 *   · Cédula: 11 dígitos, Luhn con pesos 1 y 2 alternos sobre los diez
 *     primeros (cada producto de dos cifras se reduce sumando sus cifras).
 *
 * Hay cédulas viejas emitidas antes de que la JCE aplicara el verificador y
 * que no lo cumplen. Si aparece una, el contador la registra desde
 * Configuración con su soporte; aquí no se abre una lista de excepciones
 * que nadie podría auditar.
 */

export type TipoIdentificacion = "rnc" | "cedula";

/** Quita guiones y espacios: "131-12345-6" → "131123456". */
export function limpiarIdentificacion(valor: string): string {
  return valor.replace(/[\s-]/g, "");
}

export function rncValido(valor: string): boolean {
  const rnc = limpiarIdentificacion(valor);
  if (!/^[0-9]{9}$/.test(rnc)) return false;
  const pesos = [7, 9, 8, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((total, peso, i) => total + peso * Number(rnc[i]), 0);
  const resto = suma % 11;
  const digito = resto === 0 ? 2 : resto === 1 ? 1 : 11 - resto;
  return digito === Number(rnc[8]);
}

export function cedulaValida(valor: string): boolean {
  const cedula = limpiarIdentificacion(valor);
  if (!/^[0-9]{11}$/.test(cedula)) return false;
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    const producto = Number(cedula[i]) * (i % 2 === 0 ? 1 : 2);
    suma += producto > 9 ? producto - 9 : producto;
  }
  return (10 - (suma % 10)) % 10 === Number(cedula[10]);
}

/**
 * Valida según el tipo de proveedor: la persona jurídica se identifica
 * con RNC y la física con su cédula (que es también su RNC ante la DGII).
 */
export function identificacionValida(valor: string, tipo: "fisica" | "juridica"): boolean {
  return tipo === "juridica" ? rncValido(valor) : cedulaValida(valor);
}

/** "131123456" → "1-31-12345-6"; "00113918205" → "001-1391820-5". */
export function formatearIdentificacion(valor: string): string {
  const v = limpiarIdentificacion(valor);
  if (v.length === 9) return `${v[0]}-${v.slice(1, 3)}-${v.slice(3, 8)}-${v[8]}`;
  if (v.length === 11) return `${v.slice(0, 3)}-${v.slice(3, 10)}-${v[10]}`;
  return valor;
}

/**
 * NCF (B + tipo de 2 cifras + 8 de secuencia = 11) o e-CF (E + 2 + 10 = 13).
 * Lo mismo que el CHECK de la migración 0037.
 */
export function ncfValido(valor: string): boolean {
  return /^B[0-9]{10}$/.test(valor) || /^E[0-9]{12}$/.test(valor);
}
