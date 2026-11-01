/**
 * Reglas de los cuatrimestres de Global Effect 360, en una función pura.
 *
 * Vive en `lib` y no junto a las acciones porque la usan tres puertas distintas
 * —guardar un período, guardar una ventana y arrastrar una barra del Gantt— y
 * porque así se puede probar sin base de datos. Si cada una llevara su copia de
 * las reglas, tarde o temprano una dejaría pasar lo que otra rechaza.
 */

export const MAX_PERIODOS_POR_ANIO = 4;

export type PeriodoCandidato = {
  id?: string | null;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
};

export type PeriodoExistente = {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
};

export type ErrorPeriodo =
  | "tipo_invalido"
  | "fechas_invalidas"
  | "fin_antes_de_inicio"
  | "anio_distinto"
  | "traslape"
  | "demasiados_en_anio";

const DIA = /^(\d{4})-(\d{2})-(\d{2})/;

/** `YYYY-MM-DD` que además existe en el calendario (no un 31 de febrero). */
export function esDiaValido(valor: string): boolean {
  const m = DIA.exec(valor);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia
  );
}

/** Los diez primeros caracteres: `pg` puede devolver un `Date` ya convertido. */
export function aDia(valor: string | Date): string {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor.slice(0, 10);
}

/**
 * Devuelve el código del primer error, o `null` si el período es válido.
 *
 * Un período `semestre` ya guardado no se toca: la regla de tipo solo se
 * aplica al candidato, es decir, a lo que se quiere crear o editar.
 */
export function validarPeriodo(
  candidato: PeriodoCandidato,
  existentes: PeriodoExistente[],
): ErrorPeriodo | null {
  if (candidato.tipo !== "cuatrimestre") return "tipo_invalido";

  const { fecha_inicio: inicio, fecha_fin: fin } = candidato;
  if (!esDiaValido(inicio) || !esDiaValido(fin)) return "fechas_invalidas";
  if (fin < inicio) return "fin_antes_de_inicio";
  if (inicio.slice(0, 4) !== fin.slice(0, 4)) return "anio_distinto";

  const otros = existentes.filter((p) => p.id !== candidato.id);

  // Comparar cadenas ISO equivale a comparar fechas; los extremos cuentan como
  // traslape porque un período termina el último día que dura.
  const traslapa = otros.some(
    (p) => aDia(p.fecha_inicio) <= fin && aDia(p.fecha_fin) >= inicio,
  );
  if (traslapa) return "traslape";

  const anio = inicio.slice(0, 4);
  const delAnio = otros.filter((p) => aDia(p.fecha_inicio).slice(0, 4) === anio).length;
  if (delAnio >= MAX_PERIODOS_POR_ANIO) return "demasiados_en_anio";

  return null;
}
