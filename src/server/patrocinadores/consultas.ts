import { consultar, consultarUna } from "@/lib/db";

/**
 * Patrocinadores: quién sostiene la Fundación y con cuánto.
 *
 * `monto_mensual` es NUMERIC(10,2) y viaja como `float8` a la vista. Es dinero,
 * y el aviso de siempre aplica: los decimales binarios no representan centavos
 * exactos. Aquí no pasa nada porque solo se SUMA para enseñar un total y se
 * formatea a dos decimales; ninguna decisión ni ningún asiento contable sale de
 * este número. Si algún día se factura desde aquí, el cálculo tiene que
 * quedarse en la base (`sum(monto_mensual)` en SQL, como está) y nunca
 * recomponerse en JavaScript.
 */

/** Tope de filas del directorio. */
const TOPE = 200;

export type PatrocinadorFila = {
  id: string;
  nombre: string;
  tipo: string;
  email: string | null;
  telefono: string | null;
  pais: string | null;
  /** Idioma al que se traducen las cartas de sus becados. */
  idioma: "es" | "en";
  estado: string;
  monto_mensual: number;
  notas: string | null;
  /** Becados enlazados a este patrocinador, para saber si se puede retirar. */
  becados: number;
};

/**
 * El directorio, con filtro de tipo, estado y búsqueda por nombre o país.
 *
 * `becados` cuenta las **asignaciones activas** de `asignacion_beca`, que es
 * la fuente de verdad del patrocinio (ver la cabecera de la sección de becas,
 * más abajo). No se cuenta por `estudiante.patrocinador_id`: esa columna es un
 * espejo que se mantiene en sincronía, y contar por el espejo en vez de por el
 * original es cómo empiezan a divergir dos cifras que deberían ser una.
 */
export async function directorioPatrocinadores({
  busqueda,
  tipo,
  estado,
  pais,
}: {
  busqueda?: string | null;
  tipo?: string | null;
  estado?: string | null;
  pais?: string | null;
} = {}): Promise<PatrocinadorFila[]> {
  return consultar<PatrocinadorFila>(
    `SELECT p.id,
            p.nombre,
            p.tipo::text AS tipo,
            p.email::text AS email,
            p.telefono,
            p.pais,
            p.idioma,
            p.estado,
            coalesce(p.monto_mensual, 0)::float8 AS monto_mensual,
            p.notas,
            (SELECT count(*)::int FROM asignacion_beca a
              WHERE a.patrocinador_id = p.id AND a.estado = 'activo') AS becados
       FROM patrocinador p
      WHERE ($1::text IS NULL
             OR p.nombre ILIKE '%' || $1 || '%'
             OR p.pais   ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR p.tipo::text = $2)
        AND ($3::text IS NULL OR p.estado = $3)
        AND ($5::text IS NULL OR p.pais = $5)
      ORDER BY p.estado, p.nombre
      LIMIT $4`,
    [busqueda?.trim() || null, tipo || null, estado || null, TOPE + 1, pais || null],
  );
}

export type ResumenPatrocinio = {
  total: number;
  activos: number;
  paises: number;
  aporte: number;
};

/**
 * Las cifras de cabecera, sobre el conjunto filtrado entero.
 *
 * El aporte mensual suma **solo los activos**: un patrocinador inactivo tiene
 * un `monto_mensual` guardado —es su histórico— pero ya no aporta, y meterlo en
 * el total daría una cifra de ingresos que no entra por la puerta.
 */
