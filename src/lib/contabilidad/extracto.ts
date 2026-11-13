/**
 * Clave con que se reconoce una transacción del estado de cuenta para no
 * guardarla dos veces (`extracto_linea.clave`, migración 0081).
 *
 * El departamento pidió verificar por la REFERENCIA del banco: al subir de
 * nuevo un .csv que se solapa con el anterior, lo ya subido se salta. La
 * referencia se compara sin espacios de más ni mayúsculas, porque el mismo
 * banco la exporta a veces "E2E-0001" y a veces "e2e-0001 ".
 *
 * Hay líneas sin referencia (comisiones, cargos del banco). Para esas la
 * clave es fecha + monto + descripción: dos comisiones iguales el mismo día
 * se tomarían por una, pero es preferible a duplicar todo el archivo cada
 * vez que se sube. Los prefijos impiden que una referencia coincida por
 * casualidad con una clave compuesta.
 */
export function claveDeTransaccion(linea: {
  fecha: string;
  monto: string;
  descripcion: string;
  referencia: string | null;
}): string {
  const referencia = linea.referencia?.trim().replace(/\s+/g, " ").toUpperCase();
  if (referencia) return `ref:${referencia}`;
  const descripcion = linea.descripcion.trim().replace(/\s+/g, " ").toUpperCase();
  return `sin:${linea.fecha}|${Number(linea.monto).toFixed(2)}|${descripcion}`;
}
