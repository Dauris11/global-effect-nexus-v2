import type { PoolClient } from "pg";

import { definicionDe, type NaturalezaCodigo } from "@/lib/contabilidad/codigos-transaccion";

/**
 * Motor de asientos por código de transacción.
 *
 * Un módulo NO sabe en qué cuenta ni de qué lado va cada monto: dice «tantos
 * pesos de NOM_AFP_EMPLEADO_X_PAGAR». El lado sale de la naturaleza que la
 * contadora configuró para el código y la cuenta, de la que le asignó en el
 * Catálogo. Así cambiar la contabilidad no obliga a tocar el módulo.
 *
 * Uso típico (el asiento lo escribe `contabilidad.crear_asiento`, no este motor):
 *   const lineas = await construirLineasPorCodigo(cliente, [
 *     { codigo: "NOM_AFP_EMPLEADO_X_PAGAR", monto: 1500, descripcion: "AFP nómina N-1" },
 *   ], [{ cuenta_id: bancoId, debe: 0, haber: 9000, descripcion: "Desembolso" }]);
 *
 * Los errores son `ErrorCodigosTransaccion` con una `clave` fija, para que la
 * pantalla los traduzca; su `message` ya es legible en español.
 */

export type Partida = { codigo: string; monto: number; descripcion: string };

/** Línea tal como la recibe `contabilidad.crear_asiento`. */
export type LineaAsiento = { cuenta_id: string; debe: number; haber: number; descripcion: string };

export type ClaveErrorCodigos =
  | "codigo_desconocido"
  | "monto_invalido"
  | "codigo_sin_cuenta"
  | "cuenta_no_usable"
  | "asiento_descuadrado";

export class ErrorCodigosTransaccion extends Error {
  constructor(
    public readonly clave: ClaveErrorCodigos,
    mensaje: string,
    /** Códigos implicados, para listarlos en pantalla. */
    public readonly codigos: string[] = [],
  ) {
    super(mensaje);
    this.name = "ErrorCodigosTransaccion";
  }
}

type Resolucion = { naturaleza: NaturalezaCodigo; cuentaId: string | null; cuentaUsable: boolean };

/** Naturaleza efectiva (lo configurado o el defecto del código) y la cuenta, con su estado. */
async function resolver(cliente: PoolClient, codigos: string[]): Promise<Map<string, Resolucion>> {
  const { rows } = await cliente.query<{
    codigo: string; naturaleza: NaturalezaCodigo; cuenta_id: string | null; usable: boolean | null;
  }>(
    `SELECT t.codigo, t.naturaleza, t.cuenta_id, (c.activa AND c.admite_movimiento) AS usable
       FROM contabilidad.codigo_transaccion t
       LEFT JOIN contabilidad.cuenta_contable c ON c.id = t.cuenta_id
      WHERE t.codigo = ANY($1::text[])`,
    [codigos],
  );
  const guardado = new Map(rows.map((r) => [r.codigo, r]));
  return new Map(
    codigos.map((codigo) => {
      const fila = guardado.get(codigo);
      return [codigo, {
        // Sin fila: nadie lo ha configurado, rige el defecto del código.
        naturaleza: fila?.naturaleza ?? definicionDe(codigo)!.naturaleza,
        cuentaId: fila?.cuenta_id ?? null,
        cuentaUsable: fila?.usable ?? false,
      }];
    }),
  );
}

export type LineaPrevia = {
  cuenta_id: string | null;
  debe: number;
  haber: number;
  descripcion: string;
  /** Códigos que aportaron a la línea; vacío en las líneas extra. */
  codigos: string[];
};

export type Previa = {
  lineas: LineaPrevia[];
  /** Códigos usados que no tienen cuenta, o cuya cuenta ya no admite asientos. */
  sinCuenta: string[];
  cuentaInactiva: string[];
  totalDebe: number;
  totalHaber: number;
  cuadra: boolean;
};

const aCentavos = (n: number) => Math.round(n * 100);
const deCentavos = (c: number) => c / 100;

/**
 * Arma las líneas SIN escribir nada y sin lanzar por configuración
 * incompleta: devuelve qué falta. Sirve a las vistas previas; el asiento real
 * usa `construirLineasPorCodigo`, que sí falla.
 *
 * Fusiona las partidas de la misma cuenta y el mismo lado en una línea (varios
 * «por pagar» a la 2.3.1 son un solo renglón) y descarta los montos en cero.
 * Se calcula en centavos enteros para que el cuadre no dependa de floats.
 */
