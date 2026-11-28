import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * Portada (`/`) sin sesión. Tres garantías del movimiento (ver `src/components/landing/landing.css`):
 *   a) sin JavaScript todo está visible (ningún hueco en blanco);
 *   b) con «reducir movimiento» no hay ninguna animación en curso;
 *   c) con todo activo la página completa se pinta sin huecos, a 1440 y 390 px, en claro y en oscuro.
 *
 * Se corre con la configuración de Playwright que no pide sesión (`globalSetup` de la raíz hace login).
 */

const CAPTURAS = process.env.LANDING_CAPTURAS ?? "test-results/landing";

/** Recorre la página de arriba abajo para que los `.rv` pasen por su turno de revelado. */
async function recorrer(page: Page) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  const paso = await page.evaluate(() => Math.round(window.innerHeight * 0.6));

  for (let y = 0; y <= alto; y += paso) {
    await page.evaluate((arriba) => window.scrollTo(0, arriba), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
}

/** Elementos pintados con opacidad 0 o `visibility: hidden` (el video de fondo es mejora sobre su póster). */
function ocultos() {
  const salida: string[] = [];

  for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
    if (el.closest("nextjs-portal, script, style, noscript, video, svg")) continue;

    const estilo = getComputedStyle(el);
    if (estilo.display === "none") continue;

    let opaco = true;
    for (let n: HTMLElement | null = el; n; n = n.parentElement) {
      if (getComputedStyle(n).opacity === "0") opaco = false;
    }

    if (!opaco || estilo.visibility === "hidden") {
      salida.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    }
  }

  return salida;
}

test("a) sin JavaScript todas las secciones están visibles", async ({ browser }) => {
  const contexto = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await contexto.newPage();

  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("h1")).toBeVisible();
  // Espera mayor que cualquier animación de entrada: si algo se animara desde 0, ya habría terminado.
  await page.waitForTimeout(1500);

  expect(await page.evaluate(() => document.documentElement.classList.contains("js"))).toBe(false);

  for (const id of ["accesos", "perfiles", "primer-acceso", "preguntas", "ubicacion"]) {
    await expect(page.locator(`#${id}`), `sección #${id}`).toBeVisible();
  }

  expect(await page.evaluate(ocultos)).toEqual([]);

  // Todas las respuestas del FAQ se leen sin JS (no hay nada plegado).
  const respuestas = page.locator(".faq-panel > div");
  for (let i = 0; i < (await respuestas.count()); i++) {
    expect((await respuestas.nth(i).boundingBox())?.height ?? 0).toBeGreaterThan(0);
  }

  await contexto.close();
});

test("b) con reducir movimiento no hay animaciones en curso", async ({ browser }) => {
  const contexto = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await contexto.newPage();

  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  await recorrer(page);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.evaluate(ocultos)).toEqual([]);

  await contexto.close();
});

for (const ancho of [1440, 390]) {
  for (const esquema of ["light", "dark"] as const) {
    test(`c) página completa a ${ancho}px en ${esquema}, sin huecos`, async ({ browser }) => {
      mkdirSync(CAPTURAS, { recursive: true });
      const alto = ancho === 390 ? 844 : 900;
      const contexto = await browser.newContext({ colorScheme: esquema, viewport: { width: ancho, height: alto } });
      const page = await contexto.newPage();

      await page.goto("/", { waitUntil: "load" });
      await page.waitForTimeout(1500);
      await recorrer(page);

      // Cada `.rv` ya se reveló y nada queda a opacidad 0.
      expect(await page.evaluate(() => document.querySelectorAll(".js .rv:not(.rv-in)").length)).toBe(0);
      expect(await page.evaluate(ocultos)).toEqual([]);

      await page.screenshot({ path: join(CAPTURAS, `landing-${ancho}-${esquema}.png`), fullPage: true });
      await contexto.close();
    });
  }
}
