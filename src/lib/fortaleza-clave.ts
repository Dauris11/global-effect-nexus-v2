/** Mínimo de caracteres que exige la contraseña nueva (decisión de seguridad del rediseño del login). */
export const LARGO_MINIMO_CLAVE = 10;

export type RequisitosClave = {
  largo: boolean;
  mayusMinus: boolean;
  numero: boolean;
  simbolo: boolean;
};

export function requisitosDeClave(clave: string): RequisitosClave {
  return {
    largo: clave.length >= LARGO_MINIMO_CLAVE,
    mayusMinus: /\p{Lu}/u.test(clave) && /\p{Ll}/u.test(clave),
    numero: /\d/.test(clave),
    simbolo: /[^\p{L}\p{N}\s]/u.test(clave),
  };
}

/**
 * Fortaleza de 0 a 4 para el medidor. Es una guía, no el control: lo único que bloquea el
 * guardado es el largo mínimo. Sin el largo mínimo no pasa de 1, por mucho símbolo que lleve,
 * y una contraseña larga hecha de una sola letra repetida tampoco sube.
 */
export function fortalezaDeClave(clave: string): 0 | 1 | 2 | 3 | 4 {
  if (!clave) return 0;

  const r = requisitosDeClave(clave);
  const variedad = [r.mayusMinus, r.numero, r.simbolo].filter(Boolean).length;
  const distintos = new Set(clave).size;

  if (!r.largo) return clave.length >= 6 && variedad >= 2 ? 1 : 0;
  if (distintos < 4) return 1;

  const puntos = 1 + variedad + (clave.length >= 14 ? 1 : 0);

  return Math.min(4, Math.max(1, puntos - 1)) as 1 | 2 | 3 | 4;
}
