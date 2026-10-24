import { consultar, consultarUna } from "@/lib/db";
import { esFechaIso, esUuid } from "@/lib/contabilidad/formato";

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
/** Movimientos que se pintan en el mayor; el saldo final no depende de él. */
export const TOPE_MAYOR = 500;

export type FiltroLibros = {
  vista: VistaLibro;
  desde: string;
  hasta: string;
  /** `YYYY-MM` cuando la balanza se pidió por mes. */
  periodo: string | null;
  cuenta: string | null;
  /** Balanza: mostrar también las cuentas sin saldo ni movimiento. */
  ceros: boolean;
};

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
  const cuenta = uno(crudo.cuenta);
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
    cuenta: esUuid(cuenta) ? cuenta : null,
    // Un `anulados=1` de un enlace viejo se ignora: ya no hay qué filtrar.
    ceros: uno(crudo.ceros) === "1",
  };
}

// ── Libro diario ───────────────────────────────────────────────────────

export type LineaDiario = {
  id: string;
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
        ORDER BY a.fecha, a.numero
        LIMIT $3
     )
     SELECT s.id AS asiento_id, s.numero::text AS numero,
            to_char(s.fecha, 'YYYY-MM-DD') AS fecha, s.concepto, s.tipo, s.estado,
            sum(l.debe) OVER (PARTITION BY s.id)::text AS total_debe,
            sum(l.haber) OVER (PARTITION BY s.id)::text AS total_haber,
            l.id AS linea_id, c.codigo, c.nombre AS cuenta, l.descripcion,
            l.debe::text AS debe, l.haber::text AS haber
       FROM sel s
       JOIN contabilidad.asiento_linea l ON l.asiento_id = s.id
       JOIN contabilidad.cuenta_contable c ON c.id = l.cuenta_id
      ORDER BY s.fecha, s.numero, (l.debe > 0) DESC, c.codigo COLLATE "C", l.id`,
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
      WHERE a.fecha BETWEEN $1::date AND $2::date`,
    [f.desde, f.hasta],
  );
  return fila ?? { asientos: 0, debe: "0.00", haber: "0.00", diferencia: "0.00" };
}

// ── Catálogo para el selector ──────────────────────────────────────────

export type OpcionCuenta = {
  id: string;
  codigo: string;
  nombre: string;
  nivel: number;
  admiteMovimiento: boolean;
};

/**
 * Las cuentas en orden de árbol (la ruta de códigos desde la raíz), con su
 * nivel para sangrar. Ordenar por la ruta y no por el código deja ver las
 * cuentas sueltas sin padre donde están de verdad: en la raíz.
 * `COLLATE "C"` porque la intercalación del idioma ignora los puntos y
 * pondría "1.10" entre "1.1.01" y "1.1.02".
 */
export async function cuentasDelArbol(): Promise<OpcionCuenta[]> {
  return consultar<OpcionCuenta>(
    `WITH RECURSIVE arbol AS (
       SELECT c.id, 0 AS nivel, ARRAY[c.codigo COLLATE "C"] AS ruta
         FROM contabilidad.cuenta_contable c
        WHERE c.padre_id IS NULL
       UNION ALL
       SELECT h.id, a.nivel + 1, a.ruta || (h.codigo COLLATE "C")
         FROM contabilidad.cuenta_contable h
         JOIN arbol a ON h.padre_id = a.id
     )
     SELECT c.id, c.codigo, c.nombre, a.nivel, c.admite_movimiento AS "admiteMovimiento"
       FROM arbol a
       JOIN contabilidad.cuenta_contable c ON c.id = a.id
      ORDER BY a.ruta`,
  );
}

// ── Libro mayor ────────────────────────────────────────────────────────

export type CuentaMayor = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  admiteMovimiento: boolean;
  /** Activo y gasto crecen por el debe; pasivo, patrimonio e ingreso por el haber. */
  deudora: boolean;
};

export type ResumenMayor = {
  saldoInicial: string;
  debe: string;
  haber: string;
  saldoFinal: string;
  movimientos: number;
};

