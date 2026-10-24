import { consultar, consultarUna } from "@/lib/db";

/**
 * Configuración contable (§4.13): la entidad, los parámetros legales con
 * vigencia, los períodos y el catálogo de cuentas.
 *
 * Las cifras salen como TEXTO, igual que en el resto del módulo: una tasa
 * guardada como 0.0287 que pasara por un float podría pintarse 2.8699999.
 * La conversión de fracción a porcentaje la hace la base con NUMERIC.
 */

export const PESTANAS_CONFIG = ["entidad", "parametros", "periodos", "catalogo"] as const;
export type PestanaConfig = (typeof PESTANAS_CONFIG)[number];

export function esPestanaConfig(valor: unknown): valor is PestanaConfig {
  return typeof valor === "string" && (PESTANAS_CONFIG as readonly string[]).includes(valor);
}

// ----------------------------------------------------------------
// Entidad
// ----------------------------------------------------------------

export type Entidad = {
  razonSocial: string;
  nombreComercial: string | null;
  rnc: string | null;
  inicioEjercicioMes: number;
  decimales: number;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  emisionHabilitada: boolean;
  actualizadoPor: string | null;
  actualizadoEn: string;
};

export async function entidad(): Promise<Entidad | null> {
  return consultarUna<Entidad>(
    `SELECT e.razon_social AS "razonSocial", e.nombre_comercial AS "nombreComercial", e.rnc,
            e.inicio_ejercicio_mes AS "inicioEjercicioMes", e.decimales, e.direccion,
            e.telefono, e.email, e.emision_comprobantes_habilitada AS "emisionHabilitada",
            u.nombre AS "actualizadoPor",
            to_char(e.actualizado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI')
              AS "actualizadoEn"
       FROM contabilidad.entidad e
       LEFT JOIN usuario u ON u.id = e.actualizado_por
      WHERE e.id`,
  );
}

// ----------------------------------------------------------------
// Parámetros legales
// ----------------------------------------------------------------

/**
 * Forma del valor de un parámetro, decidida por la base para que la
 * pantalla y la server action la lean igual:
 *   · `tasa`: `{"tasa": n, ...}` o un número suelto en una clave de tasa.
 *   · `monto`: `{"monto": n}` o un número suelto (topes, salario mínimo).
 *   · `escala`: la escala del ISR, que solo se muestra.
 *   · `otro`: cualquier otra estructura; tampoco se edita desde aquí.
 * Un número suelto en NULL es un parámetro cargado sin cifra (pendiente de
 * confirmar con el contador) y conserva la forma que dice su clave.
 */
export const FORMA_PARAMETRO_SQL = `CASE
    WHEN p.clave = 'isr.escala' THEN 'escala'
    WHEN jsonb_typeof(p.valor) = 'object' AND p.valor ? 'tasa' THEN 'tasa'
    WHEN jsonb_typeof(p.valor) = 'object' AND p.valor ? 'monto' THEN 'monto'
    WHEN jsonb_typeof(p.valor) IN ('number', 'null') AND p.clave LIKE '%tasa%' THEN 'tasa'
    WHEN jsonb_typeof(p.valor) IN ('number', 'null') THEN 'monto'
    ELSE 'otro'
  END`;

export type FormaParametro = "tasa" | "monto" | "escala" | "otro";

export type TramoIsr = { desde: string; hasta: string | null; tasa: string; cuota: string };

export type VigenciaParametro = {
  id: string;
  desde: string;
  /** Primer día en que YA NO vale (exclusivo). */
  hasta: string | null;
  /** Tasa en porcentaje ("18") o monto ("464460"); null si no tiene cifra. */
  cifra: string | null;
  tramos: TramoIsr[] | null;
  fuente: string | null;
  nota: string | null;
  vigenteHoy: boolean;
};

export type Parametro = {
  clave: string;
  grupo: string;
  forma: FormaParametro;
  /** Lo que devuelve `parametro_en(clave)` hoy; null si hoy no rige ninguna fila. */
  hoy: VigenciaParametro | null;
  historial: VigenciaParametro[];
};

type FilaParametro = VigenciaParametro & { clave: string; forma: FormaParametro };

