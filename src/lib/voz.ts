/**
 * Reglas puras de la voz de Elly AI (sin navegador, para probarlas con
 * `node --test`): qué texto se lee en voz alta, cómo se corta y qué voz del
 * dispositivo se elige.
 *
 * La voz es la del NAVEGADOR (Web Speech API): gratis, sin clave ni proveedor, y
 * lo que se dicta lo procesa el servicio de voz del propio navegador. Por eso
 * este archivo no sabe nada de OpenAI, Groq ni Gemini.
 */

/**
 * Lo que dice el asistente, preparado para leerse. Un lector de voz que
 * pronuncia «asterisco asterisco» o deletrea una ruta es peor que no leer:
 * se quita el formato de Markdown, los enlaces y rutas, y los emoji.
 */
export function limpiarParaVoz(texto: string): string {
  return texto
    .normalize("NFKC")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    // rutas internas tipo /configuracion/conocimiento
    .replace(/(^|\s)\/[\w\-./[\]]+/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_~>|]+/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[​-‏️⁠﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/**
 * Parte el texto en trozos que se leen uno tras otro. Chrome corta una
 * locución larga a los ~15 segundos; con trozos de una o dos frases no pasa, y
 * además se puede interrumpir entre uno y otro.
 */
export function trocearParaVoz(texto: string, maximo = 180): string[] {
  const frases = texto
    .split(/(?<=[.!?¡¿:;])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);

  const trozos: string[] = [];
  let actual = "";

  const cerrar = () => {
    if (actual) trozos.push(actual);
    actual = "";
  };

  for (const frase of frases) {
    if (frase.length > maximo) {
      cerrar();
      // Una «frase» enorme se corta por comas y, si hace falta, por palabras.
      let resto = frase;

      while (resto.length > maximo) {
        const corte = Math.max(resto.lastIndexOf(",", maximo), resto.lastIndexOf(" ", maximo));
        const en = corte > maximo / 3 ? corte : maximo;

        trozos.push(resto.slice(0, en).trim());
        resto = resto.slice(en).replace(/^[,\s]+/, "");
      }

      actual = resto;
      continue;
    }

    if (actual && actual.length + frase.length + 1 > maximo) cerrar();

    actual = actual ? `${actual} ${frase}` : frase;
  }

  cerrar();

  return trozos;
}

/** Idioma del reconocimiento de voz. `es-DO` es la variante dominicana. */
export function idiomaDeVoz(idioma: "es" | "en"): string {
  return idioma === "en" ? "en-US" : "es-DO";
}

export type VozDisponible = { name: string; lang: string; localService?: boolean; default?: boolean };

/**
 * La mejor voz del dispositivo para el idioma. Para español se prefiere la
 * latinoamericana (la que se parece al acento de la gente de la Fundación) y, a
 * igualdad, las voces «naturales» o de Google/Microsoft. `null` si no hay
 * ninguna: entonces se deja que el navegador use la suya con el idioma puesto.
 */
export function elegirVoz<V extends VozDisponible>(voces: readonly V[], idioma: "es" | "en"): V | null {
  const familia = idioma === "en" ? "en" : "es";
  const candidatas = voces.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(familia));

  if (candidatas.length === 0) return null;

  const puntos = (v: V) => {
    const lang = v.lang.toLowerCase().replace("_", "-");
    let p = 0;

    if (idioma === "es") {
      if (lang === "es-do") p += 6;
      else if (/^es-(us|mx|419|co|ar|cl|pe|ve|pr)/.test(lang)) p += 4;
      else if (lang === "es-es") p += 1;
    } else if (lang === "en-us") p += 3;

    if (/natural|neural|premium|enhanced|online/i.test(v.name)) p += 3;
    if (/google|microsoft/i.test(v.name)) p += 1;
    if (v.localService) p += 0.5;
    if (v.default) p += 0.25;

    return p;
  };

  return [...candidatas].sort((a, b) => puntos(b) - puntos(a))[0] ?? null;
}
