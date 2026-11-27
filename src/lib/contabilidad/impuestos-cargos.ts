/**
 * Tipos y constantes compartidos para Parámetros legales:
 *   · Impuestos y Cargos (contabilidad.impuesto_cargo)
 *   · Reglas legales (contabilidad.regla_legal)
 */

export const TIPOS_VALOR_CARGO = ["fijo", "variable"] as const;
export type TipoValorCargo = (typeof TIPOS_VALOR_CARGO)[number];

export const FORMATOS_VALOR_CARGO = ["numero", "porcentaje"] as const;
export type FormatoValorCargo = (typeof FORMATOS_VALOR_CARGO)[number];

export const PROPOSITOS_CARGO = ["transferencia", "nomina"] as const;
export type PropositoCargo = (typeof PROPOSITOS_CARGO)[number];

export type ImpuestoCargo = {
  id: string;
  nombre: string;
  tipoValor: TipoValorCargo;
  formatoValor: FormatoValorCargo | null;
  valor: string | null;
  proposito: PropositoCargo;
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  activo: boolean;
};

export type ReglaLegal = {
  id: string;
  nombre: string;
  valor: string | null;
  descripcion: string | null;
  activo: boolean;
};

export function esTipoValorCargo(v: string): v is TipoValorCargo {
  return (TIPOS_VALOR_CARGO as readonly string[]).includes(v);
}

export function esFormatoValorCargo(v: string): v is FormatoValorCargo {
  return (FORMATOS_VALOR_CARGO as readonly string[]).includes(v);
}

export function esPropositoCargo(v: string): v is PropositoCargo {
  return (PROPOSITOS_CARGO as readonly string[]).includes(v);
}
