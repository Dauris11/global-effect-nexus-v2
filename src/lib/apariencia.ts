/**
 * Apariencia del portal: tema (claro u oscuro) y barra lateral (estándar o
 * negra). Son dos decisiones independientes: alguien puede querer la página
 * clara con la barra negra, como en el ejemplo de referencia.
 *
 * Se guarda en el navegador y no en la base: es una preferencia del aparato
 * —un monitor de oficina no es el celular de noche— y así se aplica antes de
 * que cargue nada, sin esperar una consulta.
 */

export const TEMAS = ["claro", "oscuro"] as const;
export const BARRAS = ["estandar", "negra"] as const;
export const ACENTOS = ["azul", "negro"] as const;

export type Tema = (typeof TEMAS)[number];
export type Barra = (typeof BARRAS)[number];
export type Acento = (typeof ACENTOS)[number];

export type Apariencia = { tema: Tema; barra: Barra; acento: Acento };

export const APARIENCIA_INICIAL: Apariencia = {
  tema: "claro",
  barra: "estandar",
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
  Tema,
  {
    lienzo: string;
    trazo: string;
    texto: string;
    lateralNegra: string;
    trazoNegra: string;
    textoNegra: string;
  }
> = {
  claro: {
    lienzo: "#ffffff",
    trazo: "#ebeef1",
    texto: "#d5dbe1",
    lateralNegra: "#0b0d0f",
    trazoNegra: "#2a2f35",
    textoNegra: "#3a4047",
  },
  oscuro: {
    lienzo: "#111416",
    trazo: "#2a2f35",
    texto: "#363c43",
    lateralNegra: "#0b0d0f",
    trazoNegra: "#2a2f35",
    textoNegra: "#3a4047",
  },
};

export const CLAVE_APARIENCIA = "ge-apariencia";

/** Lee lo guardado y descarta cualquier valor que ya no exista. */
export function leerApariencia(): Apariencia {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_APARIENCIA) ?? "{}");

    return {
      tema: TEMAS.includes(crudo.tema) ? crudo.tema : APARIENCIA_INICIAL.tema,
      barra: BARRAS.includes(crudo.barra) ? crudo.barra : APARIENCIA_INICIAL.barra,
      acento: ACENTOS.includes(crudo.acento) ? crudo.acento : APARIENCIA_INICIAL.acento,
    };
  } catch {
    // Navegación privada o almacenamiento bloqueado: se queda lo de siempre.
    return APARIENCIA_INICIAL;
  }
}

/** Pinta la apariencia en `<html>`, donde la leen `.dark`, `data-barra` y `data-acento`. */
export function aplicarApariencia({ tema, barra, acento }: Apariencia) {
  const raiz = document.documentElement;

  raiz.classList.toggle("dark", tema === "oscuro");
  raiz.dataset.barra = barra;
  raiz.dataset.acento = acento;
}

/**
 * Lo mismo que `leerApariencia` + `aplicarApariencia`, como texto para un
 * `<script>` en línea. Corre antes de pintar, así que no hay un destello claro
 * antes de que la página se ponga oscura.
 */
export const SCRIPT_APARIENCIA = `(function(){try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(
  CLAVE_APARIENCIA,
)})||"{}");var r=document.documentElement;r.classList.toggle("dark",a.tema==="oscuro");r.dataset.barra=a.barra==="negra"?"negra":"estandar";r.dataset.acento=a.acento==="negro"?"negro":"azul"}catch(e){}})()`;
