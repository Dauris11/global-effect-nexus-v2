import { esEstadoEstudiante, type EstadoEstudiante } from "@/lib/expedientes";

/**
 * Filtros, orden y vista de la lista de expedientes. Viven en la URL: la
 * pantalla es de servidor y un enlace filtrado se comparte o se guarda tal cual.
 */

export const SITUACIONES_EXPEDIENTE = [
  "en_riesgo",
  "sin_notas",
  "sin_cuenta",
  "sin_catalogo",
  "sin_foto",
] as const;

export type SituacionExpediente = (typeof SITUACIONES_EXPEDIENTE)[number];

export const ORDENES_EXPEDIENTE = [
  "nombre",
  "indice_alto",
  "indice_bajo",
  "ingreso_reciente",
] as const;

export type OrdenExpediente = (typeof ORDENES_EXPEDIENTE)[number];

/** La tabla densa es la vista por defecto (docs/ux-rules.md); las tarjetas con foto son opcionales. */
export const VISTAS_EXPEDIENTE = ["lista", "tarjetas"] as const;

export type VistaExpediente = (typeof VISTAS_EXPEDIENTE)[number];

export type ConsultaExpedientes = {
  busqueda: string | null;
  estado: EstadoEstudiante | null;
  universidad: string | null;
  situacion: SituacionExpediente | null;
  orden: OrdenExpediente;
  vista: VistaExpediente;
  pagina: number;
};

const es = <T extends string>(lista: readonly T[], valor: unknown): valor is T =>
  typeof valor === "string" && (lista as readonly string[]).includes(valor);

/**
 * Lee la URL. Un valor desconocido se ignora: llega de un enlace que puede
 * haberse quedado viejo, no de un error que haya que anunciar.
 */
export function leerConsultaExpedientes(
  crudo: Record<string, string | undefined>,
): ConsultaExpedientes {
  const pagina = Number(crudo.pagina);

  return {
    busqueda: crudo.q?.trim() || null,
    estado: esEstadoEstudiante(crudo.estado) ? crudo.estado : null,
    universidad: crudo.universidad?.trim() || null,
    situacion: es(SITUACIONES_EXPEDIENTE, crudo.situacion) ? crudo.situacion : null,
    orden: es(ORDENES_EXPEDIENTE, crudo.orden) ? crudo.orden : "nombre",
    vista: crudo.vista === "tarjetas" ? "tarjetas" : "lista",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

/**
 * URL de la lista con lo que se pida cambiar sobre la consulta actual.
 *
 * Cambiar cualquier cosa que no sea la página vuelve a la primera: con la
 * página 4 puesta, un filtro nuevo dejaría casi siempre una lista vacía.
 */
export function enlaceExpedientes(
  actual: ConsultaExpedientes,
  cambio: Partial<ConsultaExpedientes>,
): string {
  const final = { ...actual, pagina: 1, ...cambio };
  const parametros = new URLSearchParams();

  if (final.busqueda) parametros.set("q", final.busqueda);
  if (final.estado) parametros.set("estado", final.estado);
  if (final.universidad) parametros.set("universidad", final.universidad);
  if (final.situacion) parametros.set("situacion", final.situacion);
  if (final.orden !== "nombre") parametros.set("orden", final.orden);
  if (final.vista !== "lista") parametros.set("vista", final.vista);
  if (final.pagina > 1) parametros.set("pagina", String(final.pagina));

  const cadena = parametros.toString();

  return cadena ? `/expedientes?${cadena}` : "/expedientes";
}

/** Si hay algún filtro puesto (el orden y la vista no cuentan). */
export function hayFiltros(consulta: ConsultaExpedientes): boolean {
  return Boolean(
    consulta.busqueda || consulta.estado || consulta.universidad || consulta.situacion,
  );
}
