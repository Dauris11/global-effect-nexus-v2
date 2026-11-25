// Reinicio ÚNICO de la contabilidad de prueba: vacía lo transaccional que
// genera saldos o depende de las cuentas del catálogo viejo, para que la
// migración 0107 pueda reemplazar el catálogo y los saldos queden en cero.
//
// Uso:
//   node scripts/reiniciar-contabilidad.mjs               # ensayo (ROLLBACK)
//   node scripts/reiniciar-contabilidad.mjs --confirmar   # aplica (COMMIT)
//
// Orden: primero este script, después `npm run db:migrate` (0107).
//
// Qué NO toca: `bitacora` (inmutable y encadenada), ni los maestros
// (proveedor, tercero, empleado, banco, cuenta_bancaria, caja, categoria,
// centro_costo, fondo, entidad, parametro, secuencia, tasa_cambio,
// periodo_contable, presupuesto*, activo_categoria, articulo,
// regla_automatica). `secuencia` se conserva a propósito: la numeración
// fiscal (NCF) no se reinicia.
//
// Cómo salta «en contabilidad nada se borra»: dentro de UNA transacción se
// suspenden solo los disparadores de protección/cuadre/bloqueo de las tablas
// que se vacían; el de bitácora sigue activo, así que cada fila borrada queda
// registrada (acción «anular», con el motivo del reinicio) por el canal normal. Al final se reactivan
// todos y se verifica en pg_trigger. No se usa session_replication_role.
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const CONFIRMAR = process.argv.includes("--confirmar");
const AGENTE = "reiniciar-contabilidad.mjs";

// Lo transaccional. El orden de borrado se calcula con las FK reales (hijos
// primero); esta lista solo dice QUÉ se vacía.
const A_VACIAR = [
  "asiento", "asiento_linea", "asiento_recurrente",
  "recibo", "recibo_adjunto",
  "factura_proveedor", "factura_adjunto", "cuenta_por_pagar", "pago",
  "movimiento_bancario", "extracto_linea",
  "conciliacion", "conciliacion_linea", "conciliacion_partida",
  "transferencia_interna", "caja_movimiento",
  "arqueo", "arqueo_denominacion",
  "nomina", "nomina_linea",
  "donacion", "promesa_donacion", "promesa_cuota", "fondo_liberacion",
  "comprobante_recibido", "comprobante_retencion",
  "declaracion", "obligacion_fiscal",
  "orden_compra", "orden_compra_linea",
  "inventario_movimiento", "conteo_fisico", "conteo_fisico_linea",
  "activo_fijo", "depreciacion_mensual", "depreciacion_linea",
  "cierre_anual", "snapshot_financiero", "alerta", "calculadora_historial",
  "debida_diligencia",
];

const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();

