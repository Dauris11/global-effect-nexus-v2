/**
 * Nota final PROPUESTA de una inscripción de Global Effect 360.
 *
 * Es una propuesta, no la nota: el profesor puede teclear otra (pesar un
 * examen oral, la participación…) y, si lo hace, la auditoría guarda las dos.
 *
 * REGLAS (decisión de producto tomada aquí; la dueña puede cambiarla):
 *
 *   · Promedio PONDERADO por `peso` de cada tarea, con cada nota normalizada a
 *     base 100 (`calificacion / puntaje_maximo * 100`). Sumar notas crudas
 *     mezclaba una tarea de 20 puntos con un examen de 200: la normalización
 *     hace comparables escalas distintas y el peso dice cuánto importa cada una.
 *   · Solo cuentan tareas evaluables (`tarea` y `examen`); materiales y avisos
 *     no se califican.
 *   · Una tarea cuenta si ya tiene nota, o si ya venció y no se entregó (vale
 *     0: no entregar es no cumplir, y si no contara, dejar de entregar subiría
 *     el promedio de quien solo entregó lo fácil).
 *   · Una tarea vencida y entregada pero sin nota NO cuenta todavía: la demora
 *     es de quien revisa, y poner 0 mientras tanto castigaría al estudiante.
 *   · Una tarea sin vencer y sin nota no cuenta: aún puede entregarla.
 *   · Sin ninguna tarea contable, no hay propuesta (`null`).
 *   · Redondeo a 2 decimales, como `inscripcion_360.nota`.
 *
 * Es pura y vive en `lib` para poder usarla en servidor y probarla sin base.
 */

export type TareaParaNota = {
  tipo: string;
  peso: number;
  puntajeMaximo: number;
  /** `null` si aún no está calificada. */
  calificacion: number | null;
  vence: Date | string | null;
  /** El estudiante ya la entregó (con o sin nota). */
  entregada: boolean;
};

export type NotaFinalPropuesta = {
  propuesta: number | null;
  contadas: number;
};

export function calcularNotaFinal(
  tareas: readonly TareaParaNota[],
  ahora: Date = new Date(),
): NotaFinalPropuesta {
  let suma = 0;
  let pesos = 0;
  let contadas = 0;

  for (const tarea of tareas) {
    if (tarea.tipo !== "tarea" && tarea.tipo !== "examen") continue;
    if (!(tarea.peso > 0) || !(tarea.puntajeMaximo > 0)) continue;

    let sobreCien: number;

    if (tarea.calificacion !== null) {
      sobreCien = (tarea.calificacion / tarea.puntajeMaximo) * 100;
    } else {
      const vencida = tarea.vence !== null && new Date(tarea.vence) < ahora;
      if (!vencida || tarea.entregada) continue;
      sobreCien = 0;
    }

    suma += sobreCien * tarea.peso;
    pesos += tarea.peso;
    contadas += 1;
  }

  if (contadas === 0 || pesos === 0) return { propuesta: null, contadas: 0 };

  return { propuesta: Math.round((suma / pesos) * 100) / 100, contadas };
}
