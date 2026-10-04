/**
 * Auditoría de internacionalización.
 *
 * Existe porque este fallo ya se coló dos veces: tres pantallas de Académico y
 * media landing se entregaron sin sus claves en `messages/*.json` y salían a
 * pantalla como "academic.terms.title" y "landing.panelNow". No lo detecta
 * nada: `tsc` no mira dentro de un `t("...")`, ESLint tampoco, y el build pasa
 * en verde porque next-intl no rompe cuando falta una clave — la imprime.
 *
 * Comprueba dos cosas:
 *   1. Que cada `t("clave")` del código exista en los dos diccionarios.
 *   2. Que `es.json` y `en.json` tengan exactamente el mismo juego de claves.
 *
 * Resuelve qué variable (`t`, `tc`, `tm`…) apunta a qué espacio, en las tres
 * formas que usa el repo: `getTranslations("x")`, `getTranslations({ locale,
 * namespace: "x" })` y los `getTranslations` dentro de un `Promise.all`.
 *
 * La versión anterior solo leía la primera forma y se SALTABA todo archivo
 * con la segunda —la mayoría de las páginas—, así que el login y la landing
 * salían a pantalla como "landing.searchPill" con el chequeo en verde.
 *
 * Devuelve código de salida 1 si encuentra algo, para poder encadenarlo.
 *
 * Uso: npm run i18n:check
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const IDIOMAS = ["es", "en"];
const msgs = Object.fromEntries(
  IDIOMAS.map((i) => [i, JSON.parse(readFileSync(`messages/${i}.json`, "utf8"))]),
);

/** ¿Existe `a.b.c` colgando de `raiz`? */
const existe = (raiz, ruta) =>
  ruta.split(".").reduce((n, p) => (n && typeof n === "object" ? n[p] : undefined), raiz) !==
  undefined;

const archivos = [];
(function recorrer(dir) {
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (/\.tsx?$/.test(p)) archivos.push(p);
  }
})("src");

const faltan = Object.fromEntries(IDIOMAS.map((i) => [i, []]));
let revisarAMano = 0;

/**
 * El espacio de una llamada `getTranslations(...)` / `useTranslations(...)`:
 * `("x")`, `({ locale, namespace: "x" })` o nada (raíz). `null` si el
 * espacio es una expresión que no se puede leer sin ejecutar el código.
 */
function espacioDe(argumentos) {
  const a = argumentos.trim();
  if (a === "") return "";
  let m = a.match(/^"([\w.]+)"$/);
  if (m) return m[1];
  if (a.startsWith("{")) {
    m = a.match(/namespace:\s*"([\w.]+)"/);
    if (m) return m[1];
    return /namespace\s*[:,}]/.test(a) ? null : "";
  }
  return null;
}

/** Corta `texto` por las comas de primer nivel (fuera de () [] {} y cadenas). */
function partirPorComas(texto) {
  const partes = [];
  let nivel = 0, desde = 0, comilla = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) { if (c === comilla && texto[i - 1] !== "\\") comilla = null; continue; }
    if (c === '"' || c === "'" || c === "`") comilla = c;
    else if ("([{".includes(c)) nivel++;
    else if (")]}".includes(c)) nivel--;
    else if (c === "," && nivel === 0) { partes.push(texto.slice(desde, i)); desde = i + 1; }
  }
  partes.push(texto.slice(desde));
  return partes.map((p) => p.trim()).filter(Boolean);
}

/** Desde un "(" devuelve el texto hasta su ")" pareja. */
function hastaCierre(texto, apertura) {
  let nivel = 0;
  for (let i = apertura; i < texto.length; i++) {
    if (texto[i] === "(" || texto[i] === "[") nivel++;
    else if (texto[i] === ")" || texto[i] === "]") { nivel--; if (nivel === 0) return texto.slice(apertura + 1, i); }
  }
  return "";
}

/**
 * Qué variable apunta a qué espacio en un archivo. Cubre las tres formas
 * del repo: `const t = await getTranslations(...)`, `const t =
 * useTranslations(...)` y `const [t, tc, datos] = await Promise.all([
 * getTranslations(...), getTranslations(...), consulta() ])`.
 */
