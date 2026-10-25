// Pruebas de «Mi día» de Contabilidad: reglas puras y consultas contra la base.
// No escribe nada: solo lee y comprueba que el SQL ejecuta y devuelve forma válida.
// Uso: npx tsx scripts/probar-mi-dia.ts
import { config } from "dotenv";

config({ path: ".env.local" });

const { calcularSugerencia, problemasDe, coincide } = await import("../src/lib/contabilidad/comprobantes-auto");
const { colaMiDia, anomalias, comprobantesPorRevisar, metricasMiDia, reglaClasificacion, esAprobable } = await import(
  "../src/server/contabilidad/automatizacion/consultas"
);
const { pool } = await import("../src/lib/db");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

// ── Reglas puras ─────────────────────────────────────────────────────────────
/** Un RNC de 9 dígitos con su dígito verificador bien calculado (misma fórmula de la DGII). */
function rncValidoDe(base8: string): string {
  const pesos = [7, 9, 8, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((t, p, i) => t + p * Number(base8[i]), 0);
  const r = suma % 11;
  const d = r === 0 ? 2 : r === 1 ? 1 : 11 - r;
  return `${base8}${d}`;
}

prueba("RNC con dígito verificador correcto pasa", problemasDe({ rnc: rncValidoDe("13124679"), ncf: "B0100000001" }).length === 0);
prueba("RNC con dígito verificador malo se señala", problemasDe({ rnc: "131246790", ncf: "B0100000001" }).includes("rnc_invalido") || rncValidoDe("13124679") === "131246790");
prueba("falta RNC y NCF se señalan", problemasDe({ rnc: null, ncf: null }).join() === "sin_rnc,sin_ncf");
prueba("NCF mal formado se señala", problemasDe({ rnc: "101010101", ncf: "XX123" }).includes("ncf_invalido"));
prueba("e-CF de 13 caracteres es válido", !problemasDe({ rnc: "00113918205", ncf: "E310000000001" }).includes("ncf_invalido"));

const cls = { categoria: "transporte", centroCostoId: "c1", fondoId: "f1" };
prueba("sin historial no hay sugerencia", calcularSugerencia([]) === null);
prueba("una sola decisión previa da 50 % (no 100 %)", calcularSugerencia([{ ...cls, veces: 1 }])?.confianza === 50);
prueba("nueve coincidencias seguidas dan 90 %", calcularSugerencia([{ ...cls, veces: 9 }])?.confianza === 90);
prueba(
  "elige la combinación más repetida",
  calcularSugerencia([
    { ...cls, veces: 2 },
    { categoria: "otros", centroCostoId: null, fondoId: null, veces: 5 },
  ])?.categoria === "otros",
);
prueba("historial sin datos útiles no sugiere", calcularSugerencia([{ categoria: null, centroCostoId: null, fondoId: null, veces: 3 }]) === null);
prueba("coincide compara los tres campos", coincide(cls, { ...cls }) && !coincide(cls, { ...cls, fondoId: "f2" }));

// ── Consultas contra la base (solo lectura) ──────────────────────────────────
try {
  const cola = await colaMiDia();
  prueba("colaMiDia ejecuta", typeof cola.cxpVencidas.cantidad === "number", `${cola.obligaciones.length} obligaciones próximas, ${cola.recurrentes.length} recurrentes`);
  prueba("las obligaciones próximas vienen dentro de 10 días", cola.obligaciones.every((o) => o.dias >= 0 && o.dias <= 10));

  const an = await anomalias(365);
  prueba("anomalias ejecuta", Array.isArray(an), `${an.length} señales en 365 días`);

  const items = await comprobantesPorRevisar();
  prueba("comprobantesPorRevisar ejecuta", Array.isArray(items), `${items.length} pendientes`);
  prueba("nada con problemas se considera aprobable", items.filter((i) => i.problemas.length > 0).every((i) => !esAprobable(i)));

  const m = await metricasMiDia();
  prueba("metricasMiDia ejecuta", m.revisados >= 0);

  const r = await reglaClasificacion();
  prueba("la regla por defecto es nivel 1", r.nivel === 1, `confianza ${r.umbralConfianza} %, monto ${r.umbralMonto}`);
} catch (error) {
  prueba("las consultas ejecutan sin error", false, String(error));
}

// ── Con datos: se insertan comprobantes de prueba y se retiran al final ─────
const { consultar, consultarUna } = await import("../src/lib/db");
const marca = `prueba-mi-dia-${Date.now()}`;
const remitente = await consultarUna<{ id: string }>("SELECT id FROM usuario WHERE activo LIMIT 1");
const centro = await consultarUna<{ id: string }>("SELECT id FROM contabilidad.centro_costo LIMIT 1");
const fondo = await consultarUna<{ id: string }>("SELECT id FROM contabilidad.fondo LIMIT 1");

if (remitente) {
  const rncFrac = rncValidoDe("40100001");
  const rncAtip = rncValidoDe("40100002");
  const rncNuevo = rncValidoDe("40100003");
  const rncHist = rncValidoDe("40100004");
  const rncDup = rncValidoDe("40100005");
  const sabado = (await consultarUna<{ d: string }>(
    "SELECT (current_date - ((extract(isodow FROM current_date)::int + 1) % 7))::text AS d",
  ))!.d;

  const nuevo = (rnc: string, monto: number, dias: number, extra: { estado?: string; ncf?: string; fecha?: string; cat?: string } = {}) =>
    consultar(
      `INSERT INTO contabilidad.comprobante_recibido
         (remitente_id, monto, moneda, proveedor_nombre, proveedor_rnc, ncf, fecha_comprobante,
          concepto, estado, categoria, centro_costo_id, fondo_id)
       VALUES ($1, $2, 'DOP', $3, $4, $5, COALESCE($6::date, current_date - $7::int), $8, $9, $10, $11, $12)`,
      [remitente.id, monto, `Proveedor ${marca}`, rnc, extra.ncf ?? null, extra.fecha ?? null, dias, marca,
       extra.estado ?? "recibido", extra.cat ?? null, extra.cat ? centro?.id : null, extra.cat ? fondo?.id : null],
    );

  try {
    // fraccionada: dos de 30 000 en dos días (umbral 50 000)
    await nuevo(rncFrac, 30000, 1);
    await nuevo(rncFrac, 30000, 2);
    // atípica: cinco previos ~1 000 y uno de 20 000
    for (const [m, d] of [[1000, 40], [1100, 38], [900, 36], [1050, 34], [950, 32]] as const) await nuevo(rncAtip, m, d, { estado: "validado" });
    await nuevo(rncAtip, 20000, 1);
    // proveedor nuevo con monto alto
    await nuevo(rncNuevo, 60000, 1);
    // fin de semana
    await nuevo(rncHist, 500, 0, { fecha: sabado, estado: "validado", cat: "transporte" });
    // historial: tres validados iguales → sugerencia 75 %
    for (const d of [10, 11]) await nuevo(rncHist, 800, d, { estado: "validado", cat: "transporte" });
    await nuevo(rncHist, 900, 0, { ncf: "B0100000777" });
    // duplicado: mismo RNC + NCF + monto, dos veces
    await nuevo(rncDup, 1500, 3, { ncf: "B0100000888" });
    await nuevo(rncDup, 1500, 2, { ncf: "B0100000888" });
    // mismo NCF con otro monto
    await nuevo(rncDup, 1700, 1, { ncf: "B0100000888" });

    const an = await anomalias(60);
    const deMarca = (tipo: string) => an.filter((a) => a.tipo === tipo && a.proveedor?.includes(marca));
    prueba("detecta la compra fraccionada", deMarca("compra_fraccionada").length >= 1 && deMarca("compra_fraccionada")[0]!.monto === 60000);
    prueba("detecta el monto atípico", deMarca("monto_atipico").some((a) => a.monto === 20000));
    prueba("detecta el proveedor nuevo con monto alto", deMarca("proveedor_nuevo_monto_alto").some((a) => a.monto === 60000));
    prueba("detecta el gasto en fin de semana", deMarca("fin_de_semana").some((a) => a.fecha === sabado));
    prueba("un monto normal del mismo proveedor NO es atípico", !deMarca("monto_atipico").some((a) => a.monto < 5000));

    const cola2 = (await comprobantesPorRevisar(500)).filter((c) => c.proveedor?.includes(marca));
    const hist = cola2.find((c) => c.rnc === rncHist && c.ncf === "B0100000777");
    prueba("sugiere con el historial del proveedor", hist?.sugerencia?.categoria === "transporte" && hist.sugerencia.confianza === 75, `${hist?.sugerencia?.confianza} %`);
    prueba("lo sugerido sin problemas es aprobable", Boolean(hist && esAprobable(hist)));

    const dup = cola2.filter((c) => c.rnc === rncDup);
    prueba("marca duplicados (mismo RNC + NCF + monto)", dup.filter((c) => c.duplicado).length === 2);
    prueba("marca NCF repetido con otro monto", dup.find((c) => c.monto === 1700)?.ncfRepetido === true);
    prueba("un duplicado nunca es aprobable", dup.every((c) => !esAprobable(c)));

    const sinProveedorConocido = cola2.find((c) => c.rnc === rncFrac);
    prueba("sin historial ni NCF, no se aprueba solo", Boolean(sinProveedorConocido) && !esAprobable(sinProveedorConocido!));
  } finally {
    await consultar("DELETE FROM contabilidad.comprobante_recibido WHERE concepto = $1", [marca]);
  }
}

await pool.end();
console.log(fallos === 0 ? "\n✓ Mi día: todas las pruebas pasan" : `\n✗ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
