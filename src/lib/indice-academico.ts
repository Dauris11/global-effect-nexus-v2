/**
 * Índice académico según las reglas de CADA universidad (columnas de
 * `universidad`: puntos por letra, retirada en el divisor, redondeo). No hay un
 * índice «de la Fundación»: cada institución lo calcula a su manera y el
 * sistema solo aplica lo que esté guardado en su fila.
 *
 * `R` es retirada: no suma puntos, y si la universidad lo pide sus créditos
 * entran en el divisor. Una letra sin regla (p. ej. `P` de seminario, que
 * trae 0 créditos) no pesa; si trae créditos se devuelve en `sinRegla` en vez
 * de adivinar su valor.
 */

export type ReglasIndice = {
  puntosPorLetra: Record<string, number>;
  retiradaCuentaEnDivisor: boolean;
  redondeo: "truncar" | "redondear";
};

export type Cursada = { creditos: number; resultado: string };

export type ResultadoIndice = {
  puntos: number;
  /** Créditos que pesan en el divisor (incluye retiradas si la regla lo pide). */
  creditosDivisor: number;
  /** Créditos efectivamente aprobados o calificados, sin retiradas. */
  creditosCursados: number;
  indice: number | null;
  sinRegla: string[];
};

export const RETIRADA = "R";

export function calcularIndice(cursadas: readonly Cursada[], reglas: ReglasIndice): ResultadoIndice {
  let puntos = 0;
  let divisor = 0;
  let cursados = 0;
  const sinRegla = new Set<string>();

  for (const c of cursadas) {
    const letra = c.resultado.trim().toUpperCase();

    if (letra === RETIRADA) {
      if (reglas.retiradaCuentaEnDivisor) divisor += c.creditos;
      continue;
    }

    const valor = reglas.puntosPorLetra[letra];

    if (valor === undefined) {
      if (c.creditos > 0) sinRegla.add(letra);
      continue;
    }

    puntos += valor * c.creditos;
    divisor += c.creditos;
    cursados += c.creditos;
  }

  if (divisor === 0) return { puntos, creditosDivisor: 0, creditosCursados: cursados, indice: null, sinRegla: [...sinRegla] };

  // Se trabaja en centésimas enteras: 746/209 = 3,5694… y truncar a 2 decimales
  // con `toFixed` redondearía a 3,57.
  const centesimas = (puntos * 100) / divisor;
  const redondeado = (reglas.redondeo === "truncar" ? Math.floor(centesimas + 1e-9) : Math.round(centesimas)) / 100;

  return { puntos, creditosDivisor: divisor, creditosCursados: cursados, indice: redondeado, sinRegla: [...sinRegla] };
}

/** Lee «A=4, B=3…» (texto de un formulario) como reglas; `null` si no es válido. */
export function leerPuntosPorLetra(texto: string): Record<string, number> | null {
  const mapa: Record<string, number> = {};

  for (const par of texto.split(/[,;\n]/)) {
    if (!par.trim()) continue;
    const m = /^\s*([A-Za-z][A-Za-z+\-]{0,2})\s*=\s*(\d(?:[.,]\d{1,2})?)\s*$/.exec(par);

    if (!m) return null;
    const valor = Number(m[2].replace(",", "."));

    if (valor > 10 || m[1].toUpperCase() === RETIRADA) return null;
    mapa[m[1].toUpperCase()] = valor;
  }

  return Object.keys(mapa).length > 0 ? mapa : null;
}

export function textoDePuntos(mapa: Record<string, number>): string {
  return Object.entries(mapa).map(([l, v]) => `${l}=${v}`).join(", ");
}
