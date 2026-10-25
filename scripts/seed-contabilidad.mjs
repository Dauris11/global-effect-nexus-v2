#!/usr/bin/env node
// scripts/seed-contabilidad.mjs
// Seed idempotente del módulo de contabilidad.
//
// Ejecutar: npm run db:seed:contabilidad
// (o node scripts/seed-contabilidad.mjs)
//
// Qué siembra:
//   - Catálogo de cuentas básico para una ASFL dominicana
//   - Categorías de ingresos y egresos
//   - Fondo "General"
//   - Parámetros de nómina vigentes (TSS 2026, ISR 2026 y 2027)
//     con tasas del empleador marcadas como NULL + nota "validar con el contador"
//   - Secuencias: RI, CE, PG, CH, AR, AS, NM, FP
//   - Período del mes actual (abierto)
//
// El seed es idempotente: si ya existen los datos, los actualiza
// sin duplicar. Nunca borra datos contables.
//
// El banco "Banco Múltiple Santa Cruz" y sus cuentas DEMO (USD y DOP) se
// siembran en la Fase 2, que es la que crea las tablas `banco` y
// `cuenta_bancaria`.

import pg from "pg";
import { config } from "dotenv";

// Inyectar .env.local antes de leer process.env (igual que migrate.mjs)
config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL solo en conexiones remotas (Supabase/Supavisor).
  // En local (localhost o 127.0.0.1) Postgres no tiene SSL.
  ssl: process.env.DATABASE_URL?.includes("supabase.co")
    ? { rejectUnauthorized: false }
    : undefined,
});

// Usuario de sistema para el contexto de la bitácora durante el seed.
// Este usuario DEBE existir en public.usuario antes de correr el seed.
// En Supabase, el primer super_admin tiene este email por defecto.
const SISTEMA_EMAIL = process.env.ADMIN_MAESTRO_EMAIL ?? "admin@globaleffect.org";

async function obtenerIdUsuarioSistema(cliente) {
  const { rows } = await cliente.query(
    `SELECT id FROM public.usuario WHERE email = $1 LIMIT 1`,
    [SISTEMA_EMAIL],
  );
  if (!rows[0]) {
    throw new Error(
      `Usuario sistema (${SISTEMA_EMAIL}) no encontrado. Ejecuta db:seed antes.`,
    );
  }
  return rows[0].id;
}

async function fijarContexto(cliente, usuarioId) {
  await cliente.query(
    `SELECT
       set_config('app.usuario_id', $1, true),
       set_config('app.ip',         'seed', true),
       set_config('app.agente',     'seed-contabilidad.mjs', true),
       set_config('app.sesion',     'seed', true)`,
    [usuarioId],
  );
}

async function seedSecuencias(cliente) {
  const series = [
    { clave: "RI", prefijo: "RI-" },  // Recibo de Ingreso
    { clave: "CE", prefijo: "CE-" },  // Comprobante de Egreso
    { clave: "PG", prefijo: "PG-" },  // Pago
    { clave: "CH", prefijo: "CH-" },  // Cheque
    { clave: "AR", prefijo: "AR-" },  // Arqueo de caja
    { clave: "AS", prefijo: "AS-" },  // Asiento contable
    { clave: "NM", prefijo: "NM-" },  // Nómina
    { clave: "FP", prefijo: "FP-" },  // Factura de proveedor
    { clave: "TR", prefijo: "TR-" },  // Transferencia interna
    { clave: "MB", prefijo: "MB-" },  // Movimiento bancario
  ];

  for (const s of series) {
    await cliente.query(
      `INSERT INTO contabilidad.secuencia (clave, prefijo, siguiente)
       VALUES ($1, $2, 1)
       ON CONFLICT (clave) DO NOTHING`,
      [s.clave, s.prefijo],
    );
  }
  console.log("  ✓ Secuencias");
}

async function seedFondo(cliente) {
  await cliente.query(
    `INSERT INTO contabilidad.fondo (nombre, descripcion)
     VALUES ('General', 'Fondo operativo general de la Fundación')
     ON CONFLICT (nombre) DO NOTHING`,
  );
  console.log("  ✓ Fondo General");
}

