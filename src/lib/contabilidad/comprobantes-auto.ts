import { ncfValido, rncValido, cedulaValida, limpiarIdentificacion } from "@/lib/contabilidad/identificacion";

/**
 * Reglas puras de la bandeja de comprobantes: validar lo que trae el
 * comprobante y proponer cómo clasificarlo según lo que ya se decidió antes con
 * ese mismo proveedor. Sin base de datos aquí: así se prueban sin ella.
 */

export type Problema = "sin_rnc" | "rnc_invalido" | "sin_ncf" | "ncf_invalido";

/** Lo que se puede decir del comprobante con solo mirarlo. */
export function problemasDe(c: { rnc: string | null; ncf: string | null }): Problema[] {
  const problemas: Problema[] = [];

  if (!c.rnc?.trim()) {
    problemas.push("sin_rnc");
  } else {
    const limpio = limpiarIdentificacion(c.rnc);
    // El RNC de una persona física es su cédula (11 dígitos).
    if (!(rncValido(limpio) || cedulaValida(limpio))) problemas.push("rnc_invalido");
  }

  if (!c.ncf?.trim()) problemas.push("sin_ncf");
  else if (!ncfValido(c.ncf.trim().toUpperCase())) problemas.push("ncf_invalido");

  return problemas;
}

export type Clasificacion = {
  categoria: string | null;
  centroCostoId: string | null;
  fondoId: string | null;
};

export type DecisionPrevia = Clasificacion & { veces: number };

export type Sugerencia = Clasificacion & {
  /** 0–100. */
  confianza: number;
  /** Decisiones previas con este proveedor en las que se apoya. */
  basadoEn: number;
};

/**
 * La clasificación más repetida con ese proveedor, con su confianza.
 *
 * Confianza = veces que se eligió esa combinación ÷ (decisiones previas + 1).
 * El «+1» es a propósito: con una sola decisión previa la confianza es 50 %, no
 * 100 %. Una regla que se fía de un único caso no se ha ganado la confianza, y
 * con el umbral de autonomía en 90 % hacen falta nueve coincidencias seguidas.
 */
export function calcularSugerencia(historial: readonly DecisionPrevia[]): Sugerencia | null {
  const total = historial.reduce((suma, h) => suma + h.veces, 0);

  if (total === 0) return null;

  const mejor = historial.reduce((a, b) => (b.veces > a.veces ? b : a));

  // Sin ningún dato útil que proponer, no hay sugerencia que valga.
  if (!mejor.categoria && !mejor.centroCostoId && !mejor.fondoId) return null;

  return {
    categoria: mejor.categoria,
    centroCostoId: mejor.centroCostoId,
    fondoId: mejor.fondoId,
    confianza: Math.round((mejor.veces / (total + 1)) * 100),
    basadoEn: total,
  };
}

/** ¿Lo que quedó es lo que se había sugerido? Es la métrica de «sin corrección». */
export function coincide(a: Clasificacion, b: Clasificacion): boolean {
  return (
    (a.categoria ?? null) === (b.categoria ?? null) &&
    (a.centroCostoId ?? null) === (b.centroCostoId ?? null) &&
    (a.fondoId ?? null) === (b.fondoId ?? null)
  );
}
