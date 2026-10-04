#!/usr/bin/env node
// scripts/probar-contabilidad.mjs
// Pruebas de integración de los cimientos del módulo de contabilidad,
// contra la BD de desarrollo (migraciones 0032-0035 y db:seed:contabilidad).
//
// Ejecutar: npm run db:probar:contabilidad
//
//   (a) INSERT sin app.usuario_id falla
//   (b) UPDATE, DELETE y TRUNCATE sobre la bitácora fallan
//   (c) la cadena de hash verifica, y una fila alterada por el dueño de
//       la tabla (con la inmutabilidad apagada) se detecta
//   (d) un asiento descuadrado no se puede guardar
//   (e) siguiente_numero no deja huecos ni duplicados con 50 llamadas
//       concurrentes
//   (f) DELETE en una tabla contable falla
//   (g) un período cerrado no admite registros
//   (h) app.accion y app.motivo llegan a la bitácora
//   (i) contabilizar un recibo crea su movimiento y un asiento cuadrado
//   (j) anularlo deja contra-asiento y el libro vuelve a su saldo
//   (k) una transferencia USD→DOP registra la diferencia cambiaria
//   (l) conciliar empareja por importe y fecha, y cerrar bloquea
//
// Casi todo corre dentro de una transacción que termina en ROLLBACK:
// en contabilidad nada se borra, así que una prueba que hiciera COMMIT
// dejaría basura para siempre. La única excepción es (e), que necesita
// COMMIT para que la concurrencia sea real; usa su propia serie
// `PRUEBA`, que ningún documento consume.

import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.co")
    ? { rejectUnauthorized: false }
    : undefined,
  // El pooler de Supabase en modo sesión admite 15 clientes. Las 50
  // llamadas de (e) se reparten en 10 conexiones y siguen compitiendo por
  // el mismo FOR UPDATE, que es lo que se prueba.
  max: 10,
});

let ok = 0;
let fail = 0;

function pasar(nombre) {
  console.log(`  ✓ ${nombre}`);
  ok++;
}

function fallar(nombre, detalle) {
  console.error(`  ✗ ${nombre}\n    ${detalle}`);
  fail++;
}

/** Ejecuta `sql` dentro de un SAVEPOINT y devuelve el error, o null. */
async function errorDe(cliente, sql, params = []) {
  await cliente.query("SAVEPOINT intento");
  try {
    await cliente.query(sql, params);
    await cliente.query("RELEASE SAVEPOINT intento");
    return null;
  } catch (err) {
    await cliente.query("ROLLBACK TO SAVEPOINT intento");
    return err;
  }
}

function esperarError(nombre, err, fragmento) {
  if (!err) fallar(nombre, "no lanzó excepción");
  else if (!err.message.includes(fragmento)) fallar(nombre, `error inesperado: ${err.message}`);
  else pasar(nombre);
}

async function usuarioDePrueba() {
  // El mismo usuario de sistema que usa el seed.
  const { rows } = await pool.query(`SELECT id FROM public.usuario WHERE email = $1`, [
    process.env.ADMIN_MAESTRO_EMAIL ?? "admin@globaleffect.org",
  ]);
  if (!rows[0]) throw new Error("No está el usuario de sistema. Ejecuta npm run db:seed primero.");
  return rows[0].id;
}

async function fijarContexto(cliente, usuarioId) {
  await cliente.query(
    `SELECT set_config('app.usuario_id', $1, true),
            set_config('app.ip',         '127.0.0.1', true),
            set_config('app.agente',     'probar-contabilidad.mjs', true),
            set_config('app.sesion',     'prueba', true)`,
    [usuarioId],
  );
}

/** Abre una transacción con contexto, corre `cuerpo` y siempre deshace. */
async function enPrueba(usuarioId, cuerpo, { conContexto = true } = {}) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    if (conContexto) await fijarContexto(cliente, usuarioId);
    await cuerpo(cliente);
  } finally {
    await cliente.query("ROLLBACK").catch(() => {});
    cliente.release();
  }
}

async function probarEscrituraAnonima(usuarioId) {
  await enPrueba(
    usuarioId,
    async (c) => {
      const err = await errorDe(c, `INSERT INTO contabilidad.fondo (nombre) VALUES ('prueba_anonima')`);
      esperarError("(a) escritura sin app.usuario_id rechazada", err, "app.usuario_id");
    },
    { conContexto: false },
  );
}