async function seedCategorias(cliente) {
  // `cuenta` es la contrapartida del asiento que genera un recibo de esa
  // categoría: sin ella, contabilizar_recibo() se niega. `legado` es el
  // código de la 0011 que devuelve la vista `transaccion`.
  const categorias = [
    // Ingresos
    { nombre: "Donaciones nacionales",      tipo: "ingreso", cuenta: "4.1.01.01", legado: "donacion" },
    { nombre: "Donaciones internacionales", tipo: "ingreso", cuenta: "4.1.01.02", legado: "donacion" },
    { nombre: "Aportes de patrocinadores",  tipo: "ingreso", cuenta: "4.1.01.03", legado: "beca" },
    { nombre: "Cuotas de programas",        tipo: "ingreso", cuenta: "4.2.01.01", legado: "otro" },
    { nombre: "Otros ingresos",             tipo: "ingreso", cuenta: "4.9.01.02", legado: "otro" },
    // Egresos
    { nombre: "Becas y ayudas",             tipo: "egreso",  cuenta: "5.4.01.03", legado: "beca" },
    { nombre: "Nómina",                     tipo: "egreso",  cuenta: "5.1.01.01", legado: "salario" },
    { nombre: "Alquiler",                   tipo: "egreso",  cuenta: "5.2.01.01", legado: "operativo" },
    { nombre: "Servicios básicos",          tipo: "egreso",  cuenta: "5.2.01.02", legado: "operativo" },
    { nombre: "Materiales y suministros",   tipo: "egreso",  cuenta: "5.2.01.04", legado: "material" },
    { nombre: "Transporte",                 tipo: "egreso",  cuenta: "5.2.01.05", legado: "operativo" },
    { nombre: "Comunicaciones",             tipo: "egreso",  cuenta: "5.2.01.03", legado: "operativo" },
    { nombre: "Equipos y tecnología",       tipo: "egreso",  cuenta: "1.2.01.01", legado: "material" },
    { nombre: "Capacitación",               tipo: "egreso",  cuenta: "5.4.01.01", legado: "evento" },
    { nombre: "Gastos bancarios",           tipo: "egreso",  cuenta: "5.3.01.01", legado: "operativo" },
    { nombre: "Impuestos y retenciones",    tipo: "egreso",  cuenta: "5.9.01.01", legado: "otro" },
    { nombre: "Gastos de operación",        tipo: "egreso",  cuenta: "5.2.01.06", legado: "operativo" },
    { nombre: "Caja chica",                 tipo: "egreso",  cuenta: "5.9.01.01", legado: "operativo" },
    { nombre: "Otros egresos",              tipo: "egreso",  cuenta: "5.9.01.01", legado: "otro" },
  ];

  for (const c of categorias) {
    await cliente.query(
      `INSERT INTO contabilidad.categoria (nombre, tipo, cuenta_id, codigo_legado)
       VALUES ($1, $2, (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = $3), $4)
       ON CONFLICT (nombre) DO UPDATE SET
         cuenta_id = coalesce(contabilidad.categoria.cuenta_id, EXCLUDED.cuenta_id),
         codigo_legado = EXCLUDED.codigo_legado`,
      [c.nombre, c.tipo, c.cuenta, c.legado],
    );
  }
  console.log("  ✓ Categorías con su cuenta contable");
}

