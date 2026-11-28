import type { MetadataRoute } from "next";

import { urlSitio } from "@content/entidad";

/**
 * Rutas privadas del portal. Se repiten en CADA user-agent porque un bot que
 * encuentra un grupo propio ignora el `*`: si no se repite, ese bot las rastrea.
 * Cubren español e inglés (`/en/...`).
 */
const PRIVADAS = [
  "/login",
  "/recuperar",
  "/inicio",
  "/expedientes",
  "/academico",
  "/patrocinadores",
  "/administrativo",
  "/contabilidad",
  "/operaciones",
  "/habitudes",
  "/calendario",
  "/reportes",
  "/configuracion",
  "/perfil",
  "/portal",
  "/dev",
  "/api",
];

const DISALLOW = PRIVADAS.flatMap((ruta) => [ruta, `/en${ruta}`]);

/**
 * Rastreadores de búsqueda y de asistentes de IA PERMITIDOS (plantilla GS-01):
 * que el portal pueda ser citado en respuestas es parte del objetivo. Bloquear
 * alguno exige instrucción escrita del cliente.
 */
const AGENTES = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "GPTBot",
  "ClaudeBot",
  "Applebot-Extended",
  "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  // Sin ramas por entorno: en *.vercel.app el `noindex` lo pone `src/proxy.ts` por cabecera. Un `Disallow: /`
  // ahí impediría al bot ver esa cabecera y la URL podría quedar indexada sin contenido.
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AGENTES.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${urlSitio()}/sitemap.xml`,
  };
}
