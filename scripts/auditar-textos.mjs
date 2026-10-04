/**
 * Busca texto visible escrito a mano en el código, o sea sin pasar por i18n.
 *
 *   node scripts/auditar-textos.mjs [--todo]
 *
 * Recorre el árbol de sintaxis con el compilador de TypeScript en vez de con
 * expresiones regulares: un `>Hola<` dentro de una cadena, de un comentario o de
 * un `className` se parece muchísimo a texto de pantalla, y un grep no los
 * distingue. El árbol sí.
 *
 * Mira dos sitios, los dos que ve una persona:
 *
 *   · el texto suelto entre etiquetas —`<p>Hola</p>`—
 *   · los atributos que se leen o se oyen: placeholder, title, aria-label, alt,
 *     label y aria-placeholder. `className` o `href` no cuentan.
 *
 * Lo que NO es un hallazgo, y por qué:
 *
 *   · `src/components/ui/**` — primitivas de shadcn. Su texto es "Close" y
 *     similares en `sr-only`, y se traducen donde se usan, no dentro.
 *   · Marca y símbolos: "Global Effect", "GE", "·", "→", números, un guion.
 *   · Cadenas de una sola palabra en minúscula sin espacios: suelen ser valores
 *     técnicos (`utf-8`, `es-DO`) colados en un atributo de la lista.
 *
 * Con `--prosa` hace una segunda pasada más ancha: CUALQUIER cadena del archivo
 * que se lea como una frase —dos palabras o más, con mayúscula inicial o con
 * acentos—, esté donde esté. Así salen las que mi primera pasada no ve: las que
 * viajan en un atributo cualquiera (`titulo="Panel"`), las de un array a nivel
 * de módulo y las de un objeto de configuración. Tiene ruido a propósito: es
 * para leerla a mano, no para poner en verde.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const RAIZ = "src";
const TODO = process.argv.includes("--todo");
const PROSA = process.argv.includes("--prosa");

const ATRIBUTOS = new Set([
  "placeholder",
  "title",
  "aria-label",
  "alt",
  "label",
  "aria-placeholder",
]);

/** Marca, símbolos y valores técnicos: no son texto que traducir. */
const PERMITIDO = [
  /^[\s\d\p{P}\p{S}]+$/u,
  /^(Global Effect|Global Effect Nexus|GE|Nexus|Supabase|Google|Resend|PDF|OCR|IA|MIA)$/,
  /^[a-z][a-z0-9-]*$/,
  /^\{/,
];

function esTexto(valor) {
  const limpio = valor.replace(/\s+/g, " ").trim();

  if (limpio.length < 2) return null;
  if (!/\p{L}{2}/u.test(limpio)) return null;
  if (PERMITIDO.some((patron) => patron.test(limpio))) return null;

  return limpio;
}

function* archivos(directorio) {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);

    if (statSync(ruta).isDirectory()) yield* archivos(ruta);
    else if (ruta.endsWith(".tsx")) yield ruta;
  }
}

const hallazgos = [];

for (const ruta of archivos(RAIZ)) {
  const relativa = relative(".", ruta);

  if (!TODO && relativa.startsWith("src/components/ui/")) continue;

  const codigo = readFileSync(ruta, "utf8");
  const fuente = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const anotar = (nodo, texto, clase) => {
    const { line } = fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente));
    hallazgos.push({ archivo: relativa, linea: line + 1, texto, clase });
  };

  /*
   * ¿Esta cadena parece una frase de pantalla? Dos palabras, y o empieza en
   * mayúscula o lleva acentos. Deja fuera las claves de i18n —`accessMealsTag`,
   * en minúscula y sin espacios—, las clases de Tailwind y el SQL.
   */
  const pareceFrase = (texto) => {
    const limpio = texto.replace(/\s+/g, " ").trim();

    if (limpio.length < 6) return false;
    if (!/\s/.test(limpio)) return false;
    if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|ALTER|CREATE)\b/i.test(limpio)) return false;
    // Clases de Tailwind: varias fichas separadas por espacios, todas técnicas.
    if (/^[a-z0-9:_/\[\]().,#%-]+( [a-z0-9:_/\[\]().,#%-]+)+$/.test(limpio)) return false;
    if (!/^[A-ZÁÉÍÓÚÑ¿¡]/.test(limpio) && !/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(limpio)) return false;

    return /\p{L}{2}/u.test(limpio);
  };

  const enImportacion = (nodo) => {
    for (let padre = nodo.parent; padre; padre = padre.parent) {
      if (ts.isImportDeclaration(padre) || ts.isExportDeclaration(padre)) return true;
      if (ts.isCallExpression(padre)) {
        const llamada = padre.expression.getText(fuente);
        if (/^(console\.|require$|t$|tRaw$)/.test(llamada)) return true;
      }
    }

    return false;
  };

  const recorrer = (nodo) => {
    if (
      PROSA &&
      (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) &&
      pareceFrase(nodo.text) &&
      !enImportacion(nodo)
    ) {
      anotar(nodo, nodo.text.replace(/\s+/g, " ").trim(), "frase");
    }

    if (ts.isJsxText(nodo)) {
      const texto = esTexto(nodo.text);
      if (texto) anotar(nodo, texto, "texto");
    }

    if (ts.isJsxAttribute(nodo) && ATRIBUTOS.has(nodo.name.getText(fuente))) {
      const valor = nodo.initializer;

      if (valor && ts.isStringLiteral(valor)) {
        const texto = esTexto(valor.text);
        if (texto) anotar(nodo, texto, nodo.name.getText(fuente));
      }
    }

    ts.forEachChild(nodo, recorrer);
  };

  recorrer(fuente);
}

if (hallazgos.length === 0) {
  console.log("✓ sin texto a mano: todo lo visible pasa por i18n");
  process.exit(0);
}

const porArchivo = new Map();
for (const h of hallazgos) {
  porArchivo.set(h.archivo, [...(porArchivo.get(h.archivo) ?? []), h]);
}

for (const [archivo, lista] of [...porArchivo].sort()) {
  console.log(`\n${archivo}  (${lista.length})`);
  for (const h of lista) {
    console.log(`  ${String(h.linea).padStart(4)}  ${h.clase.padEnd(10)} ${h.texto.slice(0, 80)}`);
  }
}

console.log(`\n${hallazgos.length} textos a mano en ${porArchivo.size} archivo(s)`);
process.exit(1);