async function probarInmutabilidad(usuarioId) {
  await enPrueba(usuarioId, async (c) => {
    // Una fila propia, para no depender de lo que haya sembrado.
    await c.query(`INSERT INTO contabilidad.fondo (nombre) VALUES ('prueba_inmutable')`);
    const filtro = `WHERE tabla = 'fondo' AND despues->>'nombre' = 'prueba_inmutable'`;

    esperarError(
      "(b1) UPDATE sobre la bitácora rechazado",
      await errorDe(c, `UPDATE contabilidad.bitacora SET motivo = 'alterado' ${filtro}`),
      "inmutable",
    );
    esperarError(
      "(b2) DELETE sobre la bitácora rechazado",
      await errorDe(c, `DELETE FROM contabilidad.bitacora ${filtro}`),
      "inmutable",
    );
    esperarError(
      "(b3) TRUNCATE sobre la bitácora rechazado",
      await errorDe(c, `TRUNCATE contabilidad.bitacora`),
      "TRUNCATE",
    );
  });
}

async function probarCadena(usuarioId) {
  const { rows: rotas } = await pool.query(
    `SELECT v.orden, v.falla FROM contabilidad.verificar_bitacora() AS v`,
  );
  if (rotas.length === 0) pasar("(c1) la cadena de hash está íntegra");
  else fallar("(c1) cadena íntegra", `${rotas.length} filas rotas; la primera: ${JSON.stringify(rotas[0])}`);

  await enPrueba(usuarioId, async (c) => {
    // Dos escrituras en la misma transacción: con el orden viejo
    // (ocurrido_en, id aleatorio) esto rompía la cadena.
    await c.query(`INSERT INTO contabilidad.fondo (nombre) VALUES ('prueba_cadena_1'), ('prueba_cadena_2')`);
    const { rows: tras } = await c.query(`SELECT count(*)::int AS n FROM contabilidad.verificar_bitacora()`);
    if (tras[0].n === 0) pasar("(c2) dos escrituras en una transacción encadenan bien");
    else fallar("(c2) encadenado en una transacción", `${tras[0].n} filas rotas`);

    // Lo que haría un DBA deshonesto: el dueño de la tabla puede apagar
    // la inmutabilidad, pero no rehacer el hash sin que se note.
    await c.query(`ALTER TABLE contabilidad.bitacora DISABLE TRIGGER tg_bitacora_inmutable`);
    const { rows: [victima] } = await c.query(
      `SELECT orden FROM contabilidad.bitacora ORDER BY orden DESC LIMIT 1 OFFSET 1`,
    );
    await c.query(`UPDATE contabilidad.bitacora SET motivo = 'alterado a mano' WHERE orden = $1`, [victima.orden]);
    const { rows: detectadas } = await c.query(
      `SELECT v.orden, v.falla FROM contabilidad.verificar_bitacora() AS v`,
    );
    if (detectadas[0]?.orden === victima.orden && detectadas[0]?.falla === "hash") {
      pasar("(c3) una fila alterada se detecta en su posición exacta");
    } else {
      fallar("(c3) detección de alteración", `esperaba orden ${victima.orden}/hash, obtuve ${JSON.stringify(detectadas)}`);
    }

    // Y si en vez de alterarla la borra, queda el hueco.
    await c.query(`DELETE FROM contabilidad.bitacora WHERE orden = $1`, [victima.orden]);
    const { rows: hueco } = await c.query(`SELECT v.falla FROM contabilidad.verificar_bitacora() AS v`);
    if (hueco.some((f) => f.falla === "hueco")) pasar("(c4) una fila borrada deja un hueco detectable");
    else fallar("(c4) detección de borrado", JSON.stringify(hueco));
  });
}

