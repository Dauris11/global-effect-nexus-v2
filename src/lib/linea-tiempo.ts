/**
 * Lo que comparten las tres líneas de tiempo (general, detalle de proyecto y
 * cuentas por pagar): el modelo de una barra y la aritmética de días.
 *
 * Todo trabaja con días `YYYY-MM-DD` y los pasa por UTC. Con la hora local una
 * barra de tres días podía medir cuatro al cruzar un cambio de horario, y el
 * arrastre movía fechas un día de más o de menos.
 */

export type TonoBarra = "marca" | "oscuro" | "tinta" | "apagado";

export type BarraTiempo = {
  id: string;
  /** Clave de la clase (`proyecto`, `tarea`…): el servidor decide qué acepta mover. */
  clase: string;
  /** Texto de la clase ya traducido: el componente no conoce el vocabulario. */
  claseEtiqueta: string;
  titulo: string;
  /** A qué pertenece: el período de una materia, el proyecto de una tarea. */
  grupo: string | null;
  /** Días ISO. Sin fechas de verdad no hay barra. */
  inicio: string;
  fin: string;
  /** Una línea de contexto: entregas, progreso, inscritos, monto. */
  detalle: string | null;
  /** Se puede mover o estirar. El servidor lo vuelve a comprobar al guardar. */
  editable: boolean;
  /** 0–100; se pinta como relleno dentro de la barra. */
  progreso?: number;
  tono?: TonoBarra;
  /** Un solo día que se dibuja como rombo (un hito). */
  hito?: boolean;
  /** Fechas puntuales dentro de la fila, p. ej. el pago programado. */
  marcas?: { fecha: string; etiqueta: string }[];
  /** Si existe, el detalle ofrece abrir la ficha. */
  enlace?: string;
  /** Qué hay que atender: se dice con un icono, no con un color. */
  aviso?: boolean;
};

export type SeccionTiempo = {
  clave: string;
  titulo: string;
  barras: BarraTiempo[];
};

export type CambioDeFechas = {
  id: string;
  clase: string;
  inicio: string;
  fin: string;
};

export type EscalaTiempo = "semana" | "mes" | "periodo";

/** Ancho de un día en píxeles según la escala. */
export const PX_POR_DIA: Record<EscalaTiempo, number> = {
  semana: 44,
  mes: 18,
  periodo: 7,
};

const DIA_MS = 86_400_000;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})/;

export function aMs(dia: string): number {
  const m = FORMATO.exec(dia);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function aDia(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function sumarDias(dia: string, dias: number): string {
  return aDia(aMs(dia) + dias * DIA_MS);
}

/** Días de `a` a `b` (negativo si `b` es anterior). */
export function diasEntre(a: string, b: string): number {
  return Math.round((aMs(b) - aMs(a)) / DIA_MS);
}

/** Fin antes que inicio: un dato roto que no tiene duración que dibujar. */
export function esIncoherente(barra: Pick<BarraTiempo, "inicio" | "fin">): boolean {
  return barra.fin < barra.inicio;
}

/**
 * Tramo que abarca las barras, con un margen para que ninguna toque el borde.
 * Las incoherentes no cuentan: una fecha al revés estiraría el eje entero.
 */
export function tramoDe(
  barras: readonly BarraTiempo[],
  hoy?: string,
  margen = 3,
): { inicio: string; fin: string } | null {
  const sanas = barras.filter((b) => !esIncoherente(b));
  if (sanas.length === 0) return null;

  let inicio = sanas[0].inicio;
  let fin = sanas[0].fin;
  for (const b of sanas) {
    if (b.inicio < inicio) inicio = b.inicio;
    if (b.fin > fin) fin = b.fin;
  }
  // Si hoy cae cerca, que entre: la línea de hoy es lo primero que se busca.
  if (hoy && hoy >= sumarDias(inicio, -30) && hoy <= sumarDias(fin, 30)) {
    if (hoy < inicio) inicio = hoy;
    if (hoy > fin) fin = hoy;
  }

  return { inicio: sumarDias(inicio, -margen), fin: sumarDias(fin, margen) };
}

/** Escala inicial según lo largo del tramo, para no abrir con 40 000 px. */
export function escalaPara(dias: number): EscalaTiempo {
  if (dias <= 75) return "semana";
  if (dias <= 220) return "mes";
  return "periodo";
}

/** Meses del tramo con los días que ocupan; el primero y el último van cortados. */
export function mesesDelTramo(
  inicio: string,
  fin: string,
): { clave: string; mes: number; anio: number; dias: number }[] {
  const meses: { clave: string; mes: number; anio: number; dias: number }[] = [];
  let cursor = aMs(inicio);
  const limite = aMs(fin);

  while (cursor <= limite) {
    const fecha = new Date(cursor);
    const siguiente = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 1);
    const corte = Math.min(siguiente, limite + DIA_MS);
    meses.push({
      clave: `${fecha.getUTCFullYear()}-${fecha.getUTCMonth()}`,
      mes: fecha.getUTCMonth(),
      anio: fecha.getUTCFullYear(),
      dias: Math.round((corte - cursor) / DIA_MS),
    });
    cursor = siguiente;
  }

  return meses;
}
