import type { PoolClient } from "pg";
import { getLocale } from "next-intl/server";

import { consultar, consultarUna } from "@/lib/db";
import { definicionDe, textoEn, type NaturalezaCodigo } from "@/lib/contabilidad/codigos-transaccion";
import {
  armarVista,
  aCentavos,
  type ExtrasVista,
  type LineaVista,
  type ProblemaAsiento,
  type VistaAsiento,
} from "@/lib/contabilidad/vista-asiento";
import {
  ErrorCodigosTransaccion,
  previsualizarLineasPorCodigo,
  type Partida,
} from "@/server/contabilidad/codigos-transaccion/asiento";

/**
 * Vista del asiento para la opción «Asiento» de cada proceso.
 *
 * SEGURIDAD: estas funciones NO comprueban permisos. Quien las llama (la acción
 * de servidor del módulo) debe haber hecho antes `requerirPermiso("contabilidad.leer")`
 * —o el permiso propio del proceso, como `contabilidad.nomina`—. Mostrar un
 * asiento es leer contabilidad; esconder el botón no es control de acceso.
 */

export type LineaExtraVista = {
  cuenta_id: string | null;
  debe: number;
  haber: number;
  descripcion: string;
};

export type ExtrasPrevia = Partial<Omit<ExtrasVista, "estado">> & {
  /** Líneas fuera de los códigos (p. ej. el banco del desembolso). */
  lineasExtra?: LineaExtraVista[];
  /** Idioma de los nombres de código; por defecto el de la petición. */
  locale?: string;
};

type CuentaFila = { id: string; codigo: string; nombre: string; activa: boolean; admite_movimiento: boolean };

