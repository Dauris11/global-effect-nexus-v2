/**
 * Datos de demostración de contabilidad, un documento por cada estado.
 *
 * Complementa a `seed-demo-estados.mjs` (esquema público) y a
 * `seed-contabilidad.mjs` (catálogo, cuentas, parámetros). Aquí van los
 * documentos del día a día en todos sus estados —facturas, cuentas por pagar,
 * órdenes de compra, donaciones, recibos, nómina, declaraciones…— para que
 * el módulo se pueda recorrer con algo que ver.
 *
 * No fabrica asientos contables: un asiento a mano puede descuadrar el libro
 * o romper la cadena de hash de la bitácora, y esas reglas viven en la capa
 * servidor. Por eso los documentos «aprobados» o «contabilizados» de esta
 * demo no traen `asiento_id`; el cuadre real se prueba con
 * `npm run db:probar:contabilidad`.
 *
 * La bitácora se alimenta por trigger y necesita el contexto de sesión
 * (`app.usuario_id`…), igual que en `seed-contabilidad.mjs`.
 *
 * Idempotente (ids derivados de claves fijas). Requiere db:seed:contabilidad.
 *
 * Uso: npm run db:seed:demo:contabilidad
 */
import { createHash } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

function uid(clave) {
  const h = createHash("md5").update(`ge-demo-cont:${clave}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function dia(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
const instante = (dias) => new Date(Date.now() + dias * 86_400_000).toISOString();

const cuenta = {};
const generadasPorTabla = {};
const una = async (sql, p = []) => (await db.query(sql, p)).rows[0];
/**
 * `serie` pide un número correlativo: se reutiliza el de la fila si ya existe
 * (así repetir el seed no gasta numeración) y si no, se toma de la secuencia.
 */
async function upsert(tabla, fila, conflicto = ["id"], serie = null, campo = "numero") {
  if (serie) {
    const previo = await una(`SELECT ${campo} AS n FROM contabilidad.${tabla} WHERE id = $1`, [fila.id]);
    fila = { ...fila, [campo]: previo?.n ?? (await una(`SELECT contabilidad.siguiente_numero($1) AS n`, [serie])).n };
  }
  // Las columnas generadas (total, saldo, diferencia…) las calcula Postgres.
  const generadas = (generadasPorTabla[tabla] ??= new Set(
    (await db.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'contabilidad' AND table_name = $1
          AND (is_generated = 'ALWAYS' OR identity_generation = 'ALWAYS')`,
      [tabla],
    )).rows.map((r) => r.column_name),
  ));
  const cols = Object.keys(fila).filter((c) => !generadas.has(c));
  const vals = cols.map((c) => {
    const v = fila[c];
    return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
  });
  const resto = cols.filter((c) => !conflicto.includes(c));
  await db.query(
    `INSERT INTO contabilidad.${tabla} (${cols.map((c) => `"${c}"`).join(", ")})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})
     ON CONFLICT (${conflicto.map((c) => `"${c}"`).join(", ")})
     ${resto.length ? `DO UPDATE SET ${resto.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")}` : "DO NOTHING"}`,
    vals,
  );
  cuenta[tabla] = (cuenta[tabla] ?? 0) + 1;
}

const email = async (e) => (await una(`SELECT id FROM public.usuario WHERE email = $1`, [e]))?.id;
const ADMIN = await email("admin@globaleffect.org");
const CONTA = await email("contabilidad@globaleffect.org");
const COORD = await email("coordinacion@globaleffect.org");
const HABIT = await email("habitudes@globaleffect.org");
const DOCENTE = await email("docente@globaleffect.org");
const CHOFER = await email("chofer@globaleffect.org");
if (!ADMIN || !CONTA) {
  console.error("Faltan usuarios base. Corre antes npm run db:seed:usuarios.");
  process.exit(1);
}

