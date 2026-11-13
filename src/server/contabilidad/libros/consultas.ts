import { consultar, consultarUna } from "@/lib/db";
import { esFechaIso } from "@/lib/contabilidad/formato";

/**
 * Libros contables: diario, mayor y balanza de comprobación.
 *
 * Los tres salen solo de `asiento` y `asiento_linea`, que es lo único que
 * la partida doble garantiza cuadrado; nunca de recibos o facturas.
 *
 * Toda suma la hace la base y los montos salen como TEXTO: un saldo corrido
 * sumado en float acaba diciendo 0.0000001 y "no cuadra". Los filtros llegan
 * de la URL, se validan aquí y lo que no sea válido se descarta.
 *
 * Solo entran los asientos PROCESADOS (0080): uno sin procesar todavía
 * no está en los libros, por decisión del departamento (Observaciones #1).
 *
 * Los libros incluyen SIEMPRE todos los asientos, anulados o no. Anular
 * nunca borra: deja el original y contabiliza su reverso en el período
 * abierto. Quitar el original y dejar el reverso restaría dos veces; y si
 * el período del original estaba cerrado, su `anulado` sigue en false. El
 * diario solo MARCA cada asiento (anulado / reverso) con la misma regla que
 * `src/server/contabilidad/asientos/consultas.ts`.
 */

export const VISTAS_LIBRO = ["diario", "mayor", "balanza"] as const;
export type VistaLibro = (typeof VISTAS_LIBRO)[number];

/** Asientos que se pintan en el diario; los totales cubren el rango entero. */
export const TOPE_DIARIO = 300;

export type FiltroLibros = {
  vista: VistaLibro;
  desde: string;
  hasta: string;
  /** `YYYY-MM` cuando la balanza se pidió por mes. */
  periodo: string | null;
  /** Mayor general: rango de cuentas mayores por código, los dos inclusive. */
  cuentaDesde: string | null;
  cuentaHasta: string | null;
  /** Balanza y mayor: mostrar también las cuentas sin saldo ni movimiento. */
  ceros: boolean;
};

/** Un código del catálogo ("1.1.02"); lo demás se descarta. */
function esCodigoCuenta(valor: string): boolean {
  return /^\d[\d.]{0,30}$/.test(valor);
}

type Crudo = Record<string, string | string[] | undefined>;

function uno(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor ?? "").trim();
}

function esVista(valor: string): valor is VistaLibro {
  return (VISTAS_LIBRO as readonly string[]).includes(valor);
}

