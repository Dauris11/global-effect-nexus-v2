import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

/**
 * Guardián de UX (e2e/ux-guard.spec.ts). Se corre contra el servidor de desarrollo ya
 * levantado (o lo levanta). La sesión es la de un super_admin de prueba: se genera una
 * vez con `npm run test:ux:login` y vive en e2e/.auth (ignorado por git).
 *
 * Navegador: usa `UX_CHROMIUM` si existe; si no, el Chromium ya descargado en la caché
 * de Playwright (cualquier revisión), para no bajar otro en cada máquina.
 */
function chromiumLocal(): string | undefined {
  if (process.env.UX_CHROMIUM) return process.env.UX_CHROMIUM;

  const cache = join(homedir(), "Library/Caches/ms-playwright");
  for (const rev of ["1255", "1243", "1234", "1228", "1223"]) {
    for (const arch of ["chrome-mac-arm64", "chrome-mac-x64"]) {
      const ruta = join(cache, `chromium-${rev}`, arch, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      if (existsSync(ruta)) return ruta;
    }
  }

  return undefined;
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  outputDir: "./test-results",
  timeout: 20 * 60_000,
  workers: 1,
  fullyParallel: false,
  globalSetup: "./e2e/preparar.ts",
  reporter: [["list"], ["html", { outputFolder: "e2e/reporte-html", open: "never" }]],
  use: {
    baseURL: process.env.UX_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    // El portal se audita en español (sin prefijo): sin esto Chromium pide en-US y la app responde en /en.
    locale: "es-DO",
    storageState: "e2e/.auth/super_admin.json",
    launchOptions: { executablePath: chromiumLocal() },
  },
  webServer: {
    command: "npm run dev",
    url: process.env.UX_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