async function seedCatalogoCuentas(cliente) {
  // Catálogo básico para una ASFL (Asociación Sin Fines de Lucro) dominicana.
  // El contador de la Fundación debe validar y ajustar desde Configuración.
  // Formato de código: nivel1.nivel2.nivel3
  const cuentas = [
    // ACTIVOS
    { codigo: "1",       nombre: "ACTIVOS",                      tipo: "activo",    padre: null, hoja: false },
    { codigo: "1.1",     nombre: "Activo Corriente",             tipo: "activo",    padre: "1",  hoja: false },
    { codigo: "1.1.01",  nombre: "Efectivo y Equivalentes",      tipo: "activo",    padre: "1.1",hoja: false },
    { codigo: "1.1.01.01", nombre: "Caja General",               tipo: "activo",    padre: "1.1.01", hoja: true },
    { codigo: "1.1.01.02", nombre: "Caja Chica",                 tipo: "activo",    padre: "1.1.01", hoja: true },
    { codigo: "1.1.02",  nombre: "Bancos",                       tipo: "activo",    padre: "1.1",hoja: false },
    { codigo: "1.1.02.01", nombre: "Banco Santa Cruz - DOP",     tipo: "activo",    padre: "1.1.02", hoja: true },
    { codigo: "1.1.02.02", nombre: "Banco Santa Cruz - USD",     tipo: "activo",    padre: "1.1.02", hoja: true },
    { codigo: "1.1.03",  nombre: "Cuentas por Cobrar",           tipo: "activo",    padre: "1.1",hoja: false },
    { codigo: "1.1.03.01", nombre: "Anticipos a empleados",      tipo: "activo",    padre: "1.1.03", hoja: true },
    { codigo: "1.2",     nombre: "Activo No Corriente",          tipo: "activo",    padre: "1",  hoja: false },
    { codigo: "1.2.01",  nombre: "Equipos y Tecnología",         tipo: "activo",    padre: "1.2",hoja: false },
    { codigo: "1.2.01.01", nombre: "Computadoras y equipos",     tipo: "activo",    padre: "1.2.01", hoja: true },
    { codigo: "1.2.01.02", nombre: "Depreciación acumulada - equipos", tipo: "activo", padre: "1.2.01", hoja: true },
    // PASIVOS
    { codigo: "2",       nombre: "PASIVOS",                      tipo: "pasivo",    padre: null, hoja: false },
    { codigo: "2.1",     nombre: "Pasivo Corriente",             tipo: "pasivo",    padre: "2",  hoja: false },
    { codigo: "2.1.01",  nombre: "Cuentas por Pagar",            tipo: "pasivo",    padre: "2.1",hoja: false },
    { codigo: "2.1.01.01", nombre: "Proveedores nacionales",     tipo: "pasivo",    padre: "2.1.01", hoja: true },
    { codigo: "2.1.01.02", nombre: "Proveedores internacionales",tipo: "pasivo",    padre: "2.1.01", hoja: true },
    { codigo: "2.1.02",  nombre: "Retenciones por pagar",        tipo: "pasivo",    padre: "2.1",hoja: false },
    { codigo: "2.1.02.01", nombre: "ISR retenido empleados",     tipo: "pasivo",    padre: "2.1.02", hoja: true },
    { codigo: "2.1.02.02", nombre: "ITBIS retenido proveedores", tipo: "pasivo",    padre: "2.1.02", hoja: true },
    { codigo: "2.1.03",  nombre: "Nómina por pagar",             tipo: "pasivo",    padre: "2.1",hoja: false },
    { codigo: "2.1.03.01", nombre: "Sueldos por pagar",          tipo: "pasivo",    padre: "2.1.03", hoja: true },
    { codigo: "2.1.03.02", nombre: "TSS por pagar (empleado)",   tipo: "pasivo",    padre: "2.1.03", hoja: true },
    { codigo: "2.1.03.03", nombre: "TSS por pagar (empleador)",  tipo: "pasivo",    padre: "2.1.03", hoja: true },
    // PATRIMONIO
    { codigo: "3",       nombre: "PATRIMONIO",                   tipo: "patrimonio", padre: null, hoja: false },
    { codigo: "3.1",     nombre: "Patrimonio Social",            tipo: "patrimonio", padre: "3",  hoja: false },
    { codigo: "3.1.01.01", nombre: "Superávit / Déficit del ejercicio", tipo: "patrimonio", padre: "3.1", hoja: true },
    { codigo: "3.1.01.02", nombre: "Resultados acumulados",      tipo: "patrimonio", padre: "3.1", hoja: true },
    // INGRESOS
    { codigo: "4",       nombre: "INGRESOS",                     tipo: "ingreso",   padre: null, hoja: false },
    { codigo: "4.1",     nombre: "Donaciones y Aportes",         tipo: "ingreso",   padre: "4",  hoja: false },
    { codigo: "4.1.01.01", nombre: "Donaciones nacionales",      tipo: "ingreso",   padre: "4.1",hoja: true },
    { codigo: "4.1.01.02", nombre: "Donaciones internacionales", tipo: "ingreso",   padre: "4.1",hoja: true },
    { codigo: "4.1.01.03", nombre: "Aportes de patrocinadores",  tipo: "ingreso",   padre: "4.1",hoja: true },
    { codigo: "4.2",     nombre: "Ingresos por Programas",       tipo: "ingreso",   padre: "4",  hoja: false },
    { codigo: "4.2.01.01", nombre: "Cuotas de programas",        tipo: "ingreso",   padre: "4.2",hoja: true },
    { codigo: "4.9",     nombre: "Otros Ingresos",               tipo: "ingreso",   padre: "4",  hoja: false },
    { codigo: "4.9.01.01", nombre: "Intereses bancarios",        tipo: "ingreso",   padre: "4.9",hoja: true },
    { codigo: "4.9.01.02", nombre: "Otros ingresos varios",      tipo: "ingreso",   padre: "4.9",hoja: true },
    { codigo: "4.9.01.03", nombre: "Diferencia cambiaria (ganancia)", tipo: "ingreso", padre: "4.9", hoja: true },
    // GASTOS
    { codigo: "5",       nombre: "GASTOS",                       tipo: "gasto",     padre: null, hoja: false },
    { codigo: "5.1",     nombre: "Gastos de Personal",           tipo: "gasto",     padre: "5",  hoja: false },
    { codigo: "5.1.01.01", nombre: "Sueldos y salarios",         tipo: "gasto",     padre: "5.1",hoja: true },
    { codigo: "5.1.01.02", nombre: "TSS empleador",              tipo: "gasto",     padre: "5.1",hoja: true },
    { codigo: "5.1.01.03", nombre: "Regalía pascual",            tipo: "gasto",     padre: "5.1",hoja: true },
    { codigo: "5.1.01.04", nombre: "Vacaciones",                 tipo: "gasto",     padre: "5.1",hoja: true },
    { codigo: "5.2",     nombre: "Gastos Operativos",            tipo: "gasto",     padre: "5",  hoja: false },
    { codigo: "5.2.01.01", nombre: "Alquiler",                   tipo: "gasto",     padre: "5.2",hoja: true },
    { codigo: "5.2.01.02", nombre: "Electricidad y agua",        tipo: "gasto",     padre: "5.2",hoja: true },
    { codigo: "5.2.01.03", nombre: "Internet y comunicaciones",  tipo: "gasto",     padre: "5.2",hoja: true },
    { codigo: "5.2.01.04", nombre: "Materiales y suministros",   tipo: "gasto",     padre: "5.2",hoja: true },
    { codigo: "5.2.01.05", nombre: "Transporte y movilización",  tipo: "gasto",     padre: "5.2",hoja: true },
    { codigo: "5.2.01.06", nombre: "Mantenimiento y reparaciones",tipo: "gasto",    padre: "5.2",hoja: true },
    { codigo: "5.3",     nombre: "Gastos Bancarios",             tipo: "gasto",     padre: "5",  hoja: false },
    { codigo: "5.3.01.01", nombre: "Comisiones bancarias",       tipo: "gasto",     padre: "5.3",hoja: true },
    { codigo: "5.3.01.02", nombre: "Diferencial cambiario",      tipo: "gasto",     padre: "5.3",hoja: true },
    { codigo: "5.4",     nombre: "Gastos de Programas",          tipo: "gasto",     padre: "5",  hoja: false },
    { codigo: "5.4.01.01", nombre: "Capacitación y formación",   tipo: "gasto",     padre: "5.4",hoja: true },
    { codigo: "5.4.01.02", nombre: "Materiales de programas",    tipo: "gasto",     padre: "5.4",hoja: true },
    { codigo: "5.4.01.03", nombre: "Becas otorgadas",            tipo: "gasto",     padre: "5.4",hoja: true },
    { codigo: "5.9",     nombre: "Otros Gastos",                 tipo: "gasto",     padre: "5",  hoja: false },
    { codigo: "5.9.01.01", nombre: "Gastos varios",              tipo: "gasto",     padre: "5.9",hoja: true },
  ];

  // Insertar en dos pasadas: primero los que no tienen padre (nivel 1),
  // luego los demás (que referencian a los del nivel anterior).
  // Ordenar por profundidad del código garantiza el orden correcto.
  const ordenados = cuentas.sort((a, b) =>
    (a.codigo.split(".").length - b.codigo.split(".").length) ||
    a.codigo.localeCompare(b.codigo)
  );

  for (const c of ordenados) {
    let padreId = null;
    if (c.padre) {
      const { rows } = await cliente.query(
        `SELECT id FROM contabilidad.cuenta_contable WHERE codigo = $1`,
        [c.padre],
      );
      padreId = rows[0]?.id ?? null;
    }

    await cliente.query(
      `INSERT INTO contabilidad.cuenta_contable
         (codigo, nombre, tipo, padre_id, admite_movimiento)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (codigo) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         tipo   = EXCLUDED.tipo,
         padre_id = EXCLUDED.padre_id,
         admite_movimiento = EXCLUDED.admite_movimiento`,
      [c.codigo, c.nombre, c.tipo, padreId, c.hoja],
    );
  }
  console.log("  ✓ Catálogo de cuentas ASFL");
}