export async function previsualizarLineasPorCodigo(
  cliente: PoolClient,
  partidas: Partida[],
  /** Líneas fuera de los códigos (p. ej. el desembolso por el banco elegido). */
  lineasExtra: Array<{ cuenta_id: string | null; debe: number; haber: number; descripcion: string }> = [],
): Promise<Previa> {
  for (const p of partidas) {
    if (!definicionDe(p.codigo)) {
      throw new ErrorCodigosTransaccion("codigo_desconocido", `El código de transacción «${p.codigo}» no existe.`, [p.codigo]);
    }
    if (!Number.isFinite(p.monto) || p.monto < 0) {
      throw new ErrorCodigosTransaccion("monto_invalido", `El monto de «${p.codigo}» no es válido (${p.monto}).`, [p.codigo]);
    }
  }
  const usados = partidas.filter((p) => aCentavos(p.monto) !== 0);
  const resolucion = await resolver(cliente, [...new Set(usados.map((p) => p.codigo))]);

  const sinCuenta = new Set<string>();
  const cuentaInactiva = new Set<string>();
  const lineas = new Map<string, { l: LineaPrevia; debe: number; haber: number; descripciones: string[] }>();
  for (const p of usados) {
    const r = resolucion.get(p.codigo)!;
    if (!r.cuentaId) {
      sinCuenta.add(p.codigo);
      continue;
    }
    if (!r.cuentaUsable) cuentaInactiva.add(p.codigo);
    const lado = r.naturaleza === "debito" ? "debe" : "haber";
    const clave = `${r.cuentaId}|${lado}`;
    let acumulada = lineas.get(clave);
    if (!acumulada) {
      acumulada = { l: { cuenta_id: r.cuentaId, debe: 0, haber: 0, descripcion: "", codigos: [] }, debe: 0, haber: 0, descripciones: [] };
      lineas.set(clave, acumulada);
    }
    acumulada[lado] += aCentavos(p.monto);
    acumulada.l.codigos.push(p.codigo);
    if (!acumulada.descripciones.includes(p.descripcion)) acumulada.descripciones.push(p.descripcion);
  }

  const resultado: LineaPrevia[] = [...lineas.values()].map((a) => ({
    ...a.l, debe: deCentavos(a.debe), haber: deCentavos(a.haber), descripcion: a.descripciones.join(" · "),
  }));
  for (const e of lineaExtraNoVacia(lineasExtra)) resultado.push({ ...e, codigos: [] });

  const totalDebe = resultado.reduce((s, l) => s + aCentavos(l.debe), 0);
  const totalHaber = resultado.reduce((s, l) => s + aCentavos(l.haber), 0);
  return {
    lineas: resultado,
    sinCuenta: [...sinCuenta],
    cuentaInactiva: [...cuentaInactiva],
    totalDebe: deCentavos(totalDebe),
    totalHaber: deCentavos(totalHaber),
    cuadra: totalDebe === totalHaber,
  };
}

function lineaExtraNoVacia<T extends { debe: number; haber: number }>(extras: T[]): T[] {
  return extras.filter((e) => aCentavos(e.debe) !== 0 || aCentavos(e.haber) !== 0);
}

/**
 * Líneas definitivas de un asiento. Falla con un error claro si algún código
 * usado no tiene cuenta, si su cuenta quedó inactiva o agrupadora, o si el
 * resultado no cuadra: mejor detenerse que contabilizar a medias.
 */
export async function construirLineasPorCodigo(
  cliente: PoolClient,
  partidas: Partida[],
  lineasExtra: LineaAsiento[] = [],
): Promise<LineaAsiento[]> {
  const previa = await previsualizarLineasPorCodigo(cliente, partidas, lineasExtra);

  if (previa.sinCuenta.length) {
    throw new ErrorCodigosTransaccion(
      "codigo_sin_cuenta",
      `Estos códigos de transacción no tienen cuenta asignada: ${previa.sinCuenta.join(", ")}. Asígnalos en Configuración contable > Catálogo.`,
      previa.sinCuenta,
    );
  }
  if (previa.cuentaInactiva.length) {
    throw new ErrorCodigosTransaccion(
      "cuenta_no_usable",
      `La cuenta de estos códigos está inactiva o no admite movimientos: ${previa.cuentaInactiva.join(", ")}. Asígnales otra cuenta.`,
      previa.cuentaInactiva,
    );
  }
  if (!previa.cuadra) {
    // Se listan los códigos con su lado para que se vea cuál está al revés.
    const detalle = previa.lineas
      .filter((l) => l.codigos.length)
      .map((l) => `${[...new Set(l.codigos)].join("+")} (${l.debe > 0 ? "débito" : "crédito"})`)
      .join(", ");
    throw new ErrorCodigosTransaccion(
      "asiento_descuadrado",
      `El asiento no cuadra: débito ${previa.totalDebe.toFixed(2)} y crédito ${previa.totalHaber.toFixed(2)}. Revisa el lado de: ${detalle}.`,
      previa.lineas.flatMap((l) => l.codigos),
    );
  }
  // Tras las comprobaciones toda línea tiene cuenta.
  return previa.lineas.map(({ cuenta_id, debe, haber, descripcion }) => ({
    cuenta_id: cuenta_id as string, debe, haber, descripcion,
  }));
}
