// Abre un Chromium visible en /login; cuando el super_admin de prueba entra, guarda su
// sesión en e2e/.auth/super_admin.json (storageState). No escribe contraseñas por ti.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.UX_BASE_URL ?? "http://localhost:3000";
const b = await chromium.launch({ headless: false, executablePath: process.env.UX_CHROMIUM });
const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await c.newPage();
await p.goto(`${base}/login`);
console.log("Inicia sesión como super_admin en la ventana abierta…");
for (let i = 0; i < 900; i++) {
  if ((await c.cookies()).some((k) => /^sb-.*auth-token/.test(k.name))) break;
  await p.waitForTimeout(1000);
}
await p.waitForTimeout(2000);
mkdirSync("e2e/.auth", { recursive: true });
await c.storageState({ path: "e2e/.auth/super_admin.json" });
await b.close();
console.log("Sesión guardada en e2e/.auth/super_admin.json");
