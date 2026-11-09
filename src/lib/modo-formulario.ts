/**
 * Cómo prefiere cada persona llenar los formularios largos: todo a la vista
 * ("normal") o un paso a la vez ("guiado").
 *
 * Igual que la apariencia, vive en el navegador y no en la base: es una
 * costumbre de quien está sentado frente a esa pantalla, y así el formulario
 * abre ya en el modo correcto sin esperar una consulta.
 */

export const MODOS_FORMULARIO = ["normal", "guiado"] as const;

export type ModoFormulario = (typeof MODOS_FORMULARIO)[number];

/**
 * "normal" de entrada: quien ya usa el sistema encuentra los formularios como
 * los dejó, y quien prefiera ir paso a paso lo cambia con un toque en
 * cualquier formulario o en Mi perfil.
 */
export const MODO_FORMULARIO_INICIAL: ModoFormulario = "normal";

export const CLAVE_MODO_FORMULARIO = "ge-modo-formulario";

export function leerModoFormulario(): ModoFormulario {
  try {
    const crudo = localStorage.getItem(CLAVE_MODO_FORMULARIO);

    return MODOS_FORMULARIO.includes(crudo as ModoFormulario)
      ? (crudo as ModoFormulario)
      : MODO_FORMULARIO_INICIAL;
  } catch {
    return MODO_FORMULARIO_INICIAL;
  }
}