async function probarCuadre(usuarioId) {
  const { rows: [periodo] } = await pool.query(
    `SELECT id FROM contabilidad.periodo_contable WHERE estado = 'abierto' LIMIT 1`,
  );
  const { rows: cuentas } = await pool.query(
    `SELECT id FROM contabilidad.cuenta_contable WHERE admite_movimiento LIMIT 2`,
  );
  if (!periodo || cuentas.length < 2) {
    fallar("(d) asiento descuadrado", "sin período abierto o cuentas: ejecuta npm run db:seed:contabilidad");
    return;
  }

  // El cuadre es un disparador DIFERIDO: solo salta al COMMIT, así que
  // esta prueba sí hace COMMIT y cuenta con que falle.
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await fijarContexto(c, usuarioId);
    const { rows: [asiento] } = await c.query(
      `INSERT INTO contabilidad.asiento (numero, fecha, periodo_id, concepto, tipo, creado_por)
       VALUES (-1, CURRENT_DATE, $1, 'Prueba de descuadre', 'manual', $2)
       RETURNING id`,
      [periodo.id, usuarioId],
    );
    await c.query(
      `INSERT INTO contabilidad.asiento_linea (asiento_id, cuenta_id, debe) VALUES ($1, $2, 1000)`,
      [asiento.id, cuentas[0].id],
    );
    try {
      await c.query("COMMIT");
      fallar("(d) asiento descuadrado rechazado", "el COMMIT pasó: quedó un asiento con número -1 en la BD");
    } catch (err) {
      esperarError("(d) asiento descuadrado rechazado", err, "descuadrado");
    }
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
  }
}

async function probarSecuencia(usuarioId) {
  const N = 50;
  const conContexto = async (trabajo) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await fijarContexto(c, usuarioId);
      const r = await trabajo(c);
      await c.query("COMMIT");
      return r;
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  };

  try {
    await conContexto((c) =>
      c.query(
        `INSERT INTO contabilidad.secuencia (clave, prefijo) VALUES ('PRUEBA', 'PRUEBA-')
         ON CONFLICT (clave) DO NOTHING`,
      ),
    );
    const numeros = await Promise.all(
      Array.from({ length: N }, () =>
        conContexto(async (c) => {
          const { rows } = await c.query(`SELECT contabilidad.siguiente_numero('PRUEBA') AS n`);
          return Number(rows[0].n);
        }),
      ),
    );
    numeros.sort((x, y) => x - y);
    const contiguos = numeros.every((n, i) => n === numeros[0] + i);
    if (contiguos) pasar(`(e) ${N} llamadas concurrentes: ${numeros[0]}…${numeros.at(-1)}, sin huecos ni duplicados`);
    else fallar("(e) secuencia concurrente", numeros.join(","));
  } catch (err) {
    fallar("(e) secuencia concurrente", err.message);
  }
}

async function probarSinBorrado(usuarioId) {
  await enPrueba(usuarioId, async (c) => {
    await c.query(`INSERT INTO contabilidad.fondo (nombre) VALUES ('prueba_borrado')`);
    esperarError(
      "(f) DELETE en una tabla contable rechazado",
      await errorDe(c, `DELETE FROM contabilidad.fondo WHERE nombre = 'prueba_borrado'`),
      "nada se borra",
    );
  });
}

async function probarPeriodoCerrado(usuarioId) {
  await enPrueba(usuarioId, async (c) => {
    const { rows: [periodo] } = await c.query(
      `INSERT INTO contabilidad.periodo_contable (anio, mes, estado)
       VALUES (2020, 1, 'cerrado') RETURNING id`,
    );
    esperarError(
      "(g) un período cerrado no admite asientos",
      await errorDe(
        c,
        `INSERT INTO contabilidad.asiento (numero, fecha, periodo_id, concepto, creado_por)
         VALUES (-2, '2020-01-15', $1, 'Prueba de período cerrado', $2)`,
        [periodo.id, usuarioId],
      ),
      "cerrado",
    );
  });
}

async function probarAccionNombrada(usuarioId) {
  await enPrueba(usuarioId, async (c) => {
    await c.query(`INSERT INTO contabilidad.fondo (nombre) VALUES ('prueba_accion')`);
    await c.query(`SELECT set_config('app.accion', 'anular', true), set_config('app.motivo', 'duplicado', true)`);
    await c.query(`UPDATE contabilidad.fondo SET activo = false WHERE nombre = 'prueba_accion'`);
    const { rows: [fila] } = await c.query(
      `SELECT accion, motivo, campos_cambiados, ip FROM contabilidad.bitacora
        ORDER BY orden DESC LIMIT 1`,
    );
    const bien =
      fila.accion === "anular" &&
      fila.motivo === "duplicado" &&
      fila.campos_cambiados?.join() === "activo" &&
      fila.ip === "127.0.0.1";
    if (bien) pasar("(h) la acción, el motivo, los campos cambiados y la IP llegan a la bitácora");
    else fallar("(h) acción nombrada", JSON.stringify(fila));
  });
}