async function cuentasPorId(ids: string[]): Promise<Map<string, CuentaFila>> {
  if (ids.length === 0) return new Map();
  const filas = await consultar<CuentaFila>(
    `SELECT id, codigo, nombre, activa, admite_movimiento
       FROM contabilidad.cuenta_contable WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return new Map(filas.map((f) => [f.id, f]));
}

/**
 * Asiento que generaría un proceso, calculado con el motor de códigos de
 * transacción SIN escribir nada. Lo que falta no lanza: va a `problemas`.
 *
 * Un código sin cuenta aparece igualmente como línea (sin cuenta, en el lado
 * por el que se configuró) para que el descuadre que provoca se vea en los
 * totales y no solo en el aviso.
 */
export async function vistaDeLineasPorCodigo(
  cliente: PoolClient,
  partidas: Partida[],
  extras: ExtrasPrevia = {},
): Promise<VistaAsiento> {
  const locale = extras.locale ?? (await getLocale());
  const problemas: ProblemaAsiento[] = [];
  const { lineasExtra = [], locale: _locale, ...meta } = extras;
  void _locale;
  const encabezado = { ...meta, estado: "previa" as const };

  let previa;
  try {
    previa = await previsualizarLineasPorCodigo(cliente, partidas, lineasExtra);
  } catch (e) {
    // Código desconocido o monto inválido: el motor no puede ni sumar, así que
    // se avisa y se muestran solo las líneas extra.
    if (!(e instanceof ErrorCodigosTransaccion)) throw e;
    problemas.push(
      e.clave === "monto_invalido"
        ? { clave: "monto_invalido", codigo: e.codigos[0], detalle: e.message }
        : { clave: "otro", codigo: e.codigos[0], detalle: e.message },
    );
    return armarVista([], problemas, encabezado);
  }

  const cuentas = await cuentasPorId(previa.lineas.map((l) => l.cuenta_id).filter((x): x is string => !!x));
  const nombreDe = (codigo: string) => {
    const d = definicionDe(codigo);
    return d ? textoEn(d.nombre, locale) : codigo;
  };

  const lineas: LineaVista[] = previa.lineas.map((l) => {
    const cuenta = l.cuenta_id ? cuentas.get(l.cuenta_id) : undefined;
    const codigos = [...new Set(l.codigos)];
    return {
      cuentaId: l.cuenta_id ?? undefined,
      cuentaCodigo: cuenta?.codigo,
      cuentaNombre: cuenta?.nombre,
      codigoTransaccion: codigos.length ? codigos.join(", ") : undefined,
      nombreCodigo: codigos.length ? codigos.map(nombreDe).join(" · ") : undefined,
      debe: l.debe,
      haber: l.haber,
      descripcion: l.descripcion || undefined,
    };
  });

  // Códigos sin cuenta: se listan con su monto en el lado configurado.
  if (previa.sinCuenta.length) {
    const filas = await consultar<{ codigo: string; naturaleza: NaturalezaCodigo }>(
      `SELECT codigo, naturaleza FROM contabilidad.codigo_transaccion WHERE codigo = ANY($1::text[])`,
      [previa.sinCuenta],
    );
    const configurada = new Map(filas.map((f) => [f.codigo, f.naturaleza]));
    for (const codigo of previa.sinCuenta) {
      problemas.push({ clave: "codigo_sin_cuenta", codigo });
      const centavos = partidas.filter((p) => p.codigo === codigo).reduce((s, p) => s + aCentavos(p.monto), 0);
      const lado = (configurada.get(codigo) ?? definicionDe(codigo)!.naturaleza) === "debito" ? "debe" : "haber";
      lineas.push({
        codigoTransaccion: codigo,
        nombreCodigo: nombreDe(codigo),
        debe: lado === "debe" ? centavos / 100 : 0,
        haber: lado === "haber" ? centavos / 100 : 0,
        descripcion: partidas.find((p) => p.codigo === codigo)?.descripcion,
      });
    }
  }

  // El motor junta «inactiva» y «agrupadora»; aquí se distinguen para decir qué corregir.
  for (const l of previa.lineas) {
    const cuenta = l.cuenta_id ? cuentas.get(l.cuenta_id) : undefined;
    if (!cuenta || l.codigos.length === 0) continue;
    for (const codigo of new Set(l.codigos)) {
      if (!cuenta.activa) problemas.push({ clave: "cuenta_inactiva", codigo, detalle: `${cuenta.codigo} · ${cuenta.nombre}` });
      else if (!cuenta.admite_movimiento) problemas.push({ clave: "cuenta_agrupadora", codigo, detalle: `${cuenta.codigo} · ${cuenta.nombre}` });
    }
  }

  return armarVista(lineas, problemas, encabezado);
}

/**
 * Asiento ya contabilizado, tal como quedó en el libro. `codigoTransaccion` se
 * deduce: es el código configurado hoy a la cuenta de la línea cuyo lado
 * coincide con el de la línea (el asiento no guarda de qué código vino).
 */
export async function vistaDeAsientoContabilizado(asientoId: string, locale?: string): Promise<VistaAsiento> {
  const idioma = locale ?? (await getLocale());
  const cab = await consultarUna<{
    id: string; numero: string; fecha: string; concepto: string; anulado: boolean; motivo_anulacion: string | null;
  }>(
    `SELECT id, numero::text, to_char(fecha, 'YYYY-MM-DD') AS fecha, concepto, anulado, motivo_anulacion
       FROM contabilidad.asiento WHERE id = $1`,
    [asientoId],
  );
  if (!cab) throw new Error("Asiento no encontrado.");

  const filas = await consultar<{
    cuenta_id: string; cuenta_codigo: string; cuenta_nombre: string; debe: string; haber: string; descripcion: string | null;
  }>(
    `SELECT l.cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre, l.debe::text, l.haber::text, l.descripcion
       FROM contabilidad.asiento_linea l
       JOIN contabilidad.cuenta_contable c ON c.id = l.cuenta_id
      WHERE l.asiento_id = $1
      ORDER BY (l.debe > 0) DESC, c.codigo`,
    [asientoId],
  );
  const codigosPorCuenta = new Map<string, Array<{ codigo: string; naturaleza: NaturalezaCodigo }>>();
  if (filas.length) {
    const configurados = await consultar<{ codigo: string; naturaleza: NaturalezaCodigo; cuenta_id: string }>(
      `SELECT codigo, naturaleza, cuenta_id FROM contabilidad.codigo_transaccion WHERE cuenta_id = ANY($1::uuid[])`,
      [filas.map((f) => f.cuenta_id)],
    );
    for (const c of configurados) {
      codigosPorCuenta.set(c.cuenta_id, [...(codigosPorCuenta.get(c.cuenta_id) ?? []), c]);
    }
  }

  const lineas: LineaVista[] = filas.map((f) => {
    const debe = Number(f.debe);
    const lado: NaturalezaCodigo = debe > 0 ? "debito" : "credito";
    const coinciden = (codigosPorCuenta.get(f.cuenta_id) ?? []).filter((c) => c.naturaleza === lado).map((c) => c.codigo);
    return {
      cuentaId: f.cuenta_id,
      cuentaCodigo: f.cuenta_codigo,
      cuentaNombre: f.cuenta_nombre,
      codigoTransaccion: coinciden.length ? coinciden.join(", ") : undefined,
      nombreCodigo: coinciden.length
        ? coinciden.map((c) => { const d = definicionDe(c); return d ? textoEn(d.nombre, idioma) : c; }).join(" · ")
        : undefined,
      debe,
      haber: Number(f.haber),
      descripcion: f.descripcion ?? undefined,
    };
  });

  const problemas: ProblemaAsiento[] = cab.anulado
    ? [{ clave: "otro", detalle: cab.motivo_anulacion ?? undefined }]
    : [];
  return armarVista(lineas, problemas, {
    estado: "contabilizado",
    asientoId: cab.id,
    numero: cab.numero,
    fecha: cab.fecha,
    descripcion: cab.concepto,
  });
}
