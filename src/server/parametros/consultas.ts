import { cache } from "react";

import { consultar } from "@/lib/db";
import {
  DEFECTOS,
  DEFINICIONES,
  definicionDe,
  validarParametro,
  type ClaveParametro,
  type ValoresParametros,
} from "@/lib/parametros";

/**
 * Los valores vigentes de los parámetros institucionales: lo guardado, o el valor
 * por defecto de `src/lib/parametros.ts` si no hay fila.
 *
 * Lo que está en la base se vuelve a validar al leer: una fila escrita a mano en
 * SQL con una hora imposible no tumba el comedor, simplemente no se usa y vale el
 * valor por defecto.
 *
 * `cache` de React: el layout, las pantallas y las acciones lo piden varias veces
 * en la misma petición y la base se consulta una vez.
 */
export const parametros = cache(async (): Promise<ValoresParametros> => {
  const filas = await consultar<{ clave: string; valor: string }>(
    "SELECT clave, valor FROM public.parametro_institucional",
  ).catch(() => []);

  const valores = { ...DEFECTOS };

  for (const fila of filas) {
    const def = definicionDe(fila.clave);

    if (!def) continue;

    const validado = validarParametro(def, fila.valor);

    if (validado.ok) valores[def.clave as ClaveParametro] = validado.valor;
  }

  return valores;
});

/** Para la pantalla de edición: valor vigente y si se aparta del valor por defecto. */
export async function parametrosParaEditar() {
  const [valores, filas] = await Promise.all([
    parametros(),
    consultar<{ clave: string; actualizado_en: Date; nombre: string | null }>(
      `SELECT p.clave, p.actualizado_en, u.nombre
         FROM public.parametro_institucional p
         LEFT JOIN public.usuario u ON u.id = p.actualizado_por`,
    ).catch(() => []),
  ]);

  return DEFINICIONES.map((def) => {
    const cambio = filas.find((f) => f.clave === def.clave);

    return {
      def,
      valor: valores[def.clave],
      porDefecto: String(def.defecto),
      cambiado: valores[def.clave] !== String(def.defecto),
      ultimoCambio: cambio ? { cuando: cambio.actualizado_en, quien: cambio.nombre } : null,
    };
  });
}