async function seedParametrosNomina(cliente) {
  const hoy = new Date().toISOString().slice(0, 10);

  const parametros = [
    // ── TSS 2026 (empleado) ──────────────────────────────────────
    // Topes vigentes desde el 1 de febrero de 2026 (Circular TSS)
    {
      clave: "tss.afp.empleado.tasa",
      valor: 0.0287,
      desde: "2026-02-01",
      fuente: "Circular TSS 2026",
      nota: "AFP empleado 2.87 %",
    },
    {
      clave: "tss.sfs.empleado.tasa",
      valor: 0.0304,
      desde: "2026-02-01",
      fuente: "Circular TSS 2026",
      nota: "SFS empleado 3.04 %",
    },
    {
      clave: "tss.afp.tope_mensual",
      valor: 464460.0,
      desde: "2026-02-01",
      fuente: "Circular TSS 2026",
      nota: "Tope SVDS/AFP mensual DOP",
    },
    {
      clave: "tss.sfs.tope_mensual",
      valor: 232230.0,
      desde: "2026-02-01",
      fuente: "Circular TSS 2026",
      nota: "Tope SFS mensual DOP",
    },
    {
      clave: "tss.srl.tope_mensual",
      valor: 92892.0,
      desde: "2026-02-01",
      fuente: "Circular TSS 2026",
      nota: "Tope SRL mensual DOP",
    },
    {
      clave: "tss.salario_minimo_cotizable",
      valor: 23223.0,
      desde: "2026-02-01",
      fuente: "Circular TSS 2026",
      nota: "Salario mínimo cotizable DOP",
    },

    // ── TSS (empleador) — tasas pendientes de validación ─────────
    // Estas tasas dependen de la categoría de riesgo que la Fundación
    // tenga asignada en la TSS. El contador debe validarlas y
    // actualizar los valores desde Configuración.
    {
      clave: "tss.afp.empleador.tasa",
      valor: null,
      desde: "2026-02-01",
      fuente: null,
      nota: "Tasa AFP empleador — validar con el contador. Varía según categoría de riesgo.",
    },
    {
      clave: "tss.sfs.empleador.tasa",
      valor: null,
      desde: "2026-02-01",
      fuente: null,
      nota: "Tasa SFS empleador — validar con el contador.",
    },
    {
      clave: "tss.srl.empleador.tasa",
      valor: null,
      desde: "2026-02-01",
      fuente: null,
      nota: "Tasa SRL empleador — validar con el contador. Depende de la categoría de riesgo asignada.",
    },
    {
      clave: "tss.infotep.empleador.tasa",
      valor: null,
      desde: "2026-02-01",
      fuente: null,
      nota: "Tasa INFOTEP empleador — validar con el contador.",
    },

    // ── ISR 2026 (escala anual) ──────────────────────────────────
    {
      clave: "isr.escala",
      valor: {
        anio: 2026,
        tramos: [
          { desde: 0,       hasta: 416220,  tasa: 0,    cuota_fija: 0        },
          { desde: 416220,  hasta: 624329,  tasa: 0.15, cuota_fija: 0        },
          { desde: 624329,  hasta: 867123,  tasa: 0.20, cuota_fija: 31216.35 },
          { desde: 867123,  hasta: null,    tasa: 0.25, cuota_fija: 79776.15 },
        ],
      },
      desde: "2026-01-01",
      hasta: "2027-01-01",
      fuente: "DGII — Escala ISR 2026",
      nota: "Escala anual del ISR personas físicas 2026 en DOP.",
    },

    // ── ISR 2027+ (Ley 30-26) ───────────────────────────────────
    // La Ley 30-26 modifica la escala a partir del año 2027.
    // Las nóminas de 2026 deben seguir usando la escala de 2026.
    {
      clave: "isr.escala",
      valor: {
        anio: 2027,
        ley: "30-26",
        tramos: [
          { desde: 0,         hasta: 480000,    tasa: 0,    cuota_fija: 0          },
          { desde: 480000,    hasta: 685000,    tasa: 0.15, cuota_fija: 0          },
          { desde: 685000,    hasta: 910000,    tasa: 0.20, cuota_fija: 30750      },
          { desde: 910000,    hasta: 4800000,   tasa: 0.25, cuota_fija: 75750      },
          { desde: 4800000,   hasta: null,      tasa: 0.27, cuota_fija: 1047750    },
        ],
      },
      desde: "2027-01-01",
      hasta: null,
      fuente: "Ley 30-26",
      nota: "Escala anual ISR 2027+ según Ley 30-26. Validar con DGII al inicio del ejercicio.",
    },
  ];

  for (const p of parametros) {
    await cliente.query(
      `INSERT INTO contabilidad.parametro
         (clave, valor, vigente_desde, vigente_hasta, fuente, nota)
       VALUES ($1, $2::jsonb, $3::date, $4::date, $5, $6)
       ON CONFLICT (clave, vigente_desde) DO NOTHING`,
      [
        p.clave,
        JSON.stringify(p.valor),
        p.desde,
        p.hasta ?? null,
        p.fuente ?? null,
        p.nota ?? null,
      ],
    );
  }
  console.log("  ✓ Parámetros de nómina (TSS 2026 + ISR 2026/2027)");
}

