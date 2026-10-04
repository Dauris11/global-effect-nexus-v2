import type { NotaDelEstudiante } from "@/server/estudiantes/portal";

/**
 * Notas agrupadas por período, conservando el orden que ya trae
 * `notasDelEstudiante` (el período más reciente primero).
 *
 * Vive aquí y no en cada página porque la usan el inicio del portal y la
 * pantalla de calificaciones: dos copias acabarían ordenando distinto.
 */
export type PeriodoConNotas = {
  id: string;
  nombre: string;
  notas: NotaDelEstudiante[];
};

export function agruparPorPeriodo(
  notas: readonly NotaDelEstudiante[],
): PeriodoConNotas[] {
  const grupos = new Map<string, PeriodoConNotas>();

  for (const nota of notas) {
    const grupo = grupos.get(nota.periodo_id);

    if (grupo) grupo.notas.push(nota);
    else
      grupos.set(nota.periodo_id, {
        id: nota.periodo_id,
        nombre: nota.periodo,
        notas: [nota],
      });
  }

  return [...grupos.values()];
}

/**
 * Tipos de evento que tienen traducción. `evento.tipo` es TEXT libre con
 * `'otro'` por defecto, así que un valor inesperado se dibuja como "otro" en
 * vez de imprimir la clave sin traducir en pantalla.
 */
const TIPOS_EVENTO = [
  "academico",
  "administrativo",
  "social",
  "reunion",
  "otro",
] as const;

/** Devuelve el tipo si está traducido; si no, "otro". */
export function tipoDeEvento(
  valor: string | null,
): (typeof TIPOS_EVENTO)[number] {
  return TIPOS_EVENTO.includes(valor as (typeof TIPOS_EVENTO)[number])
    ? (valor as (typeof TIPOS_EVENTO)[number])
    : "otro";
}
