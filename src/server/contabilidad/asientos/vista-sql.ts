import { getLocale } from "next-intl/server";

import { consultar, consultarUna } from "@/lib/db";
import { definicionDe, textoEn, type NaturalezaCodigo } from "@/lib/contabilidad/codigos-transaccion";
import {
  armarVista,
  type ExtrasVista,
  type LineaVista,
  type ProblemaAsiento,
  type VistaAsiento,
} from "@/lib/contabilidad/vista-asiento";

/**
 * Vista previa del asiento de los procesos que contabiliza una FUNCIÓN SQL
 * (facturas, pagos, recibos, transferencias, reposición de caja…).
 *
 * El patrón es: cada proceso tiene una función SQL pura `contabilidad.lineas_<proceso>(...)`
 * que devuelve las líneas como jsonb (armadas con `contabilidad.linea_por_codigo`) y
 * la función que contabiliza llama a esa MISMA función antes de `crear_asiento`. Así
 * lo que ve la persona en «Asiento» es exactamente lo que se va a registrar.
 *
 * SEGURIDAD: no comprueba permisos; el llamador debe haber hecho `requerirPermiso`.
 */

export type LineaSql = { cuenta_id: string | null; debe: number | string; haber: number | string; descripcion?: string | null };

/** Traduce el error de `linea_por_codigo` (`clave:CODIGO`) a un problema de la vista. */
export function problemaDeErrorSql(error: unknown): ProblemaAsiento {
  const mensaje = error instanceof Error ? error.message : String(error);
  const m = /(codigo_sin_cuenta|cuenta_no_valida|monto_invalido):([A-Z0-9_]+)/.exec(mensaje);
  if (!m) return { clave: "otro", detalle: mensaje };
  const clave = m[1] === "codigo_sin_cuenta" ? "codigo_sin_cuenta" : m[1] === "cuenta_no_valida" ? "cuenta_inactiva" : "monto_invalido";
  return { clave, codigo: m[2] };
}

/** Convierte líneas crudas de una función SQL en la vista común, con cuenta y código resueltos. */
export async function vistaDeLineasSql(
  lineas: readonly LineaSql[],
  extras: Partial<Omit<ExtrasVista, "estado">> & { locale?: string } = {},
  problemas: ProblemaAsiento[] = [],
): Promise<VistaAsiento> {
  const idioma = extras.locale ?? (await getLocale());
  const ids = [...new Set(lineas.map((l) => l.cuenta_id).filter((x): x is string => Boolean(x)))];
  const cuentas = ids.length
    ? await consultar<{ id: string; codigo: string; nombre: string }>(
        `SELECT id, codigo, nombre FROM contabilidad.cuenta_contable WHERE id = ANY($1::uuid[])`,
        [ids],
      )
    : [];
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const configurados = ids.length
    ? await consultar<{ codigo: string; naturaleza: NaturalezaCodigo; cuenta_id: string }>(
        `SELECT codigo, naturaleza, cuenta_id FROM contabilidad.codigo_transaccion WHERE cuenta_id = ANY($1::uuid[])`,
        [ids],
      )
    : [];

  const vistas: LineaVista[] = lineas.map((l) => {
    const debe = Number(l.debe);
    const lado: NaturalezaCodigo = debe > 0 ? "debito" : "credito";
    const cuenta = l.cuenta_id ? porId.get(l.cuenta_id) : undefined;
    const codigos = configurados.filter((c) => c.cuenta_id === l.cuenta_id && c.naturaleza === lado).map((c) => c.codigo);
    return {
      cuentaId: l.cuenta_id ?? undefined,
      cuentaCodigo: cuenta?.codigo,
      cuentaNombre: cuenta?.nombre,
      codigoTransaccion: codigos.length ? codigos.join(", ") : undefined,
      nombreCodigo: codigos.length
        ? codigos.map((c) => { const d = definicionDe(c); return d ? textoEn(d.nombre, idioma) : c; }).join(" · ")
        : undefined,
      debe,
      haber: Number(l.haber),
      descripcion: l.descripcion ?? undefined,
    };
  });
  return armarVista(vistas, problemas, { estado: "previa", ...extras });
}

/**
 * Ejecuta `contabilidad.<funcion>(parametros…)` —una función SQL pura que devuelve
 * un jsonb de líneas— y arma la vista previa. Si la función falla por un código sin
 * cuenta, el error va a `problemas` en vez de lanzarse: así «Asiento» sirve justo
 * para encontrar lo que falta. El nombre se valida contra una lista cerrada de
 * caracteres: va interpolado porque un identificador no se puede parametrizar.
 */
export async function vistaDeFuncionSql(
  funcion: string,
  parametros: readonly unknown[],
  extras: Partial<Omit<ExtrasVista, "estado">> & { locale?: string } = {},
): Promise<VistaAsiento> {
  if (!/^contabilidad\.lineas_[a-z0-9_]+$/.test(funcion)) {
    throw new Error("Función de líneas no válida.");
  }
  const marcas = parametros.map((_, i) => `$${i + 1}`).join(", ");
  try {
    const fila = await consultarUna<{ lineas: LineaSql[] }>(`SELECT ${funcion}(${marcas}) AS lineas`, [...parametros]);
    return vistaDeLineasSql(fila?.lineas ?? [], extras);
  } catch (error) {
    return vistaDeLineasSql([], extras, [problemaDeErrorSql(error)]);
  }
}
