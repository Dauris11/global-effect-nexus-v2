/**
 * Adaptador "generico": sirve para cualquier banco cuyo estado de cuenta se
 * pueda describir con columnas, y es la salida de respaldo de la nómina
 * mientras un banco no entregue su layout oficial.
 */

import {
  centavosATexto,
  montoACentavos,
  parsearEstadoCuentaCsv,
  type AdaptadorBanco,
  type LineaPagoNomina,
} from "./adaptador";

const CABECERA_NOMINA = ["cedula", "nombre", "cuenta", "monto", "referencia"] as const;

function escaparCampo(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * CSV de pago de nómina con las columnas mínimas que piden los bancos.
 * Valida cada monto antes de escribirlo: un archivo de pago con un monto mal
 * formado mueve dinero real, así que es mejor fallar aquí que en el banco.
 */
export function construirCsvNomina(lineas: LineaPagoNomina[]): string {
  const filas = lineas.map((linea, posicion) => {
    const centavos = montoACentavos(linea.monto, ".");
    if (centavos === null || centavos <= 0n) {
      throw new Error(`Línea de nómina ${posicion + 1}: monto inválido "${linea.monto}"`);
    }
    return [linea.cedula, linea.nombre, linea.cuenta, centavosATexto(centavos), linea.referencia]
      .map((campo) => escaparCampo(campo.trim()))
      .join(",");
  });
  // CRLF porque los portales bancarios y Excel lo esperan en Windows.
  return [CABECERA_NOMINA.join(","), ...filas].join("\r\n") + "\r\n";
}

export const adaptadorGenerico: AdaptadorBanco = {
  clave: "generico",
  nombre: "Genérico (CSV)",
  formatosSoportados: ["csv"],
  parsearEstadoCuenta: parsearEstadoCuentaCsv,
  generarArchivoNomina(lineas) {
    return { nombreArchivo: "pago-nomina-generico.csv", contenido: construirCsvNomina(lineas), oficial: false };
  },
};
