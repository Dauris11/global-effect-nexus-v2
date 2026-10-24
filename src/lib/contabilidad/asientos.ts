/**
 * Reglas de un asiento contable, compartidas por el editor (cliente) y las
 * server actions (servidor).
 *
 * Es la misma función en los dos lados a propósito: el botón de guardar se
 * habilita con ella y el servidor vuelve a pasar por ella, así que lo que la
 * pantalla dice que cuadra es exactamente lo que el servidor acepta.
 *
 * Sin imports: `scripts/probar-asientos.mjs` lo carga directo con Node, que
 * no resuelve el alias `@/`.
 *
 * TODO EL CÁLCULO VA EN CENTAVOS ENTEROS (`bigint`). Con float, 0.1 + 0.2 no
 * da 0.3 y un asiento correcto saldría "descuadrado por 0.0000000004"; y por
 * encima de 2^53 centavos el float ni siquiera representa el monto.
 */

/** Los CHECK de `asiento.tipo` (0048). */
export const TIPOS_ASIENTO = [
  "automatico",
  "manual",
  "ajuste",
  "apertura",
  "cierre",
  "recurrente",
] as const;
export type TipoAsiento = (typeof TIPOS_ASIENTO)[number];

/**
 * Lo que una persona puede escribir a mano. `automatico` lo escriben los
 * documentos y `recurrente` lo genera una plantilla: dejar elegirlos en el
 * formulario permitiría disfrazar un asiento manual de otra cosa.
 */
export const TIPOS_ASIENTO_MANUAL = ["manual", "ajuste", "apertura", "cierre"] as const;
export type TipoAsientoManual = (typeof TIPOS_ASIENTO_MANUAL)[number];

/** Estado derivado que muestra la lista (no es una columna de la base). */
export const ESTADOS_ASIENTO = ["vigente", "anulado", "reverso"] as const;
export type EstadoAsiento = (typeof ESTADOS_ASIENTO)[number];

/** Un motivo de reverso más corto no le explica nada al auditor. */
export const MOTIVO_MINIMO = 10;

/** Hasta 12 enteros: lo que cabe en NUMERIC(14,2). */
const MAXIMO_CENTAVOS = 10n ** 14n - 1n;

function incluido<T extends string>(lista: readonly T[], valor: unknown): valor is T {
  return typeof valor === "string" && (lista as readonly string[]).includes(valor);
}

export const esTipoAsiento = (v: unknown): v is TipoAsiento => incluido(TIPOS_ASIENTO, v);
export const esTipoAsientoManual = (v: unknown): v is TipoAsientoManual =>
  incluido(TIPOS_ASIENTO_MANUAL, v);
export const esEstadoAsiento = (v: unknown): v is EstadoAsiento => incluido(ESTADOS_ASIENTO, v);

/** `YYYY-MM` con un mes que existe: el filtro de período viaja así por la URL. */
export function esPeriodo(valor: string): boolean {
  const mes = /^\d{4}-(\d{2})$/.exec(valor)?.[1];
  return mes !== undefined && Number(mes) >= 1 && Number(mes) <= 12;
}

/**
 * Texto que escribió la persona → centavos. Vacío cuenta como cero (la
 * columna que no se usa en una línea). Devuelve `null` si no es un número
 * no negativo o si no cabe en NUMERIC(14,2).
 *
 * Más de dos decimales se REDONDEAN a centavos (mitad hacia arriba), igual
 * que haría `round(x, 2)` en la base; así el total que ve la pantalla y el
 * que guarda Postgres son el mismo.
 */
export function aCentavos(texto: string): bigint | null {
  const limpio = texto.trim().replace(/,/g, "");
  if (limpio === "") return 0n;
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(limpio)) return null;

  const [entero, decimales = ""] = limpio.split(".");
  let centavos = BigInt(entero || "0") * 100n + BigInt((decimales + "00").slice(0, 2));
  if ((decimales[2] ?? "0") >= "5") centavos += 1n;

  return centavos > MAXIMO_CENTAVOS ? null : centavos;
}

/** Centavos → "1234.50", el formato que espera NUMERIC y `formatearMonto`. */
export function centavosATexto(centavos: bigint): string {
  const absoluto = centavos < 0n ? -centavos : centavos;
  const signo = centavos < 0n ? "-" : "";
  return `${signo}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, "0")}`;
}

/** Lo que llega del editor o del formulario: todo en texto. */
export type LineaEntrada = {
  cuenta_id: string;
  descripcion?: string | null;
  debe: string;
  haber: string;
};

/** Una línea ya limpia, en el formato que piden `crear_asiento` y la plantilla. */
export type LineaNormalizada = {
  cuenta_id: string;
  descripcion: string | null;
  debe: string;
  haber: string;
};

export type ErrorAsiento =
  | "pocas_lineas"
  | "cuenta_requerida"
  | "monto_invalido"
  | "linea_ambos_lados"
  | "linea_vacia"
  | "descuadrado";

