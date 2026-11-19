/**
 * Cuánto tiempo lleva una persona en la Fundación, a partir de su fecha de
 * ingreso. Puro (sin reloj propio): quien llama pasa el «hoy» —en hora de La
 * Vega, no la del servidor, que corre en UTC— para poder probarlo.
 *
 * Reglas, escritas porque los meses no miden lo mismo:
 *   · Se cuentan meses cumplidos. El «aniversario mensual» del día 31 cae el
 *     último día de los meses más cortos; así quien entró el 29 de febrero
 *     cumple el año el 28 de febrero de un año sin bisiesto, no el 1 de marzo.
 *   · Sin fecha de ingreso, o con una inválida o posterior a hoy, no hay
 *     antigüedad: devuelve `null` y la pantalla lo dice. No se inventa desde
 *     la fecha en que se creó el expediente.
 */

export type Antiguedad = { anios: number; meses: number; dias: number };

const FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

function partes(fecha: string): { a: number; m: number; d: number } | null {
  const m = FECHA.exec(fecha);

  if (!m) return null;

  const a = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);

  // `Date.UTC` normaliza una fecha imposible (31 de febrero); se comprueba.
  const control = new Date(Date.UTC(a, mes - 1, d));

  return control.getUTCFullYear() === a && control.getUTCMonth() === mes - 1 && control.getUTCDate() === d
    ? { a, m: mes, d }
    : null;
}

const diasDelMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();

const aMs = (a: number, m: number, d: number) => Date.UTC(a, m - 1, d);

export function antiguedad(ingreso: string | null | undefined, hoy: string): Antiguedad | null {
  const i = ingreso ? partes(ingreso) : null;
  const h = partes(hoy);

  if (!i || !h) return null;
  if (aMs(i.a, i.m, i.d) > aMs(h.a, h.m, h.d)) return null;

  let meses = (h.a - i.a) * 12 + (h.m - i.m);

  // ¿Ya llegó este mes el día del aniversario? Si el mes de hoy es más corto, el
  // aniversario se adelanta a su último día.
  if (h.d < Math.min(i.d, diasDelMes(h.a, h.m))) meses -= 1;

  // Los días sobrantes se cuentan desde el último aniversario mensual.
  const am = i.m - 1 + meses;
  const anioAniv = i.a + Math.floor(am / 12);
  const mesAniv = (am % 12) + 1;
  const diaAniv = Math.min(i.d, diasDelMes(anioAniv, mesAniv));
  const dias = Math.round((aMs(h.a, h.m, h.d) - aMs(anioAniv, mesAniv, diaAniv)) / 86_400_000);

  return { anios: Math.floor(meses / 12), meses: meses % 12, dias };
}
