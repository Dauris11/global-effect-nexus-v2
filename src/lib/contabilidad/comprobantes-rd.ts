/**
 * Tipos oficiales de comprobantes fiscales (NCF y e-CF) de República Dominicana (DGII)
 * y utilidades de formateo de secuencias.
 */

export type TipoComprobanteRd = {
  codigo: string;
  nombre: string;
  /** Dígitos de la secuencia numérica tras el prefijo (8 para serie B, 10 para serie E). */
  digitos: number;
};

export const COMPROBANTES_RD: readonly TipoComprobanteRd[] = [
  { codigo: "B01", nombre: "Factura de Crédito Fiscal", digitos: 8 },
  { codigo: "B02", nombre: "Factura de Consumo", digitos: 8 },
  { codigo: "B03", nombre: "Nota de Débito", digitos: 8 },
  { codigo: "B04", nombre: "Nota de Crédito", digitos: 8 },
  { codigo: "B11", nombre: "Comprobante de Compras", digitos: 8 },
  { codigo: "B12", nombre: "Registro Único de Ingresos", digitos: 8 },
  { codigo: "B13", nombre: "Comprobante para Gastos Menores", digitos: 8 },
  { codigo: "B14", nombre: "Comprobante de Regímenes Especiales", digitos: 8 },
  { codigo: "B15", nombre: "Comprobante Gubernamental", digitos: 8 },
  { codigo: "B16", nombre: "Comprobante para Exportaciones", digitos: 8 },
  { codigo: "B17", nombre: "Comprobante para Pagos al Exterior", digitos: 8 },
  { codigo: "E31", nombre: "Factura de Crédito Fiscal Electrónica", digitos: 10 },
  { codigo: "E32", nombre: "Factura de Consumo Electrónica", digitos: 10 },
  { codigo: "E33", nombre: "Nota de Débito Electrónica", digitos: 10 },
  { codigo: "E34", nombre: "Nota de Crédito Electrónica", digitos: 10 },
  { codigo: "E41", nombre: "Compras Electrónico", digitos: 10 },
  { codigo: "E43", nombre: "Gastos Menores Electrónico", digitos: 10 },
  { codigo: "E44", nombre: "Regímenes Especiales Electrónico", digitos: 10 },
  { codigo: "E45", nombre: "Gubernamental Electrónico", digitos: 10 },
  { codigo: "E46", nombre: "Exportaciones Electrónico", digitos: 10 },
  { codigo: "E47", nombre: "Pagos al Exterior Electrónico", digitos: 10 },
] as const;

export function esTipoComprobanteRd(codigo: string): boolean {
  return COMPROBANTES_RD.some((c) => c.codigo === codigo);
}

export function etiquetaComprobanteRd(codigo: string): string {
  const encontrado = COMPROBANTES_RD.find((c) => c.codigo === codigo);
  return encontrado ? `${encontrado.codigo} · ${encontrado.nombre}` : codigo;
}

export function formatearNumeroComprobante(tipo: string, secuencia: number): string {
  const encontrado = COMPROBANTES_RD.find((c) => c.codigo === tipo);
  const digitos = encontrado?.digitos ?? 8;
  return `${tipo}${String(secuencia).padStart(digitos, "0")}`;
}
