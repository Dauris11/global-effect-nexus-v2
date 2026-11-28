/**
 * Apariencia del portal: tema (claro u oscuro) y barra lateral (estándar o
 * negra). Son dos decisiones independientes: alguien puede querer la página
 * clara con la barra negra, como en el ejemplo de referencia.
 *
 * Se guarda en el navegador y no en la base: es una preferencia del aparato
 * —un monitor de oficina no es el celular de noche— y así se aplica antes de
 * que cargue nada, sin esperar una consulta.
 */

export const TEMAS = ["claro", "oscuro", "sistema"] as const;
export const ACENTOS = ["azul", "negro"] as const;

export type Tema = (typeof TEMAS)[number];
export type Acento = (typeof ACENTOS)[number];

export type Apariencia = { tema: Tema; acento: Acento };

export const APARIENCIA_INICIAL: Apariencia = {
  // «Sistema» sigue al aparato: de noche oscuro y de día claro, sin que nadie tenga que elegir.
  tema: "sistema",
  acento: "azul",
};

/**
 * El color de las muestras del selector. Fijo a propósito: enseña cada acento
 * entero, no el que esté vigente.
 */
export const COLORES_ACENTO: Record<Acento, string> = {
  azul: "#2096BA",
  negro: "#171A1D",
};

/**
 * Colores de las miniaturas del selector. Están aquí y no en el `.tsx` porque
 * son fijos a propósito: enseñan cada tema entero, no el vigente.
 */
export const COLORES_MINIATURA: Record<
  Exclude<Tema, "sistema">,
  { lienzo: string; trazo: string; texto: string }
> = {
  claro: { lienzo: "#ffffff", trazo: "#ebeef1", texto: "#d5dbe1" },
  oscuro: { lienzo: "#0d0c0c", trazo: "#3c3939", texto: "#535050" },
};

export const CLAVE_APARIENCIA = "ge-apariencia";

/** Lee lo guardado y descarta cualquier valor que ya no exista. */
export function leerApariencia(): Apariencia {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_APARIENCIA) ?? "{}");

    return {
      tema: TEMAS.includes(crudo.tema) ? crudo.tema : APARIENCIA_INICIAL.tema,
      acento: ACENTOS.includes(crudo.acento) ? crudo.acento : APARIENCIA_INICIAL.acento,
    };
  } catch {
    // Navegación privada o almacenamiento bloqueado: se queda lo de siempre.
    return APARIENCIA_INICIAL;
  }
}

/** ¿Debe verse oscuro ahora? «Sistema» lo decide el aparato. */
export function esOscuro(tema: Tema): boolean {
  return tema === "oscuro" || (tema === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/** Pinta la apariencia en `<html>`, donde la leen `.dark` y `data-acento`. */
export function aplicarApariencia({ tema, acento }: Apariencia) {
  const raiz = document.documentElement;
  // La portada pública también respeta el tema: tiene su propio diseño oscuro y ya no se fuerza clara.
  raiz.classList.toggle("dark", esOscuro(tema));
  raiz.dataset.acento = acento;
}

/**
 * Lo mismo que `leerApariencia` + `aplicarApariencia`, como texto para un
 * `<script>` en línea en el `<head>`. Corre antes de pintar, así que no hay un destello
 * claro antes de que la página se ponga oscura. Sin nada guardado manda el sistema.
 */
export const SCRIPT_APARIENCIA = `(function(){try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(
  CLAVE_APARIENCIA,
)})||"{}");var r=document.documentElement;var t=a.tema==="claro"||a.tema==="oscuro"?a.tema:"sistema";r.classList.toggle("dark",(t==="oscuro"||(t==="sistema"&&matchMedia("(prefers-color-scheme: dark)").matches)));r.dataset.acento=a.acento==="negro"?"negro":"azul"}catch(e){}})()`;
