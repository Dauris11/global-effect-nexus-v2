import { Pool, type QueryResultRow } from "pg";

/**
 * Acceso a PostgreSQL (Supabase) desde el servidor.
 *
 * La conexión va por Supavisor en modo sesión: Supabase retiró el acceso
 * directo a `db.<ref>.supabase.co:5432` en este proyecto (ver `.env.local`).
 *
 * En desarrollo el pool se guarda en `globalThis` porque el hot reload
 * reevalúa los módulos y, sin esa caché, cada recarga abriría un pool nuevo
 * hasta agotar las conexiones del pooler.
 */

declare global {
  // `var` y no `let`: una declaración global solo se engancha a `globalThis`
  // con `var`. La regla `no-var` no está activa aquí, así que el
  // `eslint-disable` que había sobraba y ESLint lo avisaba.
  var __poolGlobalEffect: Pool | undefined;
}

function crearPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y rellena la conexión de Supabase.",
    );
  }

  return new Pool({
    connectionString,
    // Supavisor exige TLS pero presenta un certificado que Node no encadena
    // hasta una CA conocida; en local se acepta sin verificar la cadena.
    ssl: connectionString.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export const pool = globalThis.__poolGlobalEffect ?? crearPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__poolGlobalEffect = pool;
}

/**
 * Lanza una consulta parametrizada y devuelve las filas.
 *
 * Siempre con `$1, $2…`: interpolar valores en el SQL abriría la puerta a
 * inyección. `T` describe la forma de la fila y no se valida en tiempo de
 * ejecución, así que debe coincidir con lo que el SELECT realmente pide.
 */
export async function consultar<T extends QueryResultRow>(
  sql: string,
  valores: readonly unknown[] = [],
): Promise<T[]> {
  const resultado = await pool.query<T>(sql, valores as unknown[]);
  return resultado.rows;
}

/** Igual que `consultar`, para cuando se espera una fila o ninguna. */
export async function consultarUna<T extends QueryResultRow>(
  sql: string,
  valores: readonly unknown[] = [],
): Promise<T | null> {
  const filas = await consultar<T>(sql, valores);
  return filas[0] ?? null;
}

/**
 * Ejecuta varias sentencias en una transacción sobre la misma conexión.
 * Si el callback lanza, se hace ROLLBACK y el error se propaga.
 */
export async function enTransaccion<T>(
  trabajo: (cliente: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");
    const resultado = await trabajo(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Contexto de red que se adjunta a cada transacción contable.
 * El disparador de bitácora lo lee con current_setting().
 */
export type ContextoTransaccion = {
  /** UUID del usuario en public.usuario (no el auth_user_id de Supabase). */
  usuarioId: string;
  ip?: string;
  agente?: string;
  sesionId?: string;
};

/**
 * Como `enTransaccion`, pero fija el contexto del usuario antes del trabajo.
 *
 * Por qué existe esta función:
 *   El módulo de contabilidad exige que toda escritura lleve identidad:
 *   el disparador de bitácora (0033) lee `app.usuario_id` con
 *   `current_setting` y aborta si no existe. `enTransaccion` no fija ese
 *   valor, por eso contabilidad DEBE usar `enTransaccionComo`. Si alguien
 *   llama `enTransaccion` contra una tabla de `contabilidad.*`, el disparador
 *   rechazará la operación —ese es el comportamiento buscado—.
 *
 *   `is_local = true` en `set_config` limita el valor a la transacción actual:
 *   cuando termina el COMMIT/ROLLBACK, Postgres descarta los valores, sin
 *   riesgo de que un pool recicle la conexión con el usuario anterior.
 */
export async function enTransaccionComo<T>(
  contexto: ContextoTransaccion,
  trabajo: (cliente: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    // Fijar el contexto dentro de esta transacción (is_local = true).
    await cliente.query(
      `SELECT
         set_config('app.usuario_id', $1, true),
         set_config('app.ip',         $2, true),
         set_config('app.agente',     $3, true),
         set_config('app.sesion',     $4, true)`,
      [
        contexto.usuarioId,
        contexto.ip      ?? '',
        contexto.agente  ?? '',
        contexto.sesionId ?? '',
      ],
    );

    const resultado = await trabajo(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}
