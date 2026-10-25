/**
 * Lectura humana de los códigos de acción del registro.
 *
 * Las acciones se escriben como `modulo.verbo` (`tarea.creada`) o, las de
 * contabilidad, `contabilidad.crear`. El tablero las enseña como «Tarea ·
 * creada», con las dos mitades traducidas; si una mitad no tiene traducción
 * (un módulo nuevo que aún no se añadió al diccionario) se enseña tal cual, que
 * es mejor que esconderla o inventarla.
 */
export function partirAccion(accion: string): { modulo: string; verbo: string } {
  const [modulo = "", ...resto] = accion.split(".");

  return { modulo, verbo: resto.join(".") || modulo };
}

/** Clave de i18n segura: `inscripcion_360` vale, `a.b` no (los puntos anidan). */
export const claveI18n = (texto: string) => texto.replace(/\./g, "_");
