import type { MetadataRoute } from "next";

import { AZUL, BLANCO } from "@/lib/paleta";

/**
 * Manifiesto de aplicación web (PWA) de Global Effect Nexus.
 *
 * Configura la plataforma para abrirse como aplicación nativa en dispositivos
 * móviles (iOS / Android) al agregarse a la pantalla de inicio:
 * - Modo `standalone` sin barra de navegación del navegador ni controles superfluos.
 * - Orientación adaptativa portrait-primary.
 * - Atajos rápidos (Shortcuts) para escáner QR de inventario y tareas de hoy.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Global Effect Nexus",
    short_name: "Nexus",
    description: "ERP Institucional de la Fundación Global Effect",
    start_url: "/es/dashboard",
    display: "standalone",
    background_color: BLANCO,
    theme_color: AZUL,
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Escanear QR Activo",
        short_name: "Escanear QR",
        description: "Abrir escáner de cámara para inventario de activos",
        url: "/es/administrativo/inventario/escanear",
      },
      {
        name: "Lo que me toca hoy",
        short_name: "Mi Día",
        description: "Torre de control diaria y tareas prioritarias",
        url: "/es/administrativo/tareas",
      },
      {
        name: "Rendir Gastos",
        short_name: "Rendir Gasto",
        description: "Carga de comprobante fiscal con foto u OCR",
        url: "/es/administrativo/solicitudes",
      },
    ],
  };
}
