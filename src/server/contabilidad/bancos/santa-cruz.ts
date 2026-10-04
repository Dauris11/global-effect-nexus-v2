/**
 * Adaptador de Banco Múltiple Santa Cruz.
 *
 * El banco no publica el formato de su estado de cuenta ni el del archivo de
 * pago de nómina (spec §4.6), y un layout inventado podría pagar a la cuenta
 * equivocada. Por eso, hasta tenerlo por escrito, este adaptador usa el lector
 * por columnas configurables y produce el CSV genérico marcado como no oficial.
 *
 * TODO: Formato oficial pendiente: pedir al banco el layout del servicio de
 * pago de nómina y del estado de cuenta.
 */

import { parsearEstadoCuentaCsv, type AdaptadorBanco } from "./adaptador";
import { construirCsvNomina } from "./generico";

export const adaptadorSantaCruz: AdaptadorBanco = {
  clave: "santa-cruz",
  nombre: "Banco Múltiple Santa Cruz",
  formatosSoportados: ["csv"],
  parsearEstadoCuenta: parsearEstadoCuentaCsv,
  generarArchivoNomina(lineas) {
    return { nombreArchivo: "pago-nomina-santa-cruz.csv", contenido: construirCsvNomina(lineas), oficial: false };
  },
};