async function seedPeriodoActual(cliente) {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes  = hoy.getMonth() + 1;

  await cliente.query(
    `INSERT INTO contabilidad.periodo_contable (anio, mes, estado)
     VALUES ($1, $2, 'abierto')
     ON CONFLICT (anio, mes) DO NOTHING`,
    [anio, mes],
  );
  console.log(`  ✓ Período ${anio}-${String(mes).padStart(2, "0")} (abierto)`);
}

async function seedCajas(cliente, usuarioId) {
  const { rows: usu } = await cliente.query(
    `SELECT id FROM public.usuario WHERE email = 'contabilidad@globaleffect.org' LIMIT 1`,
  );
  const respId = usu[0]?.id ?? usuarioId;

  await cliente.query(
    `INSERT INTO contabilidad.caja
       (codigo, nombre, departamento, responsable_id, moneda, fondo_fijo, saldo_actual, umbral_adjunto, creado_por)
     VALUES
       ('CJ-OP-01', 'Caja Chica Operaciones La Vega', 'operaciones', $1, 'DOP', 15000.00, 15000.00, 500.00, $2),
       ('CJ-DIR-01', 'Caja Chica Dirección Ejecutiva', 'direccion', $1, 'DOP', 25000.00, 25000.00, 1000.00, $2)
     ON CONFLICT (codigo) DO NOTHING`,
    [respId, usuarioId],
  );
  console.log("  ✓ Cajas chicas demo (Operaciones y Dirección)");
}

