/**
 * Comprueba que cada enlace relativo de los .md del repo apunte a un archivo
 * que existe. Nació con la reorganización de la documentación (oct 2026), que
 * movió trece archivos de la raíz a docs/: un enlace roto no falla en ningún
 * build, solo lleva al lector —o al agente— a un 404.
 *
 * Uso: npm run docs:check
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
const raiz = process.cwd();
const md = [];
(function rec(d) {
  for (const e of readdirSync(d)) {
    if (["node_modules", ".git", ".next"].includes(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) rec(p);
    else if (p.endsWith(".md")) md.push(p);
  }
})(raiz);
// El disco de macOS no distingue mayúsculas: `PROGRESO.md` "existe" aunque el
// archivo se llame `progreso.md`. Se compara cada tramo contra el listado real.
function existeExacto(ruta) {
  if (!existsSync(ruta)) return false;
  const tramos = ruta.split("/").filter(Boolean);
  let actual = "/";
  for (const t of tramos) {
    if (!readdirSync(actual).includes(t)) return false;
    actual = join(actual, t);
  }
  return true;
}
let rotos = 0;
for (const f of md) {
  const texto = readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const m of texto.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    let destino = m[1];
    if (/^(https?:|mailto:|#)/.test(destino)) continue;
    destino = decodeURIComponent(destino.split("#")[0]);
    if (!destino) continue;
    if (!existeExacto(resolve(dirname(f), destino))) {
      rotos++;
      console.log(`${f.replace(raiz + "/", "")}: ${m[1]}`);
    }
  }
}
console.log(rotos ? `\n${rotos} enlace(s) roto(s)` : "Cero enlaces rotos");
process.exit(rotos ? 1 : 0);
