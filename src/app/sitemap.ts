import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

import type { MetadataRoute } from "next";

import { urlLocalizada } from "@content/entidad";

/**
 * Solo lo público e indexable: la portada y las tres páginas legales. Ninguna
 * ruta del portal (exigen sesión) ni /login (`noindex`) entra aquí.
 *
 * `lastModified` es la fecha real del último cambio de los archivos que forman
 * la página (commit de git; si el despliegue no trae historial, la fecha del
 * archivo), no `new Date()`: una fecha que cambia en cada build le enseña al
 * buscador a ignorar el campo.
 */
const RUTAS: { ruta: string; fuentes: string[] }[] = [
  { ruta: "/", fuentes: ["src/app/[locale]/page.tsx", "src/components/landing", "content"] },
  { ruta: "/privacidad", fuentes: ["src/app/[locale]/(legal)/privacidad", "src/components/legal"] },
  { ruta: "/terminos", fuentes: ["src/app/[locale]/(legal)/terminos", "src/components/legal"] },
  { ruta: "/cookies", fuentes: ["src/app/[locale]/(legal)/cookies", "src/components/legal"] },
];

function fechaDeCambio(fuentes: string[]): Date {
  const raiz = process.cwd();

  try {
    const iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...fuentes], {
      cwd: raiz,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (iso) return new Date(iso);
  } catch {
    // Sin git (despliegue sin historial): se usa la fecha del archivo.
  }

  const tiempos = fuentes.flatMap((f) => {
    try {
      return [statSync(path.join(raiz, f)).mtimeMs];
    } catch {
      return [];
    }
  });

  return new Date(Math.max(0, ...tiempos));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return RUTAS.map(({ ruta, fuentes }) => ({
    url: ruta === "/" ? `${urlLocalizada("/", "es")}/` : urlLocalizada(ruta, "es"),
    lastModified: fechaDeCambio(fuentes),
    alternates: {
      languages: {
        "es-DO": ruta === "/" ? `${urlLocalizada("/", "es")}/` : urlLocalizada(ruta, "es"),
        "en-DO": urlLocalizada(ruta, "en"),
      },
    },
  }));
}
