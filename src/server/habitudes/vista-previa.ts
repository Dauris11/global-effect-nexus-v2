import JSZip from "jszip";
import sharp from "sharp";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";

import type { VistazoRecurso } from "@/lib/habitudes";

/**
 * Portada y vistazo de un material, sacados del propio archivo al subirlo:
 *   · imagen        → miniatura
 *   · PDF           → primera página dibujada, número de páginas, índice y primeras líneas
 *   · PowerPoint    → miniatura que guarda el archivo, título de cada diapositiva y su texto
 *   · Word          → miniatura si la trae, títulos y primeras líneas
 *   · Excel         → nombres de las hojas
 * Nada de esto es imprescindible: si algo falla devuelve lo que pudo y la tarjeta se dibuja
 * sola con el título y la descripción. Nunca lanza.
 */

const ANCHO_PORTADA = 720;
const MAX_TEXTO = 520;
const MAX_PUNTOS = 8;

export type VistaPrevia = { portada: Buffer | null; vistazo: VistazoRecurso };

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

const limpiar = (s: string) =>
  s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

const textosDe = (xml: string, etiqueta: "a:t" | "w:t") =>
  [...xml.matchAll(new RegExp(`<${etiqueta}(?: [^>]*)?>([^<]*)</${etiqueta}>`, "g"))].map((m) => limpiar(m[1])).filter(Boolean);

async function comoPortada(bytes: Uint8Array | Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bytes).rotate().resize({ width: ANCHO_PORTADA, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  } catch {
    return null;
  }
}

const vacio = (): VistazoRecurso => ({ paginas: null, puntos: [], texto: "" });
const recortar = (s: string) => (s.length > MAX_TEXTO ? `${s.slice(0, MAX_TEXTO).trimEnd()}…` : s);

async function deImagen(bytes: Uint8Array): Promise<VistaPrevia> {
  return { portada: await comoPortada(bytes), vistazo: vacio() };
}

async function dePdf(bytes: Uint8Array): Promise<VistaPrevia> {
  const vistazo = vacio();
  let portada: Buffer | null = null;
  // pdf.js consume el buffer: cada paso recibe su propia copia.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));

  vistazo.paginas = pdf.numPages;

  try {
    const imagen = await renderPageAsImage(pdf, 1, { canvasImport: () => import("@napi-rs/canvas"), scale: 1.3 });

    portada = await comoPortada(Buffer.from(imagen));
  } catch (error) {
    console.error("[habitudes] no se pudo dibujar la portada del PDF", error);
  }

  try {
    const indice = await pdf.getOutline();

    vistazo.puntos = (indice ?? []).map((i) => limpiar(String(i.title ?? ""))).filter(Boolean).slice(0, MAX_PUNTOS);
  } catch {
    /* sin índice */
  }

  try {
    const { text } = await extractText(pdf, { mergePages: false });

    vistazo.texto = recortar(limpiar(String(text[0] ?? "")));
  } catch {
    /* PDF escaneado: sin texto */
  }

  return { portada, vistazo };
}

async function dePresentacion(zip: JSZip): Promise<VistaPrevia> {
  const vistazo = vacio();
  const diapositivas = Object.keys(zip.files)
    .map((n) => ({ n, num: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(n)?.[1]) }))
    .filter((d) => Number.isFinite(d.num))
    .sort((a, b) => a.num - b.num);

  vistazo.paginas = diapositivas.length;

  const todos: string[][] = [];

  for (const d of diapositivas.slice(0, 12)) todos.push(textosDe(await zip.files[d.n].async("string"), "a:t"));

  vistazo.puntos = todos.map((t) => t[0]).filter(Boolean).slice(0, MAX_PUNTOS);
  vistazo.texto = recortar(todos.slice(0, 3).flat().join(" · "));

  const miniatura = zip.file(/^docProps\/thumbnail\.(jpe?g|png)$/i)[0];

  return { portada: miniatura ? await comoPortada(await miniatura.async("uint8array")) : null, vistazo };
}

async function dePalabra(zip: JSZip): Promise<VistaPrevia> {
  const vistazo = vacio();
  const documento = await zip.file("word/document.xml")?.async("string");

  if (documento) {
    const parrafos = documento.split("</w:p>");
    const titulos: string[] = [];
    const cuerpo: string[] = [];

    for (const p of parrafos) {
      const texto = textosDe(p, "w:t").join(" ");

      if (!texto) continue;
      if (/<w:pStyle w:val="(Heading|Ttulo|Title|Subtitle|Subttulo)/i.test(p)) titulos.push(texto);
      else cuerpo.push(texto);
    }

    vistazo.puntos = titulos.slice(0, MAX_PUNTOS);
    vistazo.texto = recortar([...titulos.slice(0, 1), ...cuerpo].join(" · "));
  }

  const app = await zip.file("docProps/app.xml")?.async("string");
  const paginas = Number(/<Pages>(\d+)<\/Pages>/.exec(app ?? "")?.[1]);

  vistazo.paginas = Number.isFinite(paginas) && paginas > 0 ? paginas : null;

  const miniatura = zip.file(/^docProps\/thumbnail\.(jpe?g|png)$/i)[0];

  return { portada: miniatura ? await comoPortada(await miniatura.async("uint8array")) : null, vistazo };
}

async function deHoja(zip: JSZip): Promise<VistaPrevia> {
  const vistazo = vacio();
  const libro = await zip.file("xl/workbook.xml")?.async("string");
  const hojas = [...(libro ?? "").matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => limpiar(m[1]));

  vistazo.paginas = hojas.length || null;
  vistazo.puntos = hojas.slice(0, MAX_PUNTOS);

  return { portada: null, vistazo };
}

export async function vistaPreviaDeArchivo(bytes: Uint8Array, formato: string): Promise<VistaPrevia> {
  const f = formato.toLowerCase();

  try {
    const trabajo = (async () => {
      if (["png", "jpg", "jpeg", "webp"].includes(f)) return deImagen(bytes);
      if (f === "pdf") return dePdf(bytes);

      if (["pptx", "docx", "xlsx"].includes(f)) {
        const zip = await JSZip.loadAsync(bytes);

        return f === "pptx" ? dePresentacion(zip) : f === "docx" ? dePalabra(zip) : deHoja(zip);
      }

      return { portada: null, vistazo: vacio() };
    })();

    // Un archivo enorme o raro no debe retener la subida: pasados 20 s se sigue sin vista previa.
    return await Promise.race([trabajo, new Promise<VistaPrevia>((resolver) => setTimeout(() => resolver({ portada: null, vistazo: vacio() }), 20_000))]);
  } catch (error) {
    console.error("[habitudes] no se pudo generar la vista previa", error);

    return { portada: null, vistazo: vacio() };
  }
}