/** Primer y último día de un `YYYY-MM`, sin pasar por la zona horaria local. */
function rangoDeMes(periodo: string): { desde: string; hasta: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodo);
  if (!m) return null;
  const ultimo = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(ultimo).padStart(2, "0")}` };
}

function mesEntero(desde: string, hasta: string): string | null {
  const mes = desde.slice(0, 7);
  const rango = rangoDeMes(mes);
  return rango && rango.desde === desde && rango.hasta === hasta ? mes : null;
}

/**
 * De `searchParams` a un filtro completo. El mes por defecto lo da
 * `CURRENT_DATE` de la base y no el reloj del servidor: el servidor de
 * Vercel vive en UTC y el día 1 a las 8 de la noche ya diría el mes siguiente.
 */
export async function leerFiltroLibros(crudo: Crudo): Promise<FiltroLibros> {
  const vista = uno(crudo.vista);
  const cuentaDesde = uno(crudo.cdesde);
  const cuentaHasta = uno(crudo.chasta);
  const periodo = uno(crudo.periodo);
  let desde = esFechaIso(uno(crudo.desde)) ? uno(crudo.desde) : null;
  let hasta = esFechaIso(uno(crudo.hasta)) ? uno(crudo.hasta) : null;

  const delMes = rangoDeMes(periodo);
  if (delMes) ({ desde, hasta } = delMes);

  if (!desde || !hasta) {
    const hoy = await consultarUna<{ desde: string; hasta: string }>(
      `SELECT to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD') AS desde,
              to_char(date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day',
                      'YYYY-MM-DD') AS hasta`,
    );
    desde ??= hoy?.desde ?? null;
    hasta ??= hoy?.hasta ?? null;
  }

  // Un rango al revés no es un error de quien consulta sino un descuido:
  // se endereza en vez de devolver un libro vacío.
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];

  return {
    vista: esVista(vista) ? vista : "diario",
    desde: desde as string,
    hasta: hasta as string,
    // Un rango que es un mes entero se nombra como mes, venga de `periodo`
    // o de las dos fechas: el título y el archivo dicen "2026-10".
    periodo: mesEntero(desde as string, hasta as string),
    cuentaDesde: esCodigoCuenta(cuentaDesde) ? cuentaDesde : null,
    cuentaHasta: esCodigoCuenta(cuentaHasta) ? cuentaHasta : null,
    // Un `anulados=1` de un enlace viejo se ignora: ya no hay qué filtrar.
    ceros: uno(crudo.ceros) === "1",
  };
}

// ── Libro diario ───────────────────────────────────────────────────────

export type LineaDiario = {
  id: string;
  /** Cuenta mayor (la madre de la auxiliar); la cuenta misma si no tiene madre. */
  mayorCodigo: string;
  mayorNombre: string;
  /** Lo que suman las auxiliares de esta mayor en este lado del asiento. */
  totalMayor: string;
  codigo: string;
  cuenta: string;
  descripcion: string | null;
  debe: string;
  haber: string;
};

/**
 * `anulado`: tiene `anulado` o un asiento posterior lo revierte.
 * `reverso`: es el contra-asiento de otro. Ninguno de los dos se excluye.
 */
export type EstadoAsientoLibro = "vigente" | "anulado" | "reverso";

export type AsientoDiario = {
  id: string;
  numero: string;
  fecha: string;
  concepto: string;
  tipo: string;
  estado: EstadoAsientoLibro;
  totalDebe: string;
  totalHaber: string;
  /** El trigger de cuadre lo impide; si un asiento llega descuadrado, la base se tocó por fuera. */
  cuadra: boolean;
  lineas: LineaDiario[];
};

export type TotalesLibro = {
  asientos: number;
  debe: string;
  haber: string;
  diferencia: string;
};

type FilaDiario = {
  asiento_id: string;
  numero: string;
  fecha: string;
  concepto: string;
  tipo: string;
  estado: EstadoAsientoLibro;
  total_debe: string;
  total_haber: string;
  linea_id: string;
  mayor_codigo: string;
  mayor_nombre: string;
  total_mayor: string;
  codigo: string;
  cuenta: string;
  descripcion: string | null;
  debe: string;
  haber: string;
};

/**
 * Asientos del rango con sus líneas, en orden de fecha y número. Dentro del
 * asiento van primero los cargos y después los abonos, que es como se lee
 * un asiento en papel. `tope` null = sin límite (la exportación).
 */
export async function libroDiario(f: FiltroLibros, tope: number | null = TOPE_DIARIO): Promise<AsientoDiario[]> {
  const filas = await consultar<FilaDiario>(
    `WITH sel AS (
       SELECT a.id, a.numero, a.fecha, a.concepto, a.tipo,
              -- Misma derivación que la lista de asientos: un reverso es un
              -- ajuste que cita al original (manuales) o un ajuste posterior
              -- con el mismo origen que un automático.
              CASE WHEN o.id IS NOT NULL THEN 'reverso'
                   WHEN a.anulado OR r.id IS NOT NULL THEN 'anulado'
                   ELSE 'vigente' END AS estado
         FROM contabilidad.asiento a
         LEFT JOIN LATERAL (
           SELECT x.id FROM contabilidad.asiento x
            WHERE x.id <> a.id AND x.tipo = 'ajuste'
              AND ((x.origen_tabla = 'contabilidad.asiento' AND x.origen_id = a.id)
                OR (a.tipo = 'automatico' AND x.origen_tabla = a.origen_tabla
                    AND x.origen_id = a.origen_id AND x.numero > a.numero))
            ORDER BY x.numero LIMIT 1
         ) r ON true
         LEFT JOIN LATERAL (
           SELECT x.id FROM contabilidad.asiento x
            WHERE a.tipo = 'ajuste' AND x.id <> a.id
              AND ((a.origen_tabla = 'contabilidad.asiento' AND x.id = a.origen_id)
                OR (x.tipo = 'automatico' AND x.origen_tabla = a.origen_tabla
                    AND x.origen_id = a.origen_id AND x.numero < a.numero))
            ORDER BY x.numero DESC LIMIT 1
         ) o ON true
        WHERE a.fecha BETWEEN $1::date AND $2::date
          AND a.procesado_en IS NOT NULL
        ORDER BY a.fecha, a.numero
        LIMIT $3
     )
     SELECT s.id AS asiento_id, s.numero::text AS numero,
            to_char(s.fecha, 'YYYY-MM-DD') AS fecha, s.concepto, s.tipo, s.estado,
            sum(l.debe) OVER (PARTITION BY s.id)::text AS total_debe,
            sum(l.haber) OVER (PARTITION BY s.id)::text AS total_haber,
            l.id AS linea_id,
            coalesce(m.codigo, c.codigo) AS mayor_codigo, coalesce(m.nombre, c.nombre) AS mayor_nombre,
            sum(l.debe + l.haber) OVER (PARTITION BY s.id, l.debe > 0, coalesce(m.id, c.id))::text AS total_mayor,
            c.codigo, c.nombre AS cuenta, l.descripcion,
            l.debe::text AS debe, l.haber::text AS haber
       FROM sel s
       JOIN contabilidad.asiento_linea l ON l.asiento_id = s.id
       JOIN contabilidad.cuenta_contable c ON c.id = l.cuenta_id
       LEFT JOIN contabilidad.cuenta_contable m ON m.id = c.padre_id
      -- Cargos antes que abonos y, dentro de cada lado, agrupado por mayor:
      -- así las auxiliares de una misma mayor quedan juntas bajo ella.
      ORDER BY s.fecha, s.numero, (l.debe > 0) DESC,
               coalesce(m.codigo, c.codigo) COLLATE "C", c.codigo COLLATE "C", l.id`,
    [f.desde, f.hasta, tope],
  );

  const asientos: AsientoDiario[] = [];
  for (const fila of filas) {
    let actual = asientos.at(-1);
    if (!actual || actual.id !== fila.asiento_id) {
      actual = {
        id: fila.asiento_id,
        numero: fila.numero,
        fecha: fila.fecha,
        concepto: fila.concepto,
        tipo: fila.tipo,
        estado: fila.estado,
        totalDebe: fila.total_debe,
        totalHaber: fila.total_haber,
        // Comparar los textos que dio la base: los dos vienen con dos decimales.
        cuadra: fila.total_debe === fila.total_haber,
        lineas: [],
      };
      asientos.push(actual);
    }
    actual.lineas.push({
      id: fila.linea_id,
      mayorCodigo: fila.mayor_codigo,
      mayorNombre: fila.mayor_nombre,
      totalMayor: fila.total_mayor,
      codigo: fila.codigo,
      cuenta: fila.cuenta,
      descripcion: fila.descripcion,
      debe: fila.debe,
      haber: fila.haber,
    });
  }
  return asientos;
}

/** Totales del rango ENTERO, no de los asientos pintados. */
export async function totalesDiario(f: FiltroLibros): Promise<TotalesLibro> {
  const fila = await consultarUna<TotalesLibro>(
    `SELECT count(DISTINCT a.id)::int AS asientos,
            coalesce(sum(l.debe), 0)::numeric(14,2)::text AS debe,
            coalesce(sum(l.haber), 0)::numeric(14,2)::text AS haber,
            (coalesce(sum(l.debe), 0) - coalesce(sum(l.haber), 0))::numeric(14,2)::text AS diferencia
       FROM contabilidad.asiento a
       JOIN contabilidad.asiento_linea l ON l.asiento_id = a.id
      WHERE a.fecha BETWEEN $1::date AND $2::date
        AND a.procesado_en IS NOT NULL`,
    [f.desde, f.hasta],
  );
  return fila ?? { asientos: 0, debe: "0.00", haber: "0.00", diferencia: "0.00" };
}

// ── Mayor general ──────────────────────────────────────────────────────

/**
 * Árbol del catálogo con la ruta de códigos desde la raíz. Ordenar por la
 * ruta y no por el código deja ver las cuentas sueltas sin padre donde
 * están de verdad: en la raíz. `COLLATE "C"` porque la intercalación del
 * idioma ignora los puntos y pondría "1.10" entre "1.1.01" y "1.1.02".
 */
const ARBOL = `arbol AS (
       SELECT c.id, 0 AS nivel, ARRAY[c.codigo COLLATE "C"] AS ruta
         FROM contabilidad.cuenta_contable c
        WHERE c.padre_id IS NULL
       UNION ALL
       SELECT h.id, a.nivel + 1, a.ruta || (h.codigo COLLATE "C")
         FROM contabilidad.cuenta_contable h
         JOIN arbol a ON h.padre_id = a.id
     )`;

/** Una cuenta mayor del selector de rango. */
export type OpcionMayor = { codigo: string; nombre: string };

/**
 * Cuenta mayor = la que tiene auxiliares (hijas que admiten movimiento).
 * Es lo que el departamento llama "cuenta mayor": "1.1.02 Bancos" frente a
 * su auxiliar "1.1.02.01 Banco Santa Cruz - DOP".
 */
export async function cuentasMayores(): Promise<OpcionMayor[]> {
  return consultar<OpcionMayor>(
    `WITH RECURSIVE ${ARBOL}
     SELECT m.codigo, m.nombre
       FROM arbol a
       JOIN contabilidad.cuenta_contable m ON m.id = a.id
      WHERE EXISTS (SELECT 1 FROM contabilidad.cuenta_contable h
                     WHERE h.padre_id = m.id AND h.admite_movimiento)
      ORDER BY a.ruta`,
  );
}

export type AuxiliarMayor = {
  id: string;
  codigo: string;
  nombre: string;
  debe: string;
  haber: string;
  saldo: string;
};

export type FilaMayor = {
  id: string;
  codigo: string;
  nombre: string;
  debe: string;
  haber: string;
  saldo: string;
  auxiliares: AuxiliarMayor[];
};

type CrudoMayor = {
  mayor_id: string;
  mayor_codigo: string;
  mayor_nombre: string;
  mayor_debe: string;
  mayor_haber: string;
  mayor_saldo: string;
  id: string;
  codigo: string;
  nombre: string;
  debe: string;
  haber: string;
  saldo: string;
  con_algo: boolean;
};

/**
 * El mayor general (Observaciones #1): sin movimientos, cada cuenta mayor
 * con su débito y crédito del rango y su saldo a la fecha `hasta`, y debajo
 * sus auxiliares con lo mismo. El saldo lleva el signo natural de cada
 * auxiliar (activo y gasto crecen por el débito); el de la mayor es la suma
 * de los de sus auxiliares, que comparten naturaleza.
 *
 * El rango de cuentas se aplica por la POSICIÓN en el árbol y no comparando
 * códigos como texto, por la misma razón del `COLLATE "C"`.
 */
export async function mayorGeneral(f: FiltroLibros): Promise<FilaMayor[]> {
  const filas = await consultar<CrudoMayor>(
    `WITH RECURSIVE ${ARBOL},
     mov AS (
       SELECT l.cuenta_id,
              coalesce(sum(l.debe) FILTER (WHERE a.fecha >= $1::date), 0) AS debe,
              coalesce(sum(l.haber) FILTER (WHERE a.fecha >= $1::date), 0) AS haber,
              coalesce(sum(l.debe), 0) AS debe_total,
              coalesce(sum(l.haber), 0) AS haber_total
         FROM contabilidad.asiento_linea l
         JOIN contabilidad.asiento a ON a.id = l.asiento_id
        WHERE a.fecha <= $2::date AND a.procesado_en IS NOT NULL
        GROUP BY l.cuenta_id
     ),
     aux AS (
       SELECT m.id AS mayor_id, m.codigo AS mayor_codigo, m.nombre AS mayor_nombre, am.ruta,
              h.id, h.codigo, h.nombre,
              coalesce(v.debe, 0) AS debe, coalesce(v.haber, 0) AS haber,
              CASE WHEN h.tipo IN ('activo', 'gasto')
                   THEN coalesce(v.debe_total, 0) - coalesce(v.haber_total, 0)
                   ELSE coalesce(v.haber_total, 0) - coalesce(v.debe_total, 0) END AS saldo,
              (v.debe_total <> 0 OR v.haber_total <> 0) IS TRUE AS con_algo
         FROM contabilidad.cuenta_contable m
         JOIN arbol am ON am.id = m.id
         JOIN contabilidad.cuenta_contable h ON h.padre_id = m.id AND h.admite_movimiento
         LEFT JOIN mov v ON v.cuenta_id = h.id
     )
     SELECT mayor_id, mayor_codigo, mayor_nombre,
            (sum(debe) OVER w)::numeric(14,2)::text AS mayor_debe,
            (sum(haber) OVER w)::numeric(14,2)::text AS mayor_haber,
            (sum(saldo) OVER w)::numeric(14,2)::text AS mayor_saldo,
            id, codigo, nombre,
            debe::numeric(14,2)::text AS debe, haber::numeric(14,2)::text AS haber,
            saldo::numeric(14,2)::text AS saldo, con_algo
       FROM aux
     WINDOW w AS (PARTITION BY mayor_id)
      ORDER BY ruta, codigo COLLATE "C"`,
    [f.desde, f.hasta],
  );

  const mayores: FilaMayor[] = [];
  for (const fila of filas) {
    let actual = mayores.at(-1);
    if (!actual || actual.id !== fila.mayor_id) {
      actual = {
        id: fila.mayor_id,
        codigo: fila.mayor_codigo,
        nombre: fila.mayor_nombre,
        debe: fila.mayor_debe,
        haber: fila.mayor_haber,
        saldo: fila.mayor_saldo,
        auxiliares: [],
      };
      mayores.push(actual);
    }
    if (f.ceros || fila.con_algo) {
      actual.auxiliares.push({
        id: fila.id,
        codigo: fila.codigo,
        nombre: fila.nombre,
        debe: fila.debe,
        haber: fila.haber,
        saldo: fila.saldo,
      });
    }
  }

  const desde = f.cuentaDesde ? mayores.findIndex((m) => m.codigo === f.cuentaDesde) : 0;
  const hasta = f.cuentaHasta ? mayores.findIndex((m) => m.codigo === f.cuentaHasta) : mayores.length - 1;
  // Un código que ya no existe no vacía el libro: se ignora ese extremo.
  const [inicio, fin] = [desde < 0 ? 0 : desde, hasta < 0 ? mayores.length - 1 : hasta].sort((a, b) => a - b);

  return mayores.slice(inicio, fin + 1).filter((m) => m.auxiliares.length > 0);
}

// ── Balanza de comprobación ────────────────────────────────────────────

export type FilaBalanza = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  /** false = cuenta de grupo: su fila es el subtotal de sus descendientes. */
  admiteMovimiento: boolean;
  debe: string;
  haber: string;
};

/**
 * Una fila por cuenta, en orden de árbol, con el débito y el crédito del
 * rango. Sin saldo anterior ni final: el departamento los pidió fuera
 * (Observaciones #1). `cierre` es la clausura del árbol (cada cuenta con
 * ella misma y con todas sus descendientes): la fila de un grupo suma lo de
 * sus hojas sin que la app recorra nada.
 */
export async function balanza(f: FiltroLibros): Promise<FilaBalanza[]> {
  return consultar<FilaBalanza>(
    `WITH RECURSIVE ${ARBOL},
     cierre AS (
       SELECT id AS ancestro, id AS descendiente FROM contabilidad.cuenta_contable
       UNION ALL
       SELECT ci.ancestro, h.id
         FROM cierre ci
         JOIN contabilidad.cuenta_contable h ON h.padre_id = ci.descendiente
     ),
     mov AS (
       SELECT l.cuenta_id, sum(l.debe) AS debe, sum(l.haber) AS haber
         FROM contabilidad.asiento_linea l
         JOIN contabilidad.asiento a ON a.id = l.asiento_id
        WHERE a.fecha BETWEEN $1::date AND $2::date AND a.procesado_en IS NOT NULL
        GROUP BY l.cuenta_id
     ),
     suma AS (
       SELECT ci.ancestro AS id,
              coalesce(sum(m.debe), 0) AS debe,
              coalesce(sum(m.haber), 0) AS haber
         FROM cierre ci
         LEFT JOIN mov m ON m.cuenta_id = ci.descendiente
        GROUP BY ci.ancestro
     )
     SELECT c.id, c.codigo, c.nombre, c.tipo, a.nivel,
            c.admite_movimiento AS "admiteMovimiento",
            s.debe::numeric(14,2)::text AS debe,
            s.haber::numeric(14,2)::text AS haber
       FROM arbol a
       JOIN contabilidad.cuenta_contable c ON c.id = a.id
       JOIN suma s ON s.id = c.id
      WHERE $3::boolean OR s.debe <> 0 OR s.haber <> 0
      ORDER BY a.ruta`,
    [f.desde, f.hasta, f.ceros],
  );
}

/**
 * Debe y haber del período sumados sobre las LÍNEAS, no sobre las filas de
 * la balanza: ahí cada movimiento aparece una vez por cada nivel del árbol.
 */
export async function totalesBalanza(f: FiltroLibros): Promise<TotalesLibro> {
  return totalesDiario(f);
}