export async function parametros(): Promise<Parametro[]> {
  // `vigenteHoy` compara con `parametro_en`: es la misma función que usan
  // los cálculos, así la pantalla no puede decir "vigente" de una fila que
  // el cálculo no usaría.
  const filas = await consultar<FilaParametro>(
    `SELECT p.id, p.clave, ${FORMA_PARAMETRO_SQL} AS forma,
            to_char(p.vigente_desde, 'YYYY-MM-DD') AS desde,
            to_char(p.vigente_hasta, 'YYYY-MM-DD') AS hasta,
            CASE
              WHEN jsonb_typeof(n.num) <> 'number' THEN NULL
              WHEN ${FORMA_PARAMETRO_SQL} = 'tasa' THEN trim_scale((n.num #>> '{}')::numeric * 100)::text
              ELSE trim_scale((n.num #>> '{}')::numeric)::text
            END AS cifra,
            CASE WHEN p.clave = 'isr.escala' THEN (
              SELECT json_agg(json_build_object(
                       'desde', t.tramo ->> 'desde',
                       'hasta', t.tramo ->> 'hasta',
                       'tasa', trim_scale((t.tramo ->> 'tasa')::numeric * 100)::text,
                       'cuota', coalesce(t.tramo ->> 'cuota_fija', '0'))
                     ORDER BY t.orden)
                FROM jsonb_array_elements(p.valor -> 'tramos') WITH ORDINALITY AS t(tramo, orden))
            END AS tramos,
            p.fuente, p.nota,
            (p.vigente_desde <= CURRENT_DATE
              AND (p.vigente_hasta IS NULL OR p.vigente_hasta > CURRENT_DATE)
              AND p.valor IS NOT DISTINCT FROM contabilidad.parametro_en(p.clave, CURRENT_DATE))
              AS "vigenteHoy"
       FROM contabilidad.parametro p
      CROSS JOIN LATERAL (
        SELECT CASE WHEN jsonb_typeof(p.valor) = 'object'
                    THEN coalesce(p.valor -> 'tasa', p.valor -> 'monto')
                    ELSE p.valor END AS num
      ) n
      ORDER BY p.clave, p.vigente_desde DESC`,
  );

  const porClave = new Map<string, Parametro>();
  for (const { clave, forma, ...vigencia } of filas) {
    let parametro = porClave.get(clave);
    if (!parametro) {
      parametro = { clave, grupo: clave.split(".")[0], forma, hoy: null, historial: [] };
      porClave.set(clave, parametro);
    }
    parametro.historial.push(vigencia);
    if (vigencia.vigenteHoy && !parametro.hoy) parametro.hoy = vigencia;
  }
  return [...porClave.values()];
}

// ----------------------------------------------------------------
// Períodos
// ----------------------------------------------------------------

export type Periodo = {
  id: string;
  anio: number;
  mes: number;
  estado: "abierto" | "cerrado";
  cerradoPor: string | null;
  cerradoEn: string | null;
  reabiertoPor: string | null;
  reabiertoEn: string | null;
  motivo: string | null;
};

export async function periodos(): Promise<Periodo[]> {
  return consultar<Periodo>(
    `SELECT p.id, p.anio, p.mes, p.estado,
            uc.nombre AS "cerradoPor",
            to_char(p.cerrado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS "cerradoEn",
            ur.nombre AS "reabiertoPor",
            to_char(p.reabierto_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS "reabiertoEn",
            p.motivo_reapertura AS motivo
       FROM contabilidad.periodo_contable p
       LEFT JOIN usuario uc ON uc.id = p.cerrado_por
       LEFT JOIN usuario ur ON ur.id = p.reabierto_por
      ORDER BY p.anio DESC, p.mes DESC`,
  );
}

// ----------------------------------------------------------------
// Catálogo de cuentas
// ----------------------------------------------------------------

export const TIPOS_CUENTA = ["activo", "pasivo", "patrimonio", "ingreso", "gasto"] as const;
export type TipoCuenta = (typeof TIPOS_CUENTA)[number];

export type CuentaCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  padreId: string | null;
  admiteMovimiento: boolean;
  activa: boolean;
  nivel: number;
  /** Líneas de asiento que la usan: con alguna, ya no puede tener hijas. */
  movimientos: number;
  /** Debe − haber, en DOP. */
  saldo: string;
};

export async function catalogo(): Promise<CuentaCatalogo[]> {
  // El árbol se arma en la base con la ruta de códigos de los ancestros:
  // ordenar por el código suelto pondría "10" antes que "2" el día que el
  // catálogo tenga diez cuentas raíz.
  return consultar<CuentaCatalogo>(
    `WITH RECURSIVE arbol AS (
       SELECT c.id, ARRAY[c.codigo] AS ruta, 0 AS nivel
         FROM contabilidad.cuenta_contable c
        WHERE c.padre_id IS NULL
       UNION ALL
       SELECT h.id, a.ruta || h.codigo, a.nivel + 1
         FROM contabilidad.cuenta_contable h
         JOIN arbol a ON a.id = h.padre_id
     ),
     uso AS (
       SELECT l.cuenta_id, count(*)::int AS n, sum(l.debe) - sum(l.haber) AS saldo
         FROM contabilidad.asiento_linea l
        GROUP BY l.cuenta_id
     )
     SELECT c.id, c.codigo, c.nombre, c.tipo, c.padre_id AS "padreId",
            c.admite_movimiento AS "admiteMovimiento", c.activa, a.nivel,
            coalesce(u.n, 0) AS movimientos, coalesce(u.saldo, 0)::text AS saldo
       FROM arbol a
       JOIN contabilidad.cuenta_contable c ON c.id = a.id
       LEFT JOIN uso u ON u.cuenta_id = c.id
      ORDER BY a.ruta`,
  );
}
