// Pruebas de los parámetros institucionales: validación, lectura con valores por
// defecto, el reglamento del asistente y el horario del comedor. La acción de
// guardar exige sesión y se prueba en pantalla.
// Uso: npx tsx scripts/probar-parametros.ts
import { config } from "dotenv";

config({ path: ".env.local" });

const P = await import("../src/lib/parametros");
const { parametros } = await import("../src/server/parametros/consultas");
const { reglamento } = await import("../src/server/ia/reglamento");
const { resumenDelComedor, estadoComedor } = await import("../src/server/comida/consultas");
const { consultar, pool } = await import("../src/lib/db");

let fallos = 0;
const prueba = (nombre: string, ok: boolean, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

const def = (clave: string) => P.definicionDe(clave)!;

// ── Validación ───────────────────────────────────────────────────────────────
prueba("hora válida", P.validarParametro(def("comedor.cierre"), " 09:15 ").ok);
prueba("hora imposible se rechaza", !P.validarParametro(def("comedor.cierre"), "25:00").ok);
prueba("hora sin formato se rechaza", !P.validarParametro(def("comedor.cierre"), "8:30").ok);
const idx = P.validarParametro(def("becas.indice_minimo"), "3,5");
prueba("el número acepta coma y fija los decimales", idx.ok && idx.valor === "3.50");
prueba("fuera de rango se rechaza", (() => { const r = P.validarParametro(def("becas.indice_minimo"), "4.5"); return !r.ok && r.error === "rango"; })());
prueba("texto en un número se rechaza", (() => { const r = P.validarParametro(def("becas.asistencia_minima"), "mucho"); return !r.ok && r.error === "numero"; })());
prueba("vacío no es 0", !P.validarParametro(def("becas.horas_servicio_mes"), "").ok);
prueba("el entero no lleva decimales", (() => { const r = P.validarParametro(def("becas.asistencia_minima"), "85.4"); return r.ok && r.valor === "85"; })());
prueba("correo válido, en minúsculas", (() => { const r = P.validarParametro(def("contacto.correo"), " Info@Fundacion.ORG "); return r.ok && r.valor === "info@fundacion.org"; })());
prueba("correo inválido se rechaza", !P.validarParametro(def("contacto.correo"), "no-es-correo").ok);

prueba("aMinutos y horaLegible", P.aMinutos("08:30") === 510 && P.horaLegible("08:30") === "8:30 AM" && P.horaLegible("00:05") === "12:05 AM" && P.horaLegible("13:00") === "1:00 PM");
prueba("todo valor por defecto es válido según su propia definición", P.DEFINICIONES.every((d) => P.validarParametro(d, String(d.defecto)).ok));
prueba("las claves son únicas", new Set(P.DEFINICIONES.map((d) => d.clave)).size === P.DEFINICIONES.length);

// ── Lectura: defecto, anulación, filas inválidas ─────────────────────────────
const claves = ["comedor.cierre", "becas.indice_minimo", "becas.asistencia_minima", "clave.inventada"];

try {
  const base = await parametros();
  prueba("sin filas, vale el valor por defecto", base["comedor.cierre"] === "08:30" && base["becas.indice_minimo"] === "3");

  await consultar(
    `INSERT INTO public.parametro_institucional (clave, valor) VALUES
       ('comedor.cierre', '09:00'), ('becas.indice_minimo', '3.50'),
       ('becas.asistencia_minima', '999'), ('clave.inventada', 'x')`,
  );
  const con = await parametros();
  prueba("una fila válida anula el valor por defecto", con["comedor.cierre"] === "09:00" && con["becas.indice_minimo"] === "3.50");
  prueba("una fila con valor imposible se ignora", con["becas.asistencia_minima"] === "80");
  prueba("una clave que no existe en el registro se ignora", !("clave.inventada" in con));

  // ── El reglamento del asistente usa los parámetros, no números escritos ────
  const texto = reglamento(con);
  prueba("el reglamento lleva el índice vigente", texto.includes("igual o superior a 3.50 sobre 4.00"));
  prueba("y el horario del comedor vigente", texto.includes("de 6:00 AM a 9:00 AM"));
  prueba("y no deja marcadores sin resolver", !texto.includes("${") && !texto.includes("undefined"));
  prueba("con los valores normales dice lo de siempre", reglamento(P.DEFECTOS).includes("3 sobre 4.00") && reglamento(P.DEFECTOS).includes("8 horas mensuales"));

  // ── El comedor: el horario manda sobre si está abierto ─────────────────────
  await consultar(`DELETE FROM public.parametro_institucional WHERE clave = ANY($1)`, [claves]);
  await consultar(`INSERT INTO public.parametro_institucional (clave, valor) VALUES ('comedor.apertura', '00:00'), ('comedor.cierre', '23:59')`);
  const abierto = await resumenDelComedor(null);
  prueba("con la ventana todo el día, el comedor está abierto", abierto.abierto === true && (await estadoComedor()).abierto === true);

  await consultar(`UPDATE public.parametro_institucional SET valor = '00:00' WHERE clave = 'comedor.cierre'`);
  // apertura = cierre → ventana vacía: cerrado
  prueba("con la ventana vacía, el comedor está cerrado", (await resumenDelComedor(null)).abierto === false);
} finally {
  await consultar(`DELETE FROM public.parametro_institucional WHERE clave = ANY($1)`, [[...claves, "comedor.apertura"]]);
}

const final = await parametros();
prueba("tras limpiar, todo vuelve a los valores por defecto", JSON.stringify(final) === JSON.stringify(P.DEFECTOS));

await pool.end();
console.log(fallos === 0 ? "\n✓ Parámetros: todas las pruebas pasan" : `\n✗ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