async function seedTerceros(cliente, usuarioId) {
  const terceros = [
    {
      tipoPersona: "juridica",
      tipoId: "rnc",
      identificacion: "101001577",
      nombre: "Induveca S.A.",
      comercial: "Induveca",
      esDonante: true,
      esProveedor: false,
    },
    {
      tipoPersona: "juridica",
      tipoId: "rnc",
      identificacion: "101001471",
      nombre: "Compañía Dominicana de Teléfonos S.A.",
      comercial: "Claro Dominicana",
      esDonante: false,
      esProveedor: true,
    },
    {
      tipoPersona: "fisica",
      tipoId: "cedula",
      identificacion: "04700000018",
      nombre: "Lic. Juan Carlos Pérez",
      comercial: "Juan Pérez",
      esDonante: false,
      esProveedor: false,
      esEmpleado: true,
    },
  ];

  for (const t of terceros) {
    await cliente.query(
      `INSERT INTO contabilidad.tercero
         (tipo_persona, tipo_id, identificacion, nombre_razon_social, nombre_comercial, es_donante, es_proveedor, es_empleado, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tipo_id, identificacion) DO UPDATE SET
         nombre_razon_social = EXCLUDED.nombre_razon_social,
         es_donante = EXCLUDED.es_donante,
         es_proveedor = EXCLUDED.es_proveedor`,
      [
        t.tipoPersona,
        t.tipoId,
        t.identificacion,
        t.nombre,
        t.comercial,
        t.esDonante,
        t.esProveedor,
        t.esEmpleado ?? false,
        usuarioId,
      ],
    );
  }
  console.log("  ✓ Terceros demo (Donante, Proveedor, Empleado)");
}