export type ResultadoAsiento = {
  /** Totales de lo que se pudo leer, para pintarlos aunque haya errores. */
  totalDebe: string;
  totalHaber: string;
  /** Debe − haber. Cero cuando cuadra. */
  diferencia: string;
} & (
  | { ok: true; lineas: LineaNormalizada[] }
  | { ok: false; error: ErrorAsiento; /** Índice de la línea culpable, si la hay. */ linea?: number }
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fila que la persona añadió y dejó sin tocar: no es una línea, es espacio. */
function enBlanco(linea: LineaEntrada): boolean {
  return !linea.cuenta_id && !linea.debe.trim() && !linea.haber.trim() && !linea.descripcion?.trim();
}

/**
 * Valida un asiento completo: al menos dos líneas, cada una con su cuenta y
 * con monto en UN solo lado, y débitos = créditos al centavo.
 *
 * Las reglas de una línea se miran antes que el cuadre: "descuadrado" es un
 * mal mensaje si lo que pasa es que una línea tiene debe y haber a la vez.
 */
export function validarLineas(entrada: readonly LineaEntrada[]): ResultadoAsiento {
  const filas = entrada
    .map((linea, indice) => ({ linea, indice }))
    .filter(({ linea }) => !enBlanco(linea));

  let debe = 0n;
  let haber = 0n;
  let error: { error: ErrorAsiento; linea?: number } | null = null;
  const lineas: LineaNormalizada[] = [];

  for (const { linea, indice } of filas) {
    const d = aCentavos(linea.debe);
    const h = aCentavos(linea.haber);
    debe += d ?? 0n;
    haber += h ?? 0n;
    if (error) continue;

    if (d === null || h === null) error = { error: "monto_invalido", linea: indice };
    else if (!UUID.test(linea.cuenta_id)) error = { error: "cuenta_requerida", linea: indice };
    else if (d > 0n && h > 0n) error = { error: "linea_ambos_lados", linea: indice };
    else if (d === 0n && h === 0n) error = { error: "linea_vacia", linea: indice };
    else {
      lineas.push({
        cuenta_id: linea.cuenta_id,
        descripcion: linea.descripcion?.trim().slice(0, 200) || null,
        debe: centavosATexto(d),
        haber: centavosATexto(h),
      });
    }
  }

  const totales = {
    totalDebe: centavosATexto(debe),
    totalHaber: centavosATexto(haber),
    diferencia: centavosATexto(debe - haber),
  };

  if (error) return { ...totales, ok: false, ...error };
  if (lineas.length < 2) return { ...totales, ok: false, error: "pocas_lineas" };
  if (debe !== haber) return { ...totales, ok: false, error: "descuadrado" };
  return { ...totales, ok: true, lineas };
}

/**
 * Las líneas que llegan del formulario como JSON. Lo que no tenga la forma
 * esperada se descarta entero: no se "arregla" un asiento a medias.
 */
export function leerLineasJson(texto: string): LineaEntrada[] | null {
  try {
    const datos: unknown = JSON.parse(texto);
    if (!Array.isArray(datos) || datos.length > 200) return null;
    const lineas: LineaEntrada[] = [];
    for (const fila of datos) {
      if (typeof fila !== "object" || fila === null) return null;
      const { cuenta_id, descripcion, debe, haber } = fila as Record<string, unknown>;
      lineas.push({
        cuenta_id: typeof cuenta_id === "string" ? cuenta_id : "",
        descripcion: typeof descripcion === "string" ? descripcion : null,
        debe: typeof debe === "string" ? debe : typeof debe === "number" ? String(debe) : "",
        haber: typeof haber === "string" ? haber : typeof haber === "number" ? String(haber) : "",
      });
    }
    return lineas;
  } catch {
    return null;
  }
}

/**
 * Qué asientos se revierten desde su ficha: los que escribió una persona o
 * generó una plantilla, y solo una vez. Un automático no: se revierte
 * anulando su documento (recibo, factura), porque revertir solo el asiento
 * dejaría el recibo "contabilizado" y el libro del banco con un movimiento
 * que la contabilidad ya no tiene. Un reverso tampoco: revertir el reverso
 * es volver a registrar el original, y eso se hace con un asiento nuevo.
 */
export function esRevertible(
  tipo: TipoAsiento,
  origenTabla: string | null,
  estado: EstadoAsiento,
): boolean {
  return (
    tipo !== "automatico" &&
    estado === "vigente" &&
    (origenTabla === null || origenTabla === "contabilidad.asiento_recurrente")
  );
}

/** Clave i18n del origen (`contab.asientos.origen.*`); las claves no admiten puntos. */
export function claveDeOrigen(tabla: string | null): string | null {
  if (!tabla) return null;
  const claves: Record<string, string> = {
    recibo: "recibo",
    factura_proveedor: "factura",
    transferencia_interna: "transferencia",
    "contabilidad.asiento": "asiento",
    "contabilidad.asiento_recurrente": "plantilla",
  };
  return claves[tabla] ?? "otro";
}

/**
 * A dónde lleva el origen de un asiento automático. Solo las tablas que
 * tienen pantalla propia; el resto (transferencias internas) se muestra sin
 * enlace.
 */
export function rutaDeOrigen(tabla: string | null, id: string | null): string | null {
  if (!tabla || !id) return null;
  switch (tabla) {
    case "recibo":
      return `/contabilidad/recibos/${id}`;
    case "factura_proveedor":
      return `/contabilidad/facturas/${id}`;
    case "contabilidad.asiento":
      return `/contabilidad/asientos/${id}`;
    case "contabilidad.asiento_recurrente":
      return "/contabilidad/asientos/recurrentes";
    default:
      return null;
  }
}
