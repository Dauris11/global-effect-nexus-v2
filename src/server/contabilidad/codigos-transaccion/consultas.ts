import { consultar } from "@/lib/db";
import {
  CODIGOS_TRANSACCION,
  ETIQUETA_MODULO,
  textoEn,
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
  cuenta: { id: string; codigo: string; nombre: string; usable: boolean } | null;
};

/**
 * La lista sale del código; la base solo aporta lo configurado. Un código sin
 * fila es válido: usa su naturaleza por defecto y está sin cuenta.
 */
export async function listarCodigos(locale: string): Promise<CodigoConfigurado[]> {
  const filas = await consultar<{
    codigo: string; naturaleza: NaturalezaCodigo;
    cuenta_id: string | null; cuenta_codigo: string | null; cuenta_nombre: string | null; usable: boolean | null;
  }>(
    `SELECT t.codigo, t.naturaleza, t.cuenta_id,
            c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre,
            (c.activa AND c.admite_movimiento) AS usable
       FROM contabilidad.codigo_transaccion t
       LEFT JOIN contabilidad.cuenta_contable c ON c.id = t.cuenta_id`,
  );
  const guardado = new Map(filas.map((f) => [f.codigo, f]));

  return CODIGOS_TRANSACCION.map((d) => {
    const f = guardado.get(d.codigo);
    return {
      codigo: d.codigo,
      modulo: d.modulo,
      moduloEtiqueta: textoEn(ETIQUETA_MODULO[d.modulo], locale),
      proceso: d.proceso,
      nombre: textoEn(d.nombre, locale),
      ayuda: textoEn(d.ayuda, locale),
      naturaleza: f?.naturaleza ?? d.naturaleza,
      naturalezaDefecto: d.naturaleza,
      usaDefecto: !f || f.naturaleza === d.naturaleza,
      cuenta: f?.cuenta_id
        ? { id: f.cuenta_id, codigo: f.cuenta_codigo!, nombre: f.cuenta_nombre!, usable: !!f.usable }
        : null,
    };
  });
}
