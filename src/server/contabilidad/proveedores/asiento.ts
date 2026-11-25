import { getLocale, getTranslations } from "next-intl/server";

import { consultarUna } from "@/lib/db";
import { definicionDe, textoEn } from "@/lib/contabilidad/codigos-transaccion";
import type { ProblemaAsiento, VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { vistaDeLineasSql, type LineaSql } from "@/server/contabilidad/asientos/vista-sql";

/**
 * Vista previa del asiento de facturas y pagos a proveedores.
 *
 * Las funciones SQL `lineas_aprobar_factura` y `lineas_pago_cxp` (0118) se
 * llaman aquí con `p_previa = true`: un código sin cuenta no las detiene sino
 * que devuelve la línea sin cuenta con su `problema`. Así «Asiento» enumera TODO
 * lo que falta de una vez (cuentas por pagar, retenciones…) en vez de solo el
 * primero, y el cálculo de montos es el mismo que usa el asiento real.
 *
 * SEGURIDAD: no comprueba permisos; la acción que lo llama ya hizo `requerirPermiso`.
 */

type LineaPrevia = LineaSql & { codigo?: string | null; problema?: string | null };

const CLAVE_DE_PROBLEMA: Record<string, ProblemaAsiento["clave"]> = {
  codigo_sin_cuenta: "codigo_sin_cuenta",
  cuenta_no_valida: "cuenta_inactiva",
  monto_invalido: "monto_invalido",
};

async function vistaDePrevia(
  consulta: string,
  parametros: unknown[],
  descripcion: string | undefined,
): Promise<VistaAsiento> {
  const locale = await getLocale();
  const fila = await consultarUna<{ lineas: LineaPrevia[] }>(consulta, parametros);
  const lineas = fila?.lineas ?? [];

  const problemas: ProblemaAsiento[] = [];
  const sinCategoria = lineas.some((l) => l.problema === "categoria_sin_cuenta");
  for (const l of lineas) {
    const clave = l.problema ? CLAVE_DE_PROBLEMA[l.problema] : undefined;
    if (clave) problemas.push({ clave, codigo: l.codigo ?? undefined });
  }
  if (sinCategoria) {
    const t = await getTranslations("contab.error");
    problemas.push({ clave: "otro", detalle: t("categoria_sin_cuenta") });
  }

  const vista = await vistaDeLineasSql(lineas, { locale, descripcion }, problemas);
  // Una línea sin cuenta no puede deducir su código de la configuración: se lo
  // ponemos nosotros para que se vea qué código hay que asignar.
  vista.lineas.forEach((l, i) => {
    const codigo = lineas[i]?.codigo;
    if (codigo && !l.cuentaId) {
      const d = definicionDe(codigo);
      l.codigoTransaccion = codigo;
      l.nombreCodigo = d ? textoEn(d.nombre, locale) : codigo;
    }
  });
  return vista;
}

/** Asiento que generaría aprobar la factura (borrador). */
export async function vistaPreviaDeFactura(facturaId: string): Promise<VistaAsiento> {
  const concepto = await consultarUna<{ t: string | null }>(
    `SELECT contabilidad.concepto_asiento_factura($1) AS t`,
    [facturaId],
  );
  return vistaDePrevia(
    `SELECT contabilidad.lineas_aprobar_factura($1, true) AS lineas`,
    [facturaId],
    concepto?.t ?? undefined,
  );
}

/** Asiento que generaría pagar `monto` de la cuenta por pagar desde `cuentaBancariaId`. */
export async function vistaPreviaDePagoCxp(
  cxpId: string,
  cuentaBancariaId: string,
  monto: string,
  tasa: string | null,
): Promise<VistaAsiento> {
  return vistaDePrevia(
    `SELECT contabilidad.lineas_pago_cxp($1, $2, $3::numeric, $4::numeric, true) AS lineas`,
    [cxpId, cuentaBancariaId, monto, tasa],
    undefined,
  );
}

/**
 * Convierte `codigo_sin_cuenta:CODIGO` / `cuenta_no_valida:CODIGO` (lo que lanza
 * `linea_por_codigo`) en un estado que la pantalla traduce, con el nombre del
 * código en el idioma de la petición. Devuelve null si el error es otro.
 */
export async function errorDeCodigoSql(
  error: unknown,
): Promise<{ estado: "proveedor_codigo_sin_cuenta" | "proveedor_cuenta_no_valida"; codigo: string } | null> {
  const mensaje = error instanceof Error ? error.message : String(error);
  const m = /(codigo_sin_cuenta|cuenta_no_valida):([A-Z0-9_]+)/.exec(mensaje);
  if (!m) return null;
  const d = definicionDe(m[2]);
  const nombre = d ? `${textoEn(d.nombre, await getLocale())} (${m[2]})` : m[2];
  return {
    estado: m[1] === "codigo_sin_cuenta" ? "proveedor_codigo_sin_cuenta" : "proveedor_cuenta_no_valida",
    codigo: nombre,
  };
}