const hoy = new Date();
const PERIODO = (await una(`SELECT id FROM contabilidad.periodo_contable WHERE anio = $1 AND mes = $2`, [hoy.getFullYear(), hoy.getMonth() + 1]))?.id;
const FONDO = (await una(`SELECT id FROM contabilidad.fondo ORDER BY creado_en LIMIT 1`))?.id;
const CAT_EGR = (await una(`SELECT id FROM contabilidad.categoria WHERE tipo IN ('egreso','ambos') AND activa ORDER BY nombre LIMIT 1`))?.id;
const CAT_ING = (await una(`SELECT id FROM contabilidad.categoria WHERE tipo IN ('ingreso','ambos') AND activa ORDER BY nombre LIMIT 1`))?.id;
const CUENTA_BANCO = (await una(`SELECT id FROM contabilidad.cuenta_bancaria WHERE estado = 'activa' ORDER BY creado_en LIMIT 1`))?.id;
const CENTRO = (await una(`SELECT id FROM contabilidad.centro_costo ORDER BY codigo LIMIT 1`))?.id;
const CAJA = (await una(`SELECT id FROM contabilidad.caja WHERE estado = 'activa' ORDER BY creado_en LIMIT 1`))?.id;
if (!PERIODO || !FONDO || !CAT_EGR || !CAT_ING) {
  console.error("Falta el catálogo contable (periodo, fondo o categorías). Corre antes npm run db:seed:contabilidad.");
  process.exit(1);
}