try {
  await cliente.query("BEGIN");

  // Contexto que exige la bitácora (mismo que enTransaccionComo).
  const { rows: usu } = await cliente.query(
    `SELECT id::text FROM public.usuario
      WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
      ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1`,
  );
  if (!usu[0]) throw new Error("No existe el usuario sistema/admin en public.usuario");
  await cliente.query(
    `SELECT set_config('app.usuario_id', $1, true), set_config('app.ip', 'script', true),
            set_config('app.agente', $2, true), set_config('app.sesion', 'reinicio', true),
            set_config('app.motivo', $3, true)`,
    [usu[0].id, AGENTE, "Reinicio de la contabilidad de prueba antes del catálogo Global Effect (0107)"],
  );

  const existentes = new Set(
    (
      await cliente.query(
        `SELECT relname FROM pg_class
          WHERE relnamespace = 'contabilidad'::regnamespace AND relkind = 'r'`,
      )
    ).rows.map((r) => r.relname),
  );
  const tablas = A_VACIAR.filter((t) => existentes.has(t));
  const noExisten = A_VACIAR.filter((t) => !existentes.has(t));
  if (noExisten.length) console.log("Tablas de la lista que no existen (se omiten):", noExisten.join(", "));
  const conjunto = new Set(tablas);

  // --- Conteos antes (van a la bitácora y al informe) ---
  const antes = {};
  for (const t of tablas) {
    const { rows } = await cliente.query(`SELECT count(*)::int AS n FROM contabilidad.${t}`);
    antes[t] = rows[0].n;
  }

  // --- Grafo de FK entre las tablas a vaciar ---
  const { rows: fks } = await cliente.query(
    `SELECT c.conrelid::regclass::text AS hijo, c.confrelid::regclass::text AS padre,
            c.conname, c.conkey,
            (SELECT bool_and(NOT a.attnotnull)
               FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)) AS anulable,
            (SELECT array_agg(a.attname::text ORDER BY a.attnum)
               FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)) AS columnas
       FROM pg_constraint c
      WHERE c.contype = 'f' AND c.connamespace = 'contabilidad'::regnamespace`,
  );
  const corto = (n) => n.replace(/^contabilidad\./, "");
  const aristas = fks
    .map((f) => ({ ...f, hijo: corto(f.hijo), padre: corto(f.padre) }))
    .filter((f) => conjunto.has(f.hijo) && conjunto.has(f.padre) && f.hijo !== f.padre);

  // Ciclos (recibo↔movimiento_bancario, factura↔cuenta_por_pagar…): se
  // rompen anulando la FK anulable que cierra el ciclo (Tarjan por SCC).
  const adj = new Map(tablas.map((t) => [t, []]));
  for (const f of aristas) adj.get(f.hijo).push(f.padre);
  let idx = 0;
  const pila = [], enPila = new Set(), indice = new Map(), bajo = new Map(), comp = new Map();
  let nComp = 0;
  const visitar = (v) => {
    indice.set(v, idx); bajo.set(v, idx); idx++;
    pila.push(v); enPila.add(v);
    for (const w of adj.get(v)) {
      if (!indice.has(w)) { visitar(w); bajo.set(v, Math.min(bajo.get(v), bajo.get(w))); }
      else if (enPila.has(w)) bajo.set(v, Math.min(bajo.get(v), indice.get(w)));
    }
    if (bajo.get(v) === indice.get(v)) {
      let w;
      do { w = pila.pop(); enPila.delete(w); comp.set(w, nComp); } while (w !== v);
      nComp++;
    }
  };
  for (const t of tablas) if (!indice.has(t)) visitar(t);

  const cerrarCiclo = aristas.filter((f) => comp.get(f.hijo) === comp.get(f.padre));
  // Algunas FK de ciclo tienen CHECK que impide anularlas (cuenta_por_pagar
  // exige factura_id si viene de factura): se prueba en un savepoint y, si
  // falla, se rompe el ciclo por el otro lado.
  const rotas = new Set();
  for (const f of cerrarCiclo) {
    if (!f.anulable) continue;
    const set = f.columnas.map((c) => `${c} = NULL`).join(", ");
    await cliente.query("SAVEPOINT ciclo");
    try {
      await cliente.query(`UPDATE contabilidad.${f.hijo} SET ${set}`);
      await cliente.query("RELEASE SAVEPOINT ciclo");
      rotas.add(f);
    } catch {
      await cliente.query("ROLLBACK TO SAVEPOINT ciclo");
    }
  }

  // Orden topológico: se borra primero el hijo (Kahn sobre las FK restantes).
  const dependientes = new Map(tablas.map((t) => [t, new Set()])); // padre -> hijos
  for (const f of aristas) if (!rotas.has(f)) dependientes.get(f.padre).add(f.hijo);
  const orden = [];
  const pendientes = new Set(tablas);
  while (pendientes.size) {
    const listas = [...pendientes].filter((t) => [...dependientes.get(t)].every((h) => !pendientes.has(h)));
    if (!listas.length) throw new Error("No se pudo ordenar el borrado: " + [...pendientes].join(", "));
    for (const t of listas) { orden.push(t); pendientes.delete(t); }
  }

  // --- Disparadores a suspender (todos menos bitácora y TRUNCATE) ---
  const { rows: trg } = await cliente.query(
    `SELECT c.relname AS tabla, t.tgname
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal AND c.relnamespace = 'contabilidad'::regnamespace
        AND c.relname = ANY ($1::text[])
        AND t.tgname NOT LIKE 'tg\\_bitacora%' AND t.tgname NOT LIKE 'tg\\_sin\\_truncate%'`,
    [tablas],
  );
  for (const t of trg) await cliente.query(`ALTER TABLE contabilidad.${t.tabla} DISABLE TRIGGER ${t.tgname}`);

  // --- Lo público que apunta a facturas y movimientos de caja ---
  await cliente.query(
    `UPDATE public.rendicion_gasto SET factura_proveedor_id = NULL, movimiento_caja_id = NULL
      WHERE factura_proveedor_id IS NOT NULL OR movimiento_caja_id IS NOT NULL`,
  );

  // --- Borrado, hijos primero ---
  for (const t of orden) await cliente.query(`DELETE FROM contabilidad.${t}`);

  // --- Saldos en cero (los de bancos y cajas son columnas guardadas) ---
  const { rowCount: bancos } = await cliente.query(
    `UPDATE contabilidad.cuenta_bancaria SET saldo_inicial = 0 WHERE saldo_inicial <> 0`,
  );
  const { rowCount: cajas } = await cliente.query(
    `UPDATE contabilidad.caja SET saldo_actual = 0 WHERE saldo_actual <> 0`,
  );

  // --- Reactivar y verificar ---
  for (const t of trg) await cliente.query(`ALTER TABLE contabilidad.${t.tabla} ENABLE TRIGGER ${t.tgname}`);
  const { rows: mal } = await cliente.query(
    `SELECT c.relname, t.tgname, t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal AND c.relnamespace = 'contabilidad'::regnamespace AND t.tgenabled <> 'O'`,
  );
  if (mal.length) throw new Error("Quedaron disparadores sin habilitar: " + JSON.stringify(mal));

  // --- Constancia en la bitácora por su canal normal (INSERT; el
  // encadenado de hash lo escribe su disparador) ---
  await cliente.query(
    `INSERT INTO contabilidad.bitacora
       (usuario_id, usuario_nombre, usuario_email, usuario_rol, agente, accion, tabla, despues, motivo, hash)
     SELECT u.id, u.nombre, u.email::text, r.nombre, $2, 'anular', 'reinicio_contabilidad', $3::jsonb,
            'Reinicio de la contabilidad de prueba antes del catálogo Global Effect (0107)', ''
       FROM public.usuario u JOIN public.rol r ON r.id = u.rol_id WHERE u.id = $1::uuid`,
    [usu[0].id, AGENTE, JSON.stringify({ filas_borradas: antes, bancos_en_cero: bancos, cajas_en_cero: cajas })],
  );

  console.log("Filas borradas por tabla:");
  for (const t of orden) console.log(`  ${t.padEnd(24)} ${antes[t]}`);
  console.log(`Cuentas bancarias con saldo_inicial puesto en 0: ${bancos}; cajas: ${cajas}`);
  console.log(`Disparadores suspendidos y reactivados: ${trg.length} (verificado, todos habilitados)`);

  if (CONFIRMAR) {
    await cliente.query("COMMIT");
    console.log("COMMIT: contabilidad reiniciada. Ahora corre `npm run db:migrate` (0107).");
  } else {
    await cliente.query("ROLLBACK");
    console.log("ENSAYO: ROLLBACK, la base no cambió. Usa --confirmar para aplicar.");
  }
} catch (e) {
  await cliente.query("ROLLBACK");
  console.error("Falló, ROLLBACK:", e.message);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
