import { format, isValid, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";

import type { Locale as Idioma } from "@/i18n/routing";

/**
 * Formato de fechas. `docs/09-sistema-visual.md` fija dos formas y solo dos:
 * la larga "dd 'de' MMMM, yyyy" y la corta "dd MMM yyyy".
 *
 * Todo entra como `string | Date | null`: las columnas TIMESTAMPTZ llegan
 * desde `pg` como Date, pero los formularios y los JSON las traen como texto.
 */

const LOCALES = { es, en: enUS } as const;

function aFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;

  const fecha = valor instanceof Date ? valor : parseISO(valor);

  return isValid(fecha) ? fecha : null;
}

/** "09 de agosto, 2026" — encabezados y vistas de detalle. */
export function fechaLarga(
  valor: string | Date | null | undefined,
  idioma: Idioma = "es",
): string {
  const fecha = aFecha(valor);
  if (!fecha) return "—";

  return format(fecha, idioma === "es" ? "dd 'de' MMMM, yyyy" : "MMMM dd, yyyy", {
    locale: LOCALES[idioma],
  });
}

/** "09 ago 2026" — tablas, tarjetas y listas apretadas. */
export function fechaCorta(
  valor: string | Date | null | undefined,
  idioma: Idioma = "es",
): string {
  const fecha = aFecha(valor);
  if (!fecha) return "—";

  return format(fecha, "dd MMM yyyy", { locale: LOCALES[idioma] });
}

/** "09 ago · 14:30" — citas con administración y eventos del calendario. */
export function fechaConHora(
  valor: string | Date | null | undefined,
  hora?: string | null,
  idioma: Idioma = "es",
): string {
  const fecha = aFecha(valor);
  if (!fecha) return "—";

  const dia = format(fecha, "dd MMM", { locale: LOCALES[idioma] });

  return hora ? `${dia} · ${hora.slice(0, 5)}` : dia;
}

/**
 * "agosto 2026" — cabecera y selector de mes del calendario.
 *
 * Acepta la clave `YYYY-MM` que viaja por la URL: se le añade el día 1 porque
 * `parseISO` necesita una fecha completa.
 */
export function mesLargo(clave: string, idioma: Idioma = "es"): string {
  const fecha = aFecha(/^\d{4}-\d{2}$/.test(clave) ? `${clave}-01` : clave);
  if (!fecha) return "—";

  return format(fecha, "MMMM yyyy", { locale: LOCALES[idioma] });
}

/** "lunes 10" — encabezado de cada día dentro de un mes ya identificado. */
export function diaConSemana(
  valor: string | Date | null | undefined,
  idioma: Idioma = "es",
): string {
  const fecha = aFecha(valor);
  if (!fecha) return "—";

  return format(fecha, "EEEE d", { locale: LOCALES[idioma] });
}

/** Clave `YYYY-MM-DD` para columnas DATE y comparaciones del calendario. */
export function claveDia(valor: string | Date = new Date()): string {
  const fecha = aFecha(valor);

  return fecha ? format(fecha, "yyyy-MM-dd") : "";
}

/** Clave `YYYY-MM` — el selector de mes de Servicios Mensuales. */
export function claveMes(valor: string | Date = new Date()): string {
  const fecha = aFecha(valor);

  return fecha ? format(fecha, "yyyy-MM") : "";
}
