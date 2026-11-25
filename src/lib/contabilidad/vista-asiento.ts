/**
 * Contrato común de la opción «Asiento»: lo que cualquier proceso contable
 * muestra para que se vea, antes o después de contabilizar, qué asiento genera
 * y qué le falta (descuadre, cuenta sin asignar…).
 *
 * Son tipos y funciones puras, sin servidor ni base: las comparten la capa
 * servidor (`src/server/contabilidad/asientos/vista.ts`, que arma la vista) y
 * la pantalla (`components/contabilidad/asiento/`, que la dibuja). Todo el
 * cálculo es en centavos enteros: el cuadre no puede depender de floats.
 */

export type ClaveProblemaAsiento =
  | "codigo_sin_cuenta"
  | "cuenta_inactiva"
  | "cuenta_agrupadora"
  | "asiento_descuadrado"
  | "monto_invalido"
  | "otro";

export type ProblemaAsiento = {
  clave: ClaveProblemaAsiento;
  /** Código de transacción implicado, si lo hay (para el enlace a Códigos). */
  codigo?: string;
  /** Texto libre ya legible; es lo único que se muestra en `otro`. */
  detalle?: string;
};

export type LineaVista = {
  cuentaId?: string;
  cuentaCodigo?: string;
  cuentaNombre?: string;
  /** Si varias partidas se fusionaron en la línea, los códigos van separados por «, ». */
  codigoTransaccion?: string;
  nombreCodigo?: string;
  debe: number;
  haber: number;
  descripcion?: string;
};

export type VistaAsiento = {
  estado: "previa" | "contabilizado";
  asientoId?: string;
  numero?: string;
  fecha?: string;
  descripcion?: string;
  lineas: LineaVista[];
  totalDebe: number;
  totalHaber: number;
  cuadra: boolean;
  problemas: ProblemaAsiento[];
};

export type ExtrasVista = Pick<VistaAsiento, "estado" | "asientoId" | "numero" | "fecha" | "descripcion">;

export const aCentavos = (pesos: number): number => Math.round(pesos * 100);
export const dePesos = (centavos: number): number => centavos / 100;

/**
 * Une líneas y problemas en una vista. Suma en centavos y decide `cuadra`;
 * si las líneas no cuadran y nadie lo avisó, añade el problema
 * `asiento_descuadrado` para que la lista de problemas y la banda coincidan.
 * Un asiento sin líneas no se marca descuadrado: aún no hay nada que comparar.
 */
export function armarVista(
  lineas: LineaVista[],
  problemas: ProblemaAsiento[],
  extras: Partial<ExtrasVista> = {},
): VistaAsiento {
  const debe = lineas.reduce((s, l) => s + aCentavos(l.debe), 0);
  const haber = lineas.reduce((s, l) => s + aCentavos(l.haber), 0);
  const cuadra = debe === haber;
  const lista = [...problemas];
  if (!cuadra && !lista.some((p) => p.clave === "asiento_descuadrado")) {
    lista.push({ clave: "asiento_descuadrado" });
  }
  return {
    estado: extras.estado ?? "previa",
    asientoId: extras.asientoId,
    numero: extras.numero,
    fecha: extras.fecha,
    descripcion: extras.descripcion,
    lineas,
    totalDebe: dePesos(debe),
    totalHaber: dePesos(haber),
    cuadra,
    problemas: lista,
  };
}

/** Diferencia absoluta entre debe y haber, en pesos (0 si cuadra). */
export function descuadreDe(vista: Pick<VistaAsiento, "totalDebe" | "totalHaber">): number {
  return dePesos(Math.abs(aCentavos(vista.totalDebe) - aCentavos(vista.totalHaber)));
}
