import type { GrupoPrioridad, ListaPrioridades, PrioridadItem, Severidad } from "@/lib/prioridades/types";

const DIA = 86_400_000;

/** Días enteros entre dos claves `YYYY-MM-DD` (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA);
}

/** `diaEnRD` inyectado: este archivo es puro y se prueba sin zona horaria del servidor. */
export type DiaDe = (instante: Date) => string;

export function severidadDe(venceEn: Date | undefined, hoy: string, diaDe: DiaDe): Severidad {
  if (!venceEn) return "normal";
  const dias = diasEntre(hoy, diaDe(venceEn));

  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  if (dias <= 3) return "pronto";

  return "normal";
}

const BASE: Record<Severidad, number> = { vencido: 100, hoy: 60, pronto: 40, normal: 10 };
const POR_PRIORIDAD = { urgente: 40, alta: 20, media: 5, baja: 0 } as const;

/** score = base(severidad) + bloqueo + prioridad + antigüedad (+1 por día, máx. 20). */
export function puntaje(
  item: Pick<PrioridadItem, "bloquea" | "prioridadTarea" | "creadoEn">,
  severidad: Severidad,
  hoy: string,
  diaDe: DiaDe,
): number {
  const antiguedad = item.creadoEn ? Math.min(20, Math.max(0, diasEntre(diaDe(item.creadoEn), hoy))) : 0;

  return (
    BASE[severidad] +
    (item.bloquea ? 30 : 0) +
    (item.prioridadTarea ? POR_PRIORIDAD[item.prioridadTarea] : 0) +
    antiguedad
  );
}

/** Completa `severidad` y `score` de un ítem recién armado por un proveedor. */
export function calcular<T extends Omit<PrioridadItem, "severidad" | "score">>(
  item: T,
  hoy: string,
  diaDe: DiaDe,
): T & { severidad: Severidad; score: number } {
  const severidad = severidadDe(item.venceEn, hoy, diaDe);

  return { ...item, severidad, score: puntaje(item, severidad, hoy, diaDe) };
}

/** Vencido · Hoy · Esta semana · Más adelante. «Esta semana» = a 1–7 días. */
export function grupoDe(item: PrioridadItem, hoy: string, diaDe: DiaDe): GrupoPrioridad {
  if (item.severidad === "vencido") return "vencido";
  if (item.severidad === "hoy") return "hoy";
  // Sin fecha pero con alguien esperando mi decisión: se atiende hoy, no «más adelante».
  if (!item.venceEn) return item.bloquea ? "hoy" : "adelante";

  return diasEntre(hoy, diaDe(item.venceEn)) <= 7 ? "semana" : "adelante";
}

export function agrupar(items: readonly PrioridadItem[], hoy: string, diaDe: DiaDe): ListaPrioridades {
  const grupos: ListaPrioridades["grupos"] = { vencido: [], hoy: [], semana: [], adelante: [] };
  const esperando: PrioridadItem[] = [];
  const porScore = (a: PrioridadItem, b: PrioridadItem) => b.score - a.score || a.id.localeCompare(b.id);

  for (const item of items) {
    if (item.esperandoA) esperando.push(item);
    else grupos[grupoDe(item, hoy, diaDe)].push(item);
  }
  for (const g of Object.values(grupos)) g.sort(porScore);
  esperando.sort(porScore);

  return { grupos, esperando, total: items.length };
}