async function seedFondosAvanzados(cliente) {
  const fondos = [
    {
      codigo: "FND-BECAS",
      nombre: "Fondo de Becas Universitarias",
      tipoRestriccion: "temporalmente_restringido",
      proposito: "Cobertura de matrículas y estipendios para estudiantes de grado",
      montoOriginal: 750000,
    },
    {
      codigo: "FND-COMEDOR",
      nombre: "Fondo de Nutrición y Comedor Comunitario",
      tipoRestriccion: "temporalmente_restringido",
      proposito: "Insumos alimenticios para el almuerzo diario de becados",
      montoOriginal: 400000,
    },
  ];

  for (const f of fondos) {
    await cliente.query(
      `INSERT INTO contabilidad.fondo
         (codigo, nombre, tipo_restriccion, proposito_restringido, monto_restringido_original)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (codigo) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         tipo_restriccion = EXCLUDED.tipo_restriccion`,
      [f.codigo, f.nombre, f.tipoRestriccion, f.proposito, f.montoOriginal],
    );
  }
  console.log("  ✓ Fondos restringidos institucionales");
}

async function seedEmpleados(cliente, usuarioId) {
  const { rows: ccRows } = await cliente.query(
    `SELECT id, codigo FROM contabilidad.centro_costo`,
  );
  const mapaCC = new Map(ccRows.map((r) => [r.codigo, r.id]));
  const ccAdmin = mapaCC.get("CC-ADMIN");

  // Obtener el tercero empleado que sembramos
  const { rows: tRows } = await cliente.query(
    `SELECT id FROM contabilidad.tercero WHERE identificacion = '04700000018' LIMIT 1`,
  );
  const terceroEmpleadoId = tRows[0]?.id;

  if (terceroEmpleadoId && ccAdmin) {
    await cliente.query(
      `INSERT INTO contabilidad.empleado
         (tercero_id, centro_costo_id, codigo_empleado, cargo, departamento, fecha_ingreso, salario_base)
       VALUES ($1, $2, 'EMP-001', 'Contador General', 'Contabilidad', '2024-01-15', 65000)
       ON CONFLICT (codigo_empleado) DO UPDATE SET
         salario_base = EXCLUDED.salario_base,
         cargo = EXCLUDED.cargo`,
      [terceroEmpleadoId, ccAdmin],
    );
    console.log("  ✓ Plantilla de empleados institucionales");
  }
}

