import { consultar } from "@/lib/db";
import {
  CODIGOS_TRANSACCION,
  ETIQUETA_MODULO,
  efectoNaturalCuenta,
  textoEn,
  type EfectoCodigo,
  type ModuloCodigo,
  type NaturalezaCodigo,
} from "@/lib/contabilidad/codigos-transaccion";

/** Un código de la lista unido a lo que se configuró en pantalla. */
export type CodigoConfigurado = {
  codigo: string;
  modulo: ModuloCodigo;
  moduloEtiqueta: string;
  proceso: string;
  nombre: string;
  ayuda: string;
  /** Lado que rige: el configurado o, si nadie lo tocó, el del código. */
  naturaleza: NaturalezaCodigo;
  naturalezaDefecto: NaturalezaCodigo;
  usaDefecto: boolean;
  /** Si el lado elegido aumenta o disminuye el saldo de la cuenta. */
  efecto: EfectoCodigo;
  cuenta: { id: string; codigo: string; nombre: string; tipo: string; usable: boolean } | null;
};

/**
 * La lista sale del código; la base solo aporta lo configurado. Un código sin
 * fila es válido: usa su naturaleza por defecto y está sin cuenta.
 */
export async function listarCodigos(locale: string): Promise<CodigoConfigurado[]> {
  const filas = await consultar<{
    codigo: string;
    naturaleza: NaturalezaCodigo;
    efecto: EfectoCodigo | null;
    cuenta_id: string | null;
    cuenta_codigo: string | null;
    cuenta_nombre: string | null;
    cuenta_tipo: string | null;
    cuenta_naturaleza: string | null;
    cuenta_compensatoria: boolean | null;
    usable: boolean | null;
  }>(
    `SELECT t.codigo, t.naturaleza, t.efecto, t.cuenta_id,
            c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre,
            c.tipo AS cuenta_tipo, c.naturaleza AS cuenta_naturaleza,
            c.es_compensatoria AS cuenta_compensatoria,
            (c.activa AND c.admite_movimiento) AS usable
       FROM contabilidad.codigo_transaccion t
       LEFT JOIN contabilidad.cuenta_contable c ON c.id = t.cuenta_id`,
  );
  const guardado = new Map(filas.map((f) => [f.codigo, f]));

  return CODIGOS_TRANSACCION.map((d) => {
    const f = guardado.get(d.codigo);
    const naturaleza = f?.naturaleza ?? d.naturaleza;
    const cuenta = f?.cuenta_id
      ? {
          id: f.cuenta_id,
          codigo: f.cuenta_codigo!,
          nombre: f.cuenta_nombre!,
          tipo: f.cuenta_tipo!,
          usable: !!f.usable,
        }
      : null;
    const efecto =
      f?.efecto ??
      efectoNaturalCuenta(
        naturaleza,
        f?.cuenta_id
          ? { tipo: f.cuenta_tipo, naturaleza: f.cuenta_naturaleza, esCompensatoria: f.cuenta_compensatoria }
          : null,
      );
    return {
      codigo: d.codigo,
      modulo: d.modulo,
      moduloEtiqueta: textoEn(ETIQUETA_MODULO[d.modulo], locale),
      proceso: d.proceso,
      nombre: textoEn(d.nombre, locale),
      ayuda: textoEn(d.ayuda, locale),
      naturaleza,
      naturalezaDefecto: d.naturaleza,
      usaDefecto: !f || f.naturaleza === d.naturaleza,
      efecto,
      cuenta,
    };
  });
}