export type MovimientoMayor = {
  id: string;
  asientoId: string;
  numero: string;
  fecha: string;
  concepto: string;
  codigo: string;
  cuenta: string;
  descripcion: string | null;
  debe: string;
  haber: string;
  saldo: string;
};

export async function cuentaMayor(id: string): Promise<CuentaMayor | null> {
  return consultarUna<CuentaMayor>(
    `SELECT id, codigo, nombre, tipo, admite_movimiento AS "admiteMovimiento",
            tipo IN ('activo', 'gasto') AS deudora
       FROM contabilidad.cuenta_contable
      WHERE id = $1`,
    [id],
  );
}

/**
 * Las líneas de la cuenta y de todas sus descendientes (CTE recursiva), así
 * una cuenta de grupo muestra su mayor agregado. El signo lo pone la
 * naturaleza de la cuenta pedida, no la de cada hija: en el mayor de
 * "Activo corriente" todo se lee como activo.
 *
 * Va sin el "WITH RECURSIVE" delante porque es un trozo de CTE que las dos
 * consultas del mayor comparten: así el signo se define en un solo sitio.
 */
const LINEAS_MAYOR = `sub AS (
       SELECT id FROM contabilidad.cuenta_contable WHERE id = $1
       UNION ALL
       SELECT h.id FROM contabilidad.cuenta_contable h JOIN sub ON h.padre_id = sub.id
     ),
     naturaleza AS (
       SELECT tipo IN ('activo', 'gasto') AS deudora
         FROM contabilidad.cuenta_contable WHERE id = $1
     ),
     lineas AS (
       SELECT l.id, l.debe, l.haber, l.descripcion, a.id AS asiento_id, a.numero, a.fecha,
              a.concepto, c.codigo, c.nombre,
              CASE WHEN n.deudora THEN l.debe - l.haber ELSE l.haber - l.debe END AS efecto
         FROM contabilidad.asiento_linea l
         JOIN contabilidad.asiento a ON a.id = l.asiento_id
         JOIN contabilidad.cuenta_contable c ON c.id = l.cuenta_id
         CROSS JOIN naturaleza n
        WHERE l.cuenta_id IN (SELECT id FROM sub)
          AND a.fecha <= $3::date
     )`;

export async function resumenMayor(cuentaId: string, f: FiltroLibros): Promise<ResumenMayor> {
  const fila = await consultarUna<ResumenMayor>(
    `WITH RECURSIVE ${LINEAS_MAYOR}
     SELECT coalesce(sum(efecto) FILTER (WHERE fecha < $2::date), 0)::numeric(14,2)::text AS "saldoInicial",
            coalesce(sum(debe) FILTER (WHERE fecha >= $2::date), 0)::numeric(14,2)::text AS debe,
            coalesce(sum(haber) FILTER (WHERE fecha >= $2::date), 0)::numeric(14,2)::text AS haber,
            coalesce(sum(efecto), 0)::numeric(14,2)::text AS "saldoFinal",
            count(*) FILTER (WHERE fecha >= $2::date)::int AS movimientos
       FROM lineas`,
    [cuentaId, f.desde, f.hasta],
  );
  return fila ?? { saldoInicial: "0.00", debe: "0.00", haber: "0.00", saldoFinal: "0.00", movimientos: 0 };
}

/**
 * Cada movimiento del rango con su saldo corrido. El saldo es una función
 * de ventana sobre TODAS las líneas hasta `hasta`, así arranca en el saldo
 * inicial sin calcularlo aparte; el filtro por `desde` va por fuera, porque
 * filtrar dentro cortaría la ventana. La ventana se evalúa antes del LIMIT:
 * el tope recorta lo que se pinta, no el saldo.
 */