await db.query("BEGIN");
try {
  // Contexto que exige la bitácora encadenada.
  await db.query(
    `SELECT set_config('app.usuario_id', $1, true), set_config('app.ip', 'seed', true),
            set_config('app.agente', 'seed-demo-contabilidad.mjs', true), set_config('app.sesion', 'seed', true)`,
    [ADMIN],
  );

  // ---- Proveedores (ambos estados) --------------------------------------
  const PROV = [
    ["juridica", "131045671", "Ferretería Vega Real SRL", "activo", 30],
    ["juridica", "101823456", "Distribuidora Cibao Alimentos SRL", "activo", 15],
    ["fisica", "04701234567", "Rafael Contreras (servicios eléctricos)", "activo", 0],
    ["juridica", "130776543", "Imprenta Moderna EIRL", "inactivo", 30],
  ].map(([tipo, identificacion, nombre, estado, dias], i) => ({
    id: uid(`prov:${i}`), tipo, identificacion, nombre, contacto: "Departamento de ventas", telefono: `809-555-04${i}0`,
    email: `ventas${i}@proveedor.do`, direccion: "La Vega, República Dominicana", condiciones_pago_dias: dias,
    categoria_id: CAT_EGR, estado, creado_por: CONTA,
  }));
  for (const p of PROV) await upsert("proveedor", p);
  const PROV_ID = async (i) => (await una(`SELECT id FROM contabilidad.proveedor WHERE identificacion = $1`, [PROV[i].identificacion])).id;

  // ---- Facturas y cuentas por pagar (todos los estados) -----------------
  const FACT = [
    ["borrador", 12000, "pendiente"], ["aprobada", 8500, "programada"], ["aprobada", 15600, "pagada_parcial"],
    ["aprobada", 4300, "pagada"], ["anulada", 2750, "anulada"], ["aprobada", 6400, "pendiente"],
  ];
  for (const [i, [estado, subtotal, estadoCxp]] of FACT.entries()) {
    const proveedor_id = await PROV_ID(i % 3);
    const itbis = +(subtotal * 0.18).toFixed(2);
    const factura = uid(`fac:${i}`);
    await upsert("factura_proveedor", {
      id: factura, proveedor_id, ncf: `B01000001${i}0`, fecha_emision: dia(-20 + i * 3), fecha_vencimiento: dia(10 + i * 5),
      periodo_id: PERIODO, moneda: "DOP", subtotal, itbis, concepto: ["Materiales de oficina", "Alimentos para taller", "Reparación eléctrica", "Papelería", "Impresión de afiches", "Mantenimiento de aire acondicionado"][i],
      categoria_id: CAT_EGR, fondo_id: FONDO, estado, creado_por: CONTA,
      aprobado_por: estado === "aprobada" ? ADMIN : null, aprobado_en: estado === "aprobada" ? instante(-5) : null,
      anulado_por: estado === "anulada" ? ADMIN : null, anulado_en: estado === "anulada" ? instante(-2) : null,
      motivo_anulacion: estado === "anulada" ? "Factura duplicada por el proveedor." : null,
    }, ["id"], "FP");
    if (estado === "borrador") continue;
    const monto = subtotal + itbis;
    const pagado = { pendiente: 0, programada: 0, pagada_parcial: +(monto / 2).toFixed(2), pagada: monto, anulada: 0 }[estadoCxp];
    await upsert("cuenta_por_pagar", {
      id: uid(`cxp:${i}`), origen: "factura", factura_id: factura, proveedor_id, concepto: `Factura ${i + 1}`, moneda: "DOP", monto,
      pagado, fecha_emision: dia(-20 + i * 3), fecha_vencimiento: dia(estadoCxp === "pendiente" ? -3 : 10 + i * 5),
      fecha_programada: estadoCxp === "programada" ? dia(7) : null, cuenta_salida_id: CUENTA_BANCO,
      categoria_id: CAT_EGR, fondo_id: FONDO, estado: estadoCxp, creado_por: CONTA,
      anulado_por: estadoCxp === "anulada" ? ADMIN : null, anulado_en: estadoCxp === "anulada" ? instante(-2) : null,
      motivo_anulacion: estadoCxp === "anulada" ? "Factura anulada." : null,
    });
  }

  // ---- Órdenes de compra (los seis estados) -----------------------------
  const ESTADOS_OC = ["borrador", "pendiente_aprobacion", "aprobada", "rechazada", "facturada", "cancelada"];
  for (const [i, estado] of ESTADOS_OC.entries()) {
    const id = uid(`oc:${i}`);
    const subtotal = 5000 + i * 1800, itbis = +(subtotal * 0.18).toFixed(2);
    await upsert("orden_compra", {
      id, proveedor_id: await PROV_ID(i % 3), fecha: dia(-15 + i * 2), fecha_entrega: dia(5 + i), moneda: "DOP", subtotal, itbis, total: subtotal + itbis,
      fondo_id: FONDO, categoria_id: CAT_EGR, estado, justificacion: "Reposición necesaria para las actividades del trimestre.",
      creado_por: CONTA, centro_costo_id: CENTRO,
      aprobado_por: ["aprobada", "facturada"].includes(estado) ? ADMIN : null, aprobado_en: ["aprobada", "facturada"].includes(estado) ? instante(-4) : null,
      motivo_rechazo: estado === "rechazada" ? "Excede el presupuesto del programa; cotizar de nuevo." : null,
    }, ["id"], "OC");
    await upsert("orden_compra_linea", {
      id: uid(`ocl:${i}`), orden_compra_id: id, numero_linea: 1, descripcion: ["Sillas plásticas", "Resmas de papel", "Pizarras acrílicas", "Tóner HP", "Marcadores", "Extensiones eléctricas"][i],
      cantidad: 10, precio_unitario: subtotal / 10, itbis_tasa: 0.18, monto_itbis: itbis, subtotal, total: subtotal + itbis,
    });
  }

  // ---- Donaciones, promesas y cuotas ------------------------------------
  const DONANTES = [
    ["juridica", "rnc", "130456789", "Grupo Ramos Industrial"], ["fisica", "cedula", "00112345678", "Carlos Almánzar"],
    ["juridica", "rnc", "401501234", "Iglesia Bautista Central"],
  ];
  for (const [i, [tp, ti, ident, nombre]] of DONANTES.entries()) {
    await upsert("tercero", {
      id: uid(`ter:${i}`), tipo_persona: tp, tipo_id: ti, identificacion: ident, nombre_razon_social: nombre, telefono: "809-555-0600",
      email: `donante${i}@correo.do`, pais: "DO", es_donante: true, activo: true, creado_por: CONTA,
    }, ["id"]);
  }
  for (const [i, estado] of ["borrador", "confirmada", "anulada"].entries()) {
    await upsert("donacion", {
      id: uid(`don:${i}`), tercero_id: uid(`ter:${i}`), fecha: dia(-12 + i * 3), periodo_id: PERIODO, clase: "efectivo", tratamiento: "exento",
      moneda: "DOP", monto: 25000 + i * 10000, fondo_id: FONDO, cuenta_bancaria_id: CUENTA_BANCO, estado, creado_por: CONTA,
      notas: "Donación de demostración.", confirmado_por: estado === "confirmada" ? ADMIN : null, confirmado_en: estado === "confirmada" ? instante(-6) : null,
      anulado_por: estado === "anulada" ? ADMIN : null, anulado_en: estado === "anulada" ? instante(-1) : null,
      motivo_anulacion: estado === "anulada" ? "Depósito rechazado por el banco." : null,
    }, ["id"], "DON");
  }
  for (const [i, estado] of ["activa", "cumplida", "cancelada"].entries()) {
    const promesa = uid(`prom:${i}`);
    await upsert("promesa_donacion", {
      id: promesa, tercero_id: uid(`ter:${i}`), fecha_compromiso: dia(-60), monto_total: 60000, moneda: "DOP", frecuencia: "mensual",
      fondo_id: FONDO, estado, creado_por: CONTA, notas: "Compromiso anual en cuotas.",
    }, ["id"], "PRM");
    const ESTADOS_CUOTA = { activa: ["cobrada", "vencida", "pendiente", "pendiente"], cumplida: ["cobrada", "cobrada", "cobrada", "cobrada"], cancelada: ["cobrada", "cancelada", "cancelada", "cancelada"] }[estado];
    for (const [k, ec] of ESTADOS_CUOTA.entries()) {
      await upsert("promesa_cuota", {
        id: uid(`cuota:${i}:${k}`), promesa_id: promesa, numero_cuota: k + 1, fecha_vencimiento: dia(-45 + k * 30), monto: 15000,
        monto_cobrado: ec === "cobrada" ? 15000 : 0, estado: ec,
      });
    }
  }

  // ---- Recibos (3 estados) y movimientos de caja chica -------------------
  // «contabilizado» ya existe (lo creó la siembra contable con su asiento real):
  // la restricción exige movimiento y asiento, que no se fabrican a mano.
  for (const [i, estado] of ["borrador", "contabilizado", "anulado"].entries()) {
    if (estado === "contabilizado") continue;
    await upsert("recibo", {
      id: uid(`rec:${i}`), tipo: i === 1 ? "ingreso" : "egreso", fecha: dia(-8 + i * 2), periodo_id: PERIODO, cuenta_bancaria_id: CUENTA_BANCO,
      moneda: "DOP", monto: 3200 + i * 900, concepto: ["Pago de energía eléctrica", "Cobro de cuota de patrocinio", "Pago duplicado de agua"][i],
      categoria_id: i === 1 ? CAT_ING : CAT_EGR, fondo_id: FONDO, beneficiario: ["EDENORTE", "Hope Foundation US", "CAASD"][i],
      forma_pago: ["transferencia", "deposito", "cheque"][i], estado, creado_por: CONTA,
      contabilizado_por: estado === "contabilizado" ? ADMIN : null, contabilizado_en: estado === "contabilizado" ? instante(-3) : null,
      anulado_por: estado === "anulado" ? ADMIN : null, anulado_en: estado === "anulado" ? instante(-1) : null,
      motivo_anulacion: estado === "anulado" ? "Registrado dos veces." : null,
    }, ["id"], i === 1 ? "RI" : "CE");
  }
  if (CAJA) {
    for (const [i, estado] of ["pendiente", "completado", "anulado"].entries()) {
      await upsert("caja_movimiento", {
        id: uid(`cm:${i}`), caja_id: CAJA, fecha: dia(-4 + i), periodo_id: PERIODO, tipo: ["vale", "gasto", "ajuste"][i], monto: 450 + i * 300,
        concepto: ["Vale para compra de refrigerio", "Gasto de transporte a liceo", "Ajuste por error de digitación"][i], persona_id: [HABIT, CHOFER, DOCENTE][i],
        estado, creado_por: CONTA,
      }, ["id"], "CJ");
    }
    for (const [i, estado] of ["abierto", "cerrado", "aprobado"].entries()) {
      await upsert("arqueo", {
        id: uid(`arq:${i}`), caja_id: CAJA, fecha: dia(-14 * (i + 1)), periodo_id: PERIODO, saldo_sistema: 5000, saldo_contado: i === 1 ? 4850 : 5000,
        estado, justificacion: i === 1 ? "Faltante por vale sin liquidar." : null, creado_por: CONTA,
        revisado_por: estado === "aprobado" ? ADMIN : null, revisado_en: estado === "aprobado" ? instante(-10) : null,
      }, ["id"], "AR");
    }
  }

  // ---- Comprobantes recibidos por chat (cinco estados) -------------------
  const COMPROBANTES = [
    ["recibido", HABIT, 1850], ["validado", CHOFER, 2400], ["observado", DOCENTE, 960], ["rechazado", HABIT, 15000], ["contabilizado", CHOFER, 3300],
  ];
  for (const [i, [estado, remitente_id, monto]] of COMPROBANTES.entries()) {
    await upsert("comprobante_recibido", {
      id: uid(`cr:${estado}`), remitente_id, monto, moneda: "DOP", itbis: +(monto * 0.18 / 1.18).toFixed(2),
      proveedor_nombre: ["Ferretería Vega Real", "Estación Sunix", "Librería Cibao", "Restaurante El Fogón", "Supermercado Nacional"][i],
      proveedor_rnc: `13100${i}4567`, ncf: `B0200000${i}00`, tipo_ncf: "B02", fecha_comprobante: dia(-6 + i), concepto: ["Materiales", "Combustible", "Libros de texto", "Almuerzo de taller", "Insumos de cocina"][i],
      estado, observaciones: estado === "observado" ? "Falta el RNC del proveedor." : estado === "rechazado" ? "Gasto sin relación con el programa." : null,
      revisado_por: estado === "recibido" ? null : CONTA, revisado_en: estado === "recibido" ? null : instante(-1),
    }, ["id"], "CR", "folio");
  }

  // ---- Declaraciones DGII (estados y tipos) ------------------------------
  for (const [i, [tipo, estado]] of [["606", "borrador"], ["607", "generada"], ["IT-1", "presentada"], ["608", "anulada"]].entries()) {
    await upsert("declaracion", {
      id: uid(`decl:${i}`), tipo, ejercicio: hoy.getFullYear(), periodo: `${hoy.getFullYear()}${String(((hoy.getMonth() + 11) % 12) + 1).padStart(2, "0")}`,
      estado, total_operaciones: 12 + i * 3, monto_total: 85000 + i * 12000, impuesto_determinado: 15300 + i * 2000,
      generado_por: CONTA, presentado_por: estado === "presentada" ? CONTA : null, fecha_presentacion: estado === "presentada" ? dia(-5) : null,
      numero_autorizacion_dgii: estado === "presentada" ? "DGII-2026-004521" : null, notas: "Declaración de demostración.",
    }, ["id"]);
  }

  // ---- Presupuestos (tres estados) --------------------------------------
  for (const [i, estado] of ["borrador", "aprobado", "cerrado"].entries()) {
    await upsert("presupuesto", {
      id: uid(`pres:${i}`), ejercicio: hoy.getFullYear() - 1 + i, nombre: `Presupuesto institucional ${hoy.getFullYear() - 1 + i}`, estado,
      notas: "Presupuesto de demostración.", creado_por: CONTA, aprobado_por: estado === "borrador" ? null : ADMIN, aprobado_en: estado === "borrador" ? null : instante(-30),
    }, ["id"]);
  }

  // ---- Alertas de control interno ---------------------------------------
  for (const [i, tipo] of ["mismo_registra_aprueba", "pago_fuera_horario", "diferencia_caja"].entries()) {
    await upsert("alerta", {
      id: uid(`alerta:${i}`), tipo, severidad: ["alta", "media", "media"][i], tabla: "factura_proveedor", detalle: { origen: "seed-demo", nota: "Alerta de demostración" },
      revisada_por: i === 2 ? CONTA : null, revisada_en: i === 2 ? instante(-1) : null, nota_revision: i === 2 ? "Se justificó el faltante." : null,
    });
  }

  await db.query("COMMIT");
} catch (e) {
  await db.query("ROLLBACK");
  console.error("Falló el sembrado contable (se revirtió todo):", e.message);
  process.exitCode = 1;
}
await db.end();
if (!process.exitCode) {
  console.log("Contabilidad de demostración sembrada:");
  for (const [t, n] of Object.entries(cuenta)) console.log(`  ${t.padEnd(24)} ${n}`);
}
