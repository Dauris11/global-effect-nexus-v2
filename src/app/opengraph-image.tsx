import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

import es from "../../messages/es.json";

export const alt = es.seo.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Imagen para compartir el enlace (WhatsApp, redes, Slack): fondo marca-950, el
 * logo y el titular. Va en español porque es la vista previa por defecto; el
 * texto sale de `messages/es.json` (el H1 de la landing), no una frase aparte.
 *
 * Satori no lee WebP, así que el logo se convierte a PNG y entra como data URI.
 */
export default async function ImagenOpenGraph() {
  const logo = await sharp(path.join(process.cwd(), "public/logo-dark.webp")).png().toBuffer();
  const [ancho, alto] = [480, Math.round((480 * 157) / 720)];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a2f3c",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <img src={`data:image/png;base64,${logo.toString("base64")}`} width={ancho} height={alto} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            {es.landing.heroTitle}
          </div>
          <div style={{ fontSize: 32, color: "#5fb8d4" }}>
            {es.seo.ogLugar}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