export async function movimientosMayor(
  cuentaId: string,
  f: FiltroLibros,
  tope: number | null = TOPE_MAYOR,
): Promise<MovimientoMayor[]> {
  return consultar<MovimientoMayor>(
    `WITH RECURSIVE ${LINEAS_MAYOR},
     corrido AS (
       SELECT *, sum(efecto) OVER (
                   ORDER BY fecha, numero, (debe > 0) DESC, codigo COLLATE "C", id
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS saldo
         FROM lineas
     )
     SELECT id, asiento_id AS "asientoId", numero::text AS numero,
            to_char(fecha, 'YYYY-MM-DD') AS fecha, concepto, codigo,
            nombre AS cuenta, descripcion, debe::text AS debe, haber::text AS haber,
            saldo::text AS saldo
       FROM corrido
      WHERE fecha >= $2::date
      ORDER BY fecha, numero, (debe > 0) DESC, codigo COLLATE "C", id
      LIMIT $4`,
    [cuentaId, f.desde, f.hasta, tope],
  );
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
  saldoInicial: string;
  debe: string;
  haber: string;
  saldoFinal: string;
};

/**
 * Una fila por cuenta, en orden de árbol. `cierre` es la clausura del
 * árbol (cada cuenta con ella misma y con todas sus descendientes): la
 * fila de un grupo suma lo de sus hojas sin que la app recorra nada.
 * Los saldos llevan el signo natural de cada cuenta (ver `CuentaMayor`).
 */
export async function balanza(f: FiltroLibros): Promise<FilaBalanza[]> {
  return consultar<FilaBalanza>(
    `WITH RECURSIVE arbol AS (
       SELECT c.id, 0 AS nivel, ARRAY[c.codigo COLLATE "C"] AS ruta
         FROM contabilidad.cuenta_contable c
        WHERE c.padre_id IS NULL
       UNION ALL
       SELECT h.id, a.nivel + 1, a.ruta || (h.codigo COLLATE "C")
         FROM contabilidad.cuenta_contable h
         JOIN arbol a ON h.padre_id = a.id
     ),
     cierre AS (
       SELECT id AS ancestro, id AS descendiente FROM contabilidad.cuenta_contable
       UNION ALL
       SELECT ci.ancestro, h.id
         FROM cierre ci
         JOIN contabilidad.cuenta_contable h ON h.padre_id = ci.descendiente
     ),
     mov AS (
       SELECT l.cuenta_id,
              coalesce(sum(l.debe) FILTER (WHERE a.fecha < $1::date), 0) AS debe_previo,
              coalesce(sum(l.haber) FILTER (WHERE a.fecha < $1::date), 0) AS haber_previo,
              coalesce(sum(l.debe) FILTER (WHERE a.fecha >= $1::date), 0) AS debe,
              coalesce(sum(l.haber) FILTER (WHERE a.fecha >= $1::date), 0) AS haber
         FROM contabilidad.asiento_linea l
         JOIN contabilidad.asiento a ON a.id = l.asiento_id
        WHERE a.fecha <= $2::date
        GROUP BY l.cuenta_id
     ),
     suma AS (
       SELECT ci.ancestro AS id,
              coalesce(sum(m.debe_previo), 0) AS debe_previo,
              coalesce(sum(m.haber_previo), 0) AS haber_previo,
              coalesce(sum(m.debe), 0) AS debe,
              coalesce(sum(m.haber), 0) AS haber
         FROM cierre ci
         LEFT JOIN mov m ON m.cuenta_id = ci.descendiente
        GROUP BY ci.ancestro
     )
     SELECT c.id, c.codigo, c.nombre, c.tipo, a.nivel,
            c.admite_movimiento AS "admiteMovimiento",
            (CASE WHEN c.tipo IN ('activo', 'gasto') THEN s.debe_previo - s.haber_previo
                  ELSE s.haber_previo - s.debe_previo END)::numeric(14,2)::text AS "saldoInicial",
            s.debe::numeric(14,2)::text AS debe,
            s.haber::numeric(14,2)::text AS haber,
            (CASE WHEN c.tipo IN ('activo', 'gasto')
                  THEN s.debe_previo + s.debe - s.haber_previo - s.haber
                  ELSE s.haber_previo + s.haber - s.debe_previo - s.debe END)::numeric(14,2)::text AS "saldoFinal"
       FROM arbol a
       JOIN contabilidad.cuenta_contable c ON c.id = a.id
       JOIN suma s ON s.id = c.id
      WHERE $3::boolean
         OR s.debe_previo <> 0 OR s.haber_previo <> 0 OR s.debe <> 0 OR s.haber <> 0
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