export async function resumenDePatrocinio({
  busqueda,
  tipo,
  estado,
}: {
  busqueda?: string | null;
  tipo?: string | null;
  estado?: string | null;
} = {}): Promise<ResumenPatrocinio> {
  const fila = await consultarUna<ResumenPatrocinio>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE p.estado = 'activo')::int AS activos,
            count(DISTINCT p.pais) FILTER (WHERE p.pais IS NOT NULL)::int AS paises,
            coalesce(sum(p.monto_mensual) FILTER (WHERE p.estado = 'activo'), 0)::float8 AS aporte
       FROM patrocinador p
      WHERE ($1::text IS NULL
             OR p.nombre ILIKE '%' || $1 || '%'
             OR p.pais   ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR p.tipo::text = $2)
        AND ($3::text IS NULL OR p.estado = $3)`,
    [busqueda?.trim() || null, tipo || null, estado || null],
  );

  return fila ?? { total: 0, activos: 0, paises: 0, aporte: 0 };
}

/**
 * Conteo por estado para los chips de la lista.
 *
 * Respeta búsqueda, tipo y país pero NO el estado: el chip «Pausados 2» tiene que
 * decir cuántos habría al pulsarlo, no cuántos hay ya con el chip puesto.
 */
export async function conteosPatrocinadoresPorEstado({
  busqueda,
  tipo,
  pais,
}: {
  busqueda?: string | null;
  tipo?: string | null;
  pais?: string | null;
} = {}): Promise<Record<string, number>> {
  const filas = await consultar<{ estado: string; n: number }>(
    `SELECT p.estado, count(*)::int AS n
       FROM patrocinador p
      WHERE ($1::text IS NULL
             OR p.nombre ILIKE '%' || $1 || '%'
             OR p.pais   ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR p.tipo::text = $2)
        AND ($3::text IS NULL OR p.pais = $3)
      GROUP BY p.estado`,
    [busqueda?.trim() || null, tipo || null, pais || null],
  );

  return Object.fromEntries(filas.map((f) => [f.estado, f.n]));
}

/** Países con patrocinadores, para el selector de «Más filtros». */
export async function paisesDePatrocinadores(): Promise<string[]> {
  const filas = await consultar<{ pais: string }>(
    `SELECT DISTINCT pais FROM patrocinador WHERE pais IS NOT NULL AND pais <> '' ORDER BY pais`,
  );

  return filas.map((f) => f.pais);
}

/** Si el directorio llegó al tope. */
export function hayMasPatrocinadores(filas: readonly unknown[]): boolean {
  return filas.length > TOPE;
}

/** Recorta al tope, dejando fuera la fila sonda. */
export function recortarPatrocinadores<T>(filas: readonly T[]): T[] {
  return filas.slice(0, TOPE);
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * BECAS — quién patrocina a quién.
 *
 * LA VERDAD ESTÁ EN `asignacion_beca`, decidido así y no al revés. Había dos
 * formas de enlazar becado y patrocinador y ninguna se usaba:
 *
 *   · `estudiante.patrocinador_id` — un enlace simple, sin monto ni fechas. Un
 *     estudiante que cambia de patrocinador pierde de quién venía antes.
 *   · `asignacion_beca` — con su propio monto, fecha de inicio, fecha de fin y
 *     estado. Aguanta el histórico: un becado puede haber pasado por tres
 *     patrocinadores y las tres etapas quedan.
 *
 * Manda la segunda. La columna `patrocinador_id` **se mantiene en sincronía**
 * dentro de la misma transacción, como espejo de la asignación activa: es una
 * clave ajena de verdad que existe en el esquema, y dejarla en NULL mientras
 * hay becas vivas convertiría la tabla `estudiante` en una trampa para el
 * siguiente que la consulte por SQL. Espejo, no fuente: nada la escribe fuera
 * de `asignarBeca` y `desvincularBeca`.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type BecadoConPatrocinio = {
  estudiante_id: string;
  nombre: string;
  programa: string | null;
  universidad: string | null;
  foto_url: string | null;
  estado_estudiante: string;
  /** De la asignación ACTIVA. Todo nulo si no tiene ninguna. */
  asignacion_id: string | null;
  patrocinador_id: string | null;
  patrocinador: string | null;
  pais: string | null;
  monto: number | null;
  desde: string | null;
  /** Asignaciones ya cerradas: el histórico que la columna suelta no guarda. */
  anteriores: number;
};

/**
 * Los becados universitarios y su patrocinio actual.
 *
 * Salen TODOS los becados, con patrocinador y sin él. Una pantalla de
 * asignación que escondiera a los que no tienen sería justo la que esconde el
 * trabajo pendiente.
 */
export async function becadosConPatrocinio(
  busqueda?: string | null,
): Promise<BecadoConPatrocinio[]> {
  return consultar<BecadoConPatrocinio>(
    `SELECT e.id AS estudiante_id,
            e.nombre,
            e.programa,
            e.universidad,
            e.foto_url,
            e.estado::text AS estado_estudiante,
            a.id   AS asignacion_id,
            a.patrocinador_id,
            p.nombre AS patrocinador,
            p.pais,
            a.monto::float8 AS monto,
            a.fecha_inicio::text AS desde,
            (SELECT count(*)::int FROM asignacion_beca h
              WHERE h.estudiante_id = e.id AND h.estado <> 'activo') AS anteriores
       FROM estudiante e
       LEFT JOIN asignacion_beca a
              ON a.estudiante_id = e.id AND a.estado = 'activo'
       LEFT JOIN patrocinador p ON p.id = a.patrocinador_id
      WHERE e.tipo = 'becado'
        AND ($1::text IS NULL
             OR e.nombre     ILIKE '%' || $1 || '%'
             OR e.programa   ILIKE '%' || $1 || '%'
             OR p.nombre     ILIKE '%' || $1 || '%')
      ORDER BY (a.id IS NULL) DESC, e.nombre`,
    [busqueda?.trim() || null],
  );
}

export type ResumenBecas = {
  becados: number;
  asignados: number;
  sin_asignar: number;
  comprometido: number;
};

/**
 * Las cifras de la pantalla de becas.
 *
 * `comprometido` suma los montos de las asignaciones ACTIVAS, que es lo que la
 * Fundación tiene comprometido este mes por la vía de las becas. No coincide
 * necesariamente con el aporte total de los patrocinadores: alguien puede
 * aportar más de lo que tiene asignado a una beca concreta, y esa diferencia es
 * información, no un error que haya que cuadrar aquí.
 */
export async function resumenDeBecas(): Promise<ResumenBecas> {
  const fila = await consultarUna<ResumenBecas>(
    `SELECT count(*)::int AS becados,
            count(a.id)::int AS asignados,
            (count(*) - count(a.id))::int AS sin_asignar,
            coalesce(sum(a.monto), 0)::float8 AS comprometido
       FROM estudiante e
       LEFT JOIN asignacion_beca a
              ON a.estudiante_id = e.id AND a.estado = 'activo'
      WHERE e.tipo = 'becado'`,
  );

  return fila ?? { becados: 0, asignados: 0, sin_asignar: 0, comprometido: 0 };
}

/** Los patrocinadores activos, para el selector de vinculación. */
export async function patrocinadoresActivos(): Promise<
  { id: string; nombre: string; pais: string | null; monto_mensual: number }[]
> {
  return consultar<{
    id: string;
    nombre: string;
    pais: string | null;
    monto_mensual: number;
  }>(
    `SELECT id, nombre, pais, coalesce(monto_mensual, 0)::float8 AS monto_mensual
       FROM patrocinador
      WHERE estado = 'activo'
      ORDER BY nombre`,
  );
}
