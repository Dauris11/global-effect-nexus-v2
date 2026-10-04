/**
 * Vocabulario compartido del tablero de tareas.
 *
 * Vive en `src/lib` y no en `src/server/operaciones/consultas` por una razón
 * que no se ve compilando: el tablero es un componente CLIENTE y necesita la
 * lista de columnas. Importar un VALOR desde un archivo de consultas arrastra
 * `@/lib/db` detrás, y con él el driver `pg` entero al navegador —que pide
 * `fs` y `net` y revienta la página con un 500—. Ni `tsc` ni `eslint` lo
 * detectan: los tipos se borran al compilar y el fallo solo aparece con la
 * página cargada de verdad.
 *
 * La regla, entonces: de `@/server/**\/consultas` un componente cliente puede
 * importar TIPOS (`import type`, que se borran) y nada más. Lo que sea un valor
 * y lo necesiten los dos lados, se pone aquí. Es lo que ya hacen
 * `src/lib/expedientes.ts`, `src/lib/solicitudes.ts` y `src/lib/notas.ts`.
 */

/** Los estados del tablero, en el orden de las columnas. */
export const COLUMNAS = ["pendiente", "en_progreso", "completada"] as const;

export type Columna = (typeof COLUMNAS)[number];

/** `tarea.estado` es TEXT: lo que venga de fuera se comprueba antes. */
export function esColumna(valor: string): valor is Columna {
  return (COLUMNAS as readonly string[]).includes(valor);
}
