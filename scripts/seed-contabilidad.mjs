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
  const categorias = [
    // Ingresos
    { nombre: "Donaciones nacionales",     tipo: "ingreso" },
    { nombre: "Donaciones internacionales",tipo: "ingreso" },
    { nombre: "Aportes de patrocinadores", tipo: "ingreso" },
    { nombre: "Cuotas de programas",       tipo: "ingreso" },
    { nombre: "Otros ingresos",            tipo: "ingreso" },
    // Egresos
    { nombre: "Nómina",                    tipo: "egreso" },
    { nombre: "Alquiler",                  tipo: "egreso" },
    { nombre: "Servicios básicos",         tipo: "egreso" },
    { nombre: "Materiales y suministros",  tipo: "egreso" },
    { nombre: "Transporte",                tipo: "egreso" },
    { nombre: "Comunicaciones",            tipo: "egreso" },
    { nombre: "Equipos y tecnología",      tipo: "egreso" },
    { nombre: "Capacitación",              tipo: "egreso" },
    { nombre: "Gastos bancarios",          tipo: "egreso" },
    { nombre: "Impuestos y retenciones",   tipo: "egreso" },
    { nombre: "Gastos de operación",       tipo: "egreso" },
    { nombre: "Caja chica",                tipo: "egreso" },
    { nombre: "Otros egresos",             tipo: "egreso" },
  ];

  for (const c of categorias) {
    await cliente.query(
      `INSERT INTO contabilidad.categoria (nombre, tipo)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO NOTHING`,
      [c.nombre, c.tipo],
    );
  }
  console.log("  ✓ Categorías");
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
      hasta: "2026-12-31",
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
       ON CONFLICT DO NOTHING`,
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

async function main() {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const usuarioId = await obtenerIdUsuarioSistema(cliente);
    await fijarContexto(cliente, usuarioId);

    console.log("Sembrando contabilidad…");
    await seedSecuencias(cliente);
    await seedFondo(cliente);
    await seedCategorias(cliente);
    await seedCatalogoCuentas(cliente);
    await seedParametrosNomina(cliente);
    await seedPeriodoActual(cliente);

    await cliente.query("COMMIT");
    console.log("✅ db:seed:contabilidad completado.");
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