/** Un recibo borrador de prueba en la cuenta indicada. Devuelve su id. */
async function reciboDePrueba(c, usuarioId, { tipo = "ingreso", cuenta = "Santa Cruz DOP", monto = "1500.00", tasa = null } = {}) {
  const { rows: [r] } = await c.query(
    `INSERT INTO contabilidad.recibo
       (tipo, numero, fecha, periodo_id, cuenta_bancaria_id, moneda, tasa, monto, concepto,
        categoria_id, fondo_id, forma_pago, referencia, creado_por)
     SELECT $1, -1 * (1 + (random() * 1e6)::int), CURRENT_DATE, contabilidad.periodo_para(CURRENT_DATE),
            cb.id, cb.moneda, $4, $3, 'Recibo de prueba',
            (SELECT id FROM contabilidad.categoria WHERE tipo = $1 AND cuenta_id IS NOT NULL LIMIT 1),
            (SELECT id FROM contabilidad.fondo WHERE nombre = 'General'),
            'transferencia', 'REF-PRUEBA-1', $5
       FROM contabilidad.cuenta_bancaria cb WHERE cb.nombre = $2
     RETURNING id`,
    [tipo, cuenta, monto, tasa, usuarioId],
  );
  return r.id;
}

async function asientoCuadra(c, asientoId) {
  const { rows: [a] } = await c.query(
    `SELECT sum(debe) = sum(haber) AND sum(debe) > 0 AS ok FROM contabilidad.asiento_linea WHERE asiento_id = $1`,
    [asientoId],
  );
  return a.ok === true;
}

async function probarRecibos(usuarioId) {
  await enPrueba(usuarioId, async (c) => {
    const id = await reciboDePrueba(c, usuarioId);
    await c.query(`SELECT contabilidad.contabilizar_recibo($1)`, [id]);
    await c.query(`SET CONSTRAINTS ALL IMMEDIATE`);
    const { rows: [r] } = await c.query(
      `SELECT r.estado, r.asiento_id, m.importe::text AS importe
         FROM contabilidad.recibo r JOIN contabilidad.movimiento_bancario m ON m.id = r.movimiento_id
        WHERE r.id = $1`,
      [id],
    );
    if (r.estado === "contabilizado" && r.importe === "1500.00" && (await asientoCuadra(c, r.asiento_id))) {
      pasar("(i) contabilizar crea el movimiento (+1500) y un asiento cuadrado");
    } else fallar("(i) contabilizar", JSON.stringify(r));

    await c.query(`SELECT contabilidad.anular_recibo($1, 'Prueba de anulación')`, [id]);
    await c.query(`SET CONSTRAINTS ALL IMMEDIATE`);
    const { rows: [a] } = await c.query(
      `SELECT r.estado, m.estado AS mov, r.contra_asiento_id,
              (SELECT sum(l.debe) - sum(l.haber) FROM contabilidad.asiento_linea l
                 JOIN contabilidad.cuenta_bancaria cb ON cb.cuenta_contable_id = l.cuenta_id
                WHERE cb.id = r.cuenta_bancaria_id
                  AND l.asiento_id IN (r.asiento_id, r.contra_asiento_id))::text AS neto
         FROM contabilidad.recibo r JOIN contabilidad.movimiento_bancario m ON m.id = r.movimiento_id
        WHERE r.id = $1`,
      [id],
    );
    if (a.estado === "anulado" && a.mov === "anulado" && a.contra_asiento_id && a.neto === "0.00") {
      pasar("(j) anular deja contra-asiento y el banco vuelve a cero");
    } else fallar("(j) anular", JSON.stringify(a));

    esperarError(
      "(j2) anular sin motivo rechazado",
      await errorDe(c, `SELECT contabilidad.anular_recibo($1, '')`, [await reciboDePrueba(c, usuarioId)]),
      "motivo",
    );
  });
}

