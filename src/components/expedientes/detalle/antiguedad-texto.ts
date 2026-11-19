import { antiguedad } from "@/lib/antiguedad";
import { hoyRD } from "@/lib/fecha-rd";

type Traductor = (clave: string, valores?: Record<string, number>) => string;

/**
 * «1 año y 8 meses» redactado en el idioma de la persona, o `null` si no hay
 * fecha de ingreso (o es posterior a hoy). Las partes se unen con el formato de
 * lista del navegador/servidor para que sea «1 año, 2 meses y 3 días» en español
 * y «1 year, 2 months, and 3 days» en inglés sin escribir el «y» a mano.
 *
 * Menos de un mes: se dice en días; el mismo día de ingreso, «hoy».
 */
export function textoAntiguedad(ingreso: string | null, t: Traductor, idioma: "es" | "en"): string | null {
  const a = antiguedad(ingreso, hoyRD());

  if (!a) return null;

  const partes: string[] = [];

  if (a.anios > 0) partes.push(t("v2.years", { n: a.anios }));
  if (a.meses > 0) partes.push(t("v2.months", { n: a.meses }));
  // Con años o meses cumplidos, los días sueltos son ruido; solo cuentan en el primer mes.
  if (a.anios === 0 && a.meses === 0 && a.dias > 0) partes.push(t("v2.days", { n: a.dias }));
  if (partes.length === 0) return t("v2.today");

  return new Intl.ListFormat(idioma, { style: "long", type: "conjunction" }).format(partes);
}
