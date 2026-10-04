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
 * Se salta los archivos con cero o más de un `getTranslations`/`useTranslations`,
 * porque ahí no se puede saber a qué espacio pertenece cada `t()` sin analizar
 * el alcance de las variables. Son pocos y se revisan a mano.
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

for (const f of archivos) {
  const src = readFileSync(f, "utf8");
  const espacios = [
    ...new Set([...src.matchAll(/(?:get|use)Translations\("([\w.]+)"\)/g)].map((m) => m[1])),
  ];
  if (espacios.length === 0) continue;
  if (espacios.length > 1) {
    revisarAMano++;
    continue;
  }
  const claves = new Set([
    // t("clave") y t("clave", { … })
    ...[...src.matchAll(/\bt\("([\w.]+)"[,)]/g)].map((m) => m[1]),
    // t(`prefijo.${x}`) → basta con comprobar que exista el prefijo, porque
    // cuelga de él un objeto entero.
    ...[...src.matchAll(/\bt\(`([\w.]+)\.\$\{/g)].map((m) => m[1]),
  ]);

  // t(`prefijo_${x}`) y t(`prefijo_${x}_sufijo`): la clave resultante es PLANA,
  // así que no hay ningún nodo "prefijo" que comprobar como en el caso del
  // punto. Saber qué valores toma `x` exigiría seguir el alcance de las
  // variables, y adivinarlo cruzando los arrays del archivo produce
  // combinaciones que no existen (probado: 27 falsos positivos).
  //
  // Se comprueba entonces algo más débil pero que no se equivoca nunca: que
  // exista **al menos una** clave con ese prefijo. Basta para el fallo real que
  // motivó este script —`eventType_` no tenía ninguna y salía a pantalla— y
  // deja pasar, eso sí, el caso de que falte solo una variante entre varias.
  const prefijosPlanos = new Set(
    [...src.matchAll(/\bt\(`([\w]+_)\$\{/g)].map((m) => m[1]),
  );
  for (const [idioma, diccionario] of Object.entries(msgs)) {
    const raiz = espacios[0].split(".").reduce((n, p) => n?.[p], diccionario);
    for (const k of claves) {
      if (!existe(raiz, k)) faltan[idioma].push(`${espacios[0]}.${k}  (${f})`);
    }
    for (const prefijo of prefijosPlanos) {
      const hayAlguna =
        raiz && typeof raiz === "object" && Object.keys(raiz).some((k) => k.startsWith(prefijo));
      if (!hayAlguna) {
        faltan[idioma].push(`${espacios[0]}.${prefijo}*  — ninguna variante  (${f})`);
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
      (revisarAMano ? ` (${revisarAMano} archivo(s) con varios espacios, sin comprobar)` : ""),
  );
}