async function probarTransferencia(usuarioId) {
  await enPrueba(usuarioId, async (c) => {
    await c.query(
      `INSERT INTO contabilidad.tasa_cambio (fecha, compra, venta, fuente)
       VALUES (CURRENT_DATE, 60.00, 60.50, 'PRUEBA')
       ON CONFLICT (fecha) DO UPDATE SET venta = 60.50`,
    );
    // 100 USD salen; el banco acredita 6 000 DOP (a 60.00), la referencia
    // es 60.50: se perdieron 50 pesos en el cambio.
    const { rows: [t] } = await c.query(
      `SELECT contabilidad.transferir(
         (SELECT id FROM contabilidad.cuenta_bancaria WHERE nombre = 'Santa Cruz USD'),
         (SELECT id FROM contabilidad.cuenta_bancaria WHERE nombre = 'Santa Cruz DOP'),
         CURRENT_DATE, 100.00, 6000.00, 'Cambio de prueba', NULL) AS id`,
    );
    await c.query(`SET CONSTRAINTS ALL IMMEDIATE`);
    const { rows: [r] } = await c.query(
      `SELECT diferencia_cambiaria::text AS dif, tasa_aplicada::text AS tasa, asiento_id
         FROM contabilidad.transferencia_interna WHERE id = $1`,
      [t.id],
    );
    if (r.dif === "-50.00" && r.tasa === "60.0000" && (await asientoCuadra(c, r.asiento_id))) {
      pasar("(k) transferencia USD→DOP: tasa 60.0000, diferencia −50.00 y asiento cuadrado");
    } else fallar("(k) transferencia", JSON.stringify(r));
  });
}

async function probarConciliacion(usuarioId) {
  await enPrueba(usuarioId, async (c) => {
    const id = await reciboDePrueba(c, usuarioId, { monto: "777.77" });
    await c.query(`SELECT contabilidad.contabilizar_recibo($1)`, [id]);
    const { rows: [conc] } = await c.query(
      `INSERT INTO contabilidad.conciliacion (cuenta_id, desde, hasta, saldo_banco, creado_por)
       SELECT id, CURRENT_DATE - 30, CURRENT_DATE + 3, 0, $1
         FROM contabilidad.cuenta_bancaria WHERE nombre = 'Santa Cruz DOP'
       RETURNING id`,
      [usuarioId],
    );
    await c.query(
      `INSERT INTO contabilidad.conciliacion_linea (conciliacion_id, linea, fecha, descripcion, referencia, monto)
       VALUES ($1, 2, CURRENT_DATE + 2, 'DEPOSITO', 'REF-PRUEBA-1', 777.77)`,
      [conc.id],
    );
    const { rows: [p] } = await c.query(`SELECT contabilidad.proponer_emparejamientos($1) AS n`, [conc.id]);
    await c.query(`UPDATE contabilidad.conciliacion_linea SET confirmada = true WHERE conciliacion_id = $1`, [conc.id]);
    await c.query(`SELECT contabilidad.cerrar_conciliacion($1)`, [conc.id]);
    if (p.n >= 1) pasar("(l1) la propuesta empareja por importe, fecha ±3 días y referencia");
    else fallar("(l1) proponer", `emparejó ${p.n}`);
    esperarError(
      "(l2) un movimiento conciliado no se puede anular",
      await errorDe(c, `SELECT contabilidad.anular_recibo($1, 'Prueba tras conciliar')`, [id]),
      "conciliad",
    );
  });
}

async function main() {
  console.log("\nPruebas de los cimientos de contabilidad\n");
  const usuarioId = await usuarioDePrueba();

  await probarEscrituraAnonima(usuarioId);
  await probarInmutabilidad(usuarioId);
  await probarCadena(usuarioId);
  await probarCuadre(usuarioId);
  await probarSecuencia(usuarioId);
  await probarSinBorrado(usuarioId);
  await probarPeriodoCerrado(usuarioId);
  await probarAccionNombrada(usuarioId);
  await probarRecibos(usuarioId);
  await probarTransferencia(usuarioId);
  await probarConciliacion(usuarioId);

  console.log(`\nResultado: ${ok} pasaron, ${fail} fallaron`);
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Error inesperado:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