function variablesDe(src) {
  // Una declaración por aparición, con su posición: el mismo nombre (`t`)
  // se declara en cada componente del archivo con un espacio distinto.
  const vars = [];
  let dudosas = 0;
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:get|use)Translations\(/g)) {
    const ns = espacioDe(hastaCierre(src, m.index + m[0].length - 1));
    if (ns === null) dudosas++; else vars.push({ nombre: m[1], ns, pos: m.index });
  }
  for (const m of src.matchAll(/(?:const|let)\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\s*\[/g)) {
    const nombres = m[1].split(",").map((n) => n.trim());
    const elementos = partirPorComas(hastaCierre(src, m.index + m[0].length - 1));
    nombres.forEach((nombre, i) => {
      const el = elementos[i] ?? "";
      const llamada = el.match(/^(?:get|use)Translations\(/);
      if (!llamada || !/^\w+$/.test(nombre)) return;
      const ns = espacioDe(hastaCierre(el, llamada[0].length - 1));
      if (ns === null) dudosas++; else vars.push({ nombre, ns, pos: m.index });
    });
  }
  return { vars, dudosas };
}

const raizDe = (diccionario, ns) =>
  ns ? ns.split(".").reduce((n, p) => n?.[p], diccionario) : diccionario;

for (const f of archivos) {
  const src = readFileSync(f, "utf8");
  if (!/(?:get|use)Translations\(/.test(src)) continue;
  const { vars, dudosas } = variablesDe(src);
  revisarAMano += dudosas;

  // Cada llamada se atribuye a la declaración de su variable más cercana
  // ANTES de ella: es la que está en su alcance en el código real.
  const declaracionDe = (nombre, pos) =>
    vars.filter((d) => d.nombre === nombre && d.pos < pos).sort((x, y) => y.pos - x.pos)[0];
  const usadas = []; // { ns, clave, plana }

  for (const nombre of new Set(vars.map((d) => d.nombre))) {
    const v = nombre.replace(/\$/g, "\\$");
    const patrones = [
      // v("clave") y v("clave", { … })
      [new RegExp(`\\b${v}\\("([\\w.]+)"[,)]`, "g"), false],
      // v(`prefijo.${x}`) → basta con que exista el prefijo.
      [new RegExp(`\\b${v}\\(\`([\\w.]+)\\.\\$\\{`, "g"), false],
      // v(`prefijo_${x}`): clave PLANA. Saber qué valores toma `x` exigiría
      // seguir el alcance (probado: 27 falsos positivos); se comprueba algo
      // más débil que no se equivoca: que exista al menos una variante.
      [new RegExp(`\\b${v}\\(\`(\\w+_)\\$\\{`, "g"), true],
    ];
    for (const [patron, plana] of patrones) {
      for (const m of src.matchAll(patron)) {
        const d = declaracionDe(nombre, m.index);
        if (d) usadas.push({ ns: d.ns, clave: m[1], plana });
      }
    }
  }

  for (const { ns, clave, plana } of usadas) {
    const nombre = ns ? `${ns}.${clave}` : clave;
    for (const [idioma, diccionario] of Object.entries(msgs)) {
      const raiz = raizDe(diccionario, ns);
      if (plana) {
        const hayAlguna =
          raiz && typeof raiz === "object" && Object.keys(raiz).some((k) => k.startsWith(clave));
        if (!hayAlguna) faltan[idioma].push(`${nombre}*  — ninguna variante  (${f})`);
      } else if (!existe(raiz, clave)) {
        faltan[idioma].push(`${nombre}  (${f})`);
      }
    }
  }
}

/** Todas las claves de un diccionario, aplanadas a "a.b.c". */
const planas = (d, pre = "") =>
  Object.entries(d).flatMap(([k, v]) =>
    v && typeof v === "object" ? planas(v, `${pre}${k}.`) : [`${pre}${k}`],
  );

const [es, en] = [new Set(planas(msgs.es)), new Set(planas(msgs.en))];
const soloEs = [...es].filter((k) => !en.has(k));
const soloEn = [...en].filter((k) => !es.has(k));

let fallo = false;
for (const idioma of IDIOMAS) {
  const ks = [...new Set(faltan[idioma])].sort();
  if (ks.length === 0) continue;
  fallo = true;
  console.error(`\n! ${idioma}: ${ks.length} clave(s) usada(s) en el código y sin traducir`);
  ks.forEach((k) => console.error("   ", k));
}
if (soloEs.length) {
  fallo = true;
  console.error(`\n! solo en es.json: ${soloEs.join(", ")}`);
}
if (soloEn.length) {
  fallo = true;
  console.error(`\n! solo en en.json: ${soloEn.join(", ")}`);
}

if (fallo) {
  process.exitCode = 1;
} else {
  console.log(
    `✓ i18n en orden: ${es.size} claves, es/en simétricos` +
      (revisarAMano ? ` (${revisarAMano} llamada(s) con un espacio calculado, sin comprobar)` : ""),
  );
}
