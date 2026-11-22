import { createTranslator } from "next-intl";

import mensajes from "../../../messages/es.json";

/**
 * Traductor al español para los documentos. No usa `getTranslations`: ese necesita el
 * contexto de una pantalla, y un documento se genera en una ruta de descarga (y se prueba
 * fuera de Next). Los documentos van siempre en español, que es como los pide la Fundación.
 */
export function traducir(espacio: "records") {
  return createTranslator({ locale: "es", messages: mensajes, namespace: espacio });
}