async function seedActivosFijos(cliente, usuarioId) {
  const { rows: catRows } = await cliente.query(`SELECT id, codigo FROM contabilidad.activo_categoria`);
  const mapaCat = new Map(catRows.map((r) => [r.codigo, r.id]));

  const { rows: ccRows } = await cliente.query(`SELECT id, codigo FROM contabilidad.centro_costo`);
  const mapaCC = new Map(ccRows.map((r) => [r.codigo, r.id]));

  const cat2 = mapaCat.get("CAT-2");
  const cat3 = mapaCat.get("CAT-3");
  const ccAdmin = mapaCC.get("CC-ADMIN");
  const ccForm = mapaCC.get("CC-FORM360");

  if (cat2 && cat3 && ccAdmin && ccForm) {
    await cliente.query(
      `INSERT INTO contabilidad.activo_fijo
         (codigo, nombre, categoria_id, centro_costo_id, fecha_adquisicion, costo_adquisicion, valor_residual, valor_en_libros)
       VALUES
         ('AF-LAB-001', 'Lote de 10 Computadoras de Laboratorio', $1, $2, '2025-01-10', 350000, 35000, 350000),
         ('AF-MOB-001', 'Mobiliario de Aulas y Sillas Ergonómicas', $3, $4, '2025-02-15', 180000, 18000, 180000)
       ON CONFLICT (codigo) DO NOTHING`,
      [cat2, ccForm, cat3, ccAdmin],
    );
    console.log("  ✓ Activos fijos capitalizados (Computación y Mobiliario)");
  }
}

async function seedArticulosConsumibles(cliente) {
  const { rows: ctaInv } = await cliente.query(`SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.1.04.01'`);
  const { rows: ctaGas } = await cliente.query(`SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2.01.07'`);

  if (ctaInv[0] && ctaGas[0]) {
    const articulos = [
      { codigo: "ART-ALM-001", nombre: "Arroz Selecto Grano Largo", categoria: "alimentos_comedor", unidad: "kilo", stock: 150, costo: 42.50 },
      { codigo: "ART-ALM-002", nombre: "Habichuelas Rojas", categoria: "alimentos_comedor", unidad: "kilo", stock: 80, costo: 65.00 },
      { codigo: "ART-DID-001", nombre: "Cuadernos Universitarios de Líneas", categoria: "material_didactico", unidad: "unidad", stock: 200, costo: 85.00 },
    ];

    for (const a of articulos) {
      await cliente.query(
        `INSERT INTO contabilidad.articulo
           (codigo, nombre, categoria, unidad_medida, stock_actual, stock_minimo, costo_promedio, valor_total, cuenta_inventario_id, cuenta_gasto_id)
         VALUES ($1, $2, $3, $4, $5, 20, $6, $7, $8, $9)
         ON CONFLICT (codigo) DO UPDATE SET
           stock_actual = EXCLUDED.stock_actual,
           costo_promedio = EXCLUDED.costo_promedio,
           valor_total = EXCLUDED.valor_total`,
        [a.codigo, a.nombre, a.categoria, a.unidad, a.stock, a.costo, a.stock * a.costo, ctaInv[0].id, ctaGas[0].id],
      );
    }
    console.log("  ✓ Artículos de inventario consumibles y comedor");
  }
}

async function seedPeriodosAnioCompleto(cliente) {
  const anio = 2026;
  for (let m = 1; m <= 12; m++) {
    await cliente.query(
      `INSERT INTO contabilidad.periodo_contable (anio, mes, estado)
       VALUES ($1, $2, 'abierto')
       ON CONFLICT (anio, mes) DO NOTHING`,
      [anio, m],
    );
  }
  console.log(`  ✓ 12 Períodos del ejercicio ${anio}`);
}

async function main() {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const usuarioId = await obtenerIdUsuarioSistema(cliente);
    await fijarContexto(cliente, usuarioId);

    console.log("Sembrando contabilidad…");
    await seedSecuencias(cliente);
    await seedFondo(cliente);
    await seedCatalogoCuentas(cliente);
    await seedCategorias(cliente);
    await seedParametrosNomina(cliente);
    await seedPeriodoActual(cliente);
    await seedCajas(cliente, usuarioId);

    // Nuevas entidades integrales para el ERP
    await seedTerceros(cliente, usuarioId);
    await seedFondosAvanzados(cliente);
    await seedEmpleados(cliente, usuarioId);
    await seedActivosFijos(cliente, usuarioId);
    await seedArticulosConsumibles(cliente);
    await seedPeriodosAnioCompleto(cliente);

    await cliente.query("COMMIT");
    console.log("✅ db:seed:contabilidad completado con éxito.");

  } catch (err) {
    await cliente.query("ROLLBACK");
    console.error("❌ Error en seed:", err.message);
    process.exit(1);
  } finally {
    cliente.release();
    await pool.end();
  }
}

main();
