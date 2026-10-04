/**
 * Registro de adaptadores. Vive aparte de `adaptador.ts` para que los
 * adaptadores importen el contrato sin crear un ciclo con el registro.
 */

import type { AdaptadorBanco } from "./adaptador";
import { adaptadorGenerico } from "./generico";
import { adaptadorSantaCruz } from "./santa-cruz";

const ADAPTADORES: Record<string, AdaptadorBanco> = {
  [adaptadorGenerico.clave]: adaptadorGenerico,
  [adaptadorSantaCruz.clave]: adaptadorSantaCruz,
};

/**
 * La clave sale de la tabla `banco`. Un banco nuevo sin adaptador propio cae
 * en el genérico para que se pueda configurar por columnas sin tocar código.
 */
export function obtenerAdaptador(clave: string): AdaptadorBanco {
  return ADAPTADORES[clave] ?? adaptadorGenerico;
}

export type { AdaptadorBanco, ColumnasEstado, LineaPagoNomina, MovimientoEstado } from "./adaptador";
