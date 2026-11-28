import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { expect, test, type Page } from "@playwright/test";

/**
 * Pantallas de acceso (`/login`, `/recuperar`, `/recuperar/nueva`). Sin sesión.
 * Uso: `npx playwright test -c e2e/login.config.ts` con `npm run dev` levantado.
 * Capturas: `LOGIN_CAPTURAS=<carpeta>` (por defecto `test-results/login`).
 *
 * Los textos que se comprueban son los de `messages/es.json`; el locale de las pruebas es es-DO.
 */

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const CAPTURAS = process.env.LOGIN_CAPTURAS ?? "test-results/login";
const MENSAJE_RECUPERAR = "Si el correo está registrado, te enviamos un enlace";

/** Un correo distinto por prueba: el límite de intentos es por IP + correo y no debe cruzarse entre pruebas. */
const correoUnico = (marca: string) => `prueba-${marca}-${Date.now()}@example.com`;

async function correrAxe(page: Page) {
  await page.addScriptTag({ content: AXE });
  const resultado = await page.evaluate(async () => {
    // @ts-expect-error axe lo inyecta el script
    return await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
  });

  return (resultado.violations as { id: string; impact: string; nodes: { target: string[] }[] }[])
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test.describe("login", () => {
  test("credenciales inválidas: mensaje genérico y foco en la contraseña", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(correoUnico("cred"));
    await page.getByLabel("Contraseña", { exact: true }).fill("clave-incorrecta-123");
    await page.getByRole("button", { name: "Entrar" }).click();

    const alerta = page.getByRole("alert");
    await expect(alerta).toContainText("El correo o la contraseña no coinciden. Revisa e intenta de nuevo.");
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeFocused();
    await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("aria-invalid", "true");
    // El correo escrito no se pierde al fallar.
    await expect(page.getByLabel("Correo electrónico")).toHaveValue(/^prueba-cred-/);
  });

  test("campos vacíos: error y foco en el correo", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toContainText("obligatorio");
    await expect(page.getByLabel("Correo electrónico")).toBeFocused();
  });

  test("demasiados intentos: tras el cupo, aviso con cuenta atrás", async ({ page }) => {
    const correo = correoUnico("tasa");
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(correo);

    for (let i = 0; i < 6; i++) {
      await page.getByLabel("Contraseña", { exact: true }).fill(`mala-${i}-xxxxxxxx`);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      if (i < 5) await expect(page.getByRole("alert")).toContainText("no coinciden");
    }

    await expect(page.getByRole("alert")).toContainText("Demasiados intentos. Espera 1 minuto");
    await expect(page.getByRole("alert")).toContainText(/Podrás reintentar en \d+ s/);
  });

  test("sin conexión: aviso sin enviar nada", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(correoUnico("off"));
    await page.getByLabel("Contraseña", { exact: true }).fill("lo-que-sea-1234");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toContainText("No hay conexión. Revisa tu internet.");
    await context.setOffline(false);
  });

  test("el aviso de Google sin cuenta (`?error=notRegistered`) trae botón a soporte y foco en el correo", async ({ page }) => {
    await page.goto("/login?error=notRegistered");
    await expect(page.getByRole("alert")).toContainText("Este correo no tiene acceso al portal");
    await expect(page.getByRole("link", { name: "Escribir a soporte" })).toHaveAttribute("href", /^mailto:info@globaleffect\.org\?subject=/);
    await expect(page.getByLabel("Correo electrónico")).toBeFocused();

    await page.goto("/login?error=inactive");
    await expect(page.getByRole("alert")).toContainText("Tu cuenta está desactivada");
  });

  test("mostrar/ocultar contraseña y aviso de Bloq Mayús", async ({ page }) => {
    await page.goto("/login");
    const clave = page.getByLabel("Contraseña", { exact: true });
    await clave.fill("secreta");
    await expect(clave).toHaveAttribute("type", "password");
    const ojo = page.getByRole("button", { name: "Ver la contraseña" });
    await ojo.click();
    await expect(clave).toHaveAttribute("type", "text");
    await expect(ojo).toHaveAttribute("aria-pressed", "true");

    await clave.focus();
    await page.keyboard.down("CapsLock");
    await page.keyboard.up("CapsLock");
    // El estado real de CapsLock no se puede forzar en Chromium headless: se comprueba solo que no aparece sin él.
    await expect(page.getByText("Bloq Mayús activado")).toHaveCount(0);
  });

  test("`?next=` externo se ignora y uno interno se respeta (campo que viaja a la acción)", async ({ page }) => {
    await page.goto("/login?next=https://evil.com");
    await expect(page.locator('input[name="next"]')).toHaveValue("");

    await page.goto("/login?next=//evil.com");
    await expect(page.locator('input[name="next"]')).toHaveValue("");

    await page.goto("/login?next=/expedientes");
    await expect(page.locator('input[name="next"]')).toHaveValue("/expedientes");
  });

  test("un solo «Volver al inicio» y el correo recordado se rellena", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ge_ultimo_correo", "ana@example.com"));
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toHaveCount(1);
    await expect(page.getByLabel("Correo electrónico")).toHaveValue("ana@example.com");
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeFocused();
  });

  test("el pie ofrece pedir acceso por correo", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Pídelo a la fundación" })).toHaveAttribute(
      "href",
      "mailto:info@globaleffect.org?subject=Solicitud%20de%20acceso%20al%20portal",
    );
  });

  test.skip("login correcto lleva a /inicio (y a `?next=` interno)", async ({ page }) => {
    // MOTIVO: necesita un usuario real y activo de la base (E2E_CORREO / E2E_CLAVE); no hay credenciales de prueba.
    await page.goto("/login?next=/expedientes");
    await page.getByLabel("Correo electrónico").fill(process.env.E2E_CORREO ?? "");
    await page.getByLabel("Contraseña", { exact: true }).fill(process.env.E2E_CLAVE ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/expedientes/);
  });
});

test.describe("recuperar", () => {
  test("responde siempre lo mismo, exista o no el correo o falle el envío", async ({ page }) => {
    for (const estado of [200, 429, 500]) {
      await page.route("**/auth/v1/recover**", (ruta) =>
        ruta.fulfill({ status: estado, contentType: "application/json", body: estado === 200 ? "{}" : '{"msg":"x"}' }),
      );
      await page.goto("/recuperar");
      await page.getByLabel("Correo electrónico").fill(correoUnico(`rec${estado}`));
      await page.getByRole("button", { name: "Enviar enlace" }).click();
      await expect(page.getByRole("status")).toContainText(MENSAJE_RECUPERAR);
    }
  });

  test("pide el enlace a Supabase con `redirectTo` a /recuperar/nueva", async ({ page }) => {
    let url = "";
    await page.route("**/auth/v1/recover**", (ruta) => {
      url = ruta.request().url() + ruta.request().postData();
      return ruta.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto("/recuperar");
    await page.getByLabel("Correo electrónico").fill(correoUnico("redir"));
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByRole("status")).toContainText(MENSAJE_RECUPERAR);
    expect(decodeURIComponent(url)).toContain("/recuperar/nueva");
  });

  test("sin enlace válido, /recuperar/nueva ofrece pedir otro", async ({ page }) => {
    await page.goto("/recuperar/nueva");
    await expect(page.getByRole("alert")).toContainText("ya se usó o venció");
    await expect(page.getByRole("link", { name: "Pedir un enlace nuevo" })).toHaveAttribute("href", "/recuperar");
  });

  test.skip("recuperación completa con correo real: enlace → contraseña nueva → toast → /inicio", async () => {
    // MOTIVO: necesita un buzón real al que llegue el correo «Reset password» de Supabase (y la plantilla
    // y la Redirect URL /recuperar/nueva ya configuradas). No es automatizable sin esas credenciales.
  });
});

test.describe("accesibilidad y capturas", () => {
  const rutas = [
    { nombre: "login", ruta: "/login" },
    { nombre: "recuperar", ruta: "/recuperar" },
    { nombre: "recuperar-nueva", ruta: "/recuperar/nueva" },
  ];
  const tamanos = [
    { nombre: "1440", ancho: 1440, alto: 900 },
    { nombre: "390", ancho: 390, alto: 844 },
  ];

  for (const esquema of ["light", "dark"] as const) {
    for (const { nombre, ruta } of rutas) {
      test(`axe sin violaciones serias o críticas: ${nombre} (${esquema})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: esquema });
        await page.goto(ruta);
        await page.getByRole("heading", { level: 1 }).waitFor();
        // En «nueva» el estado de carga dura un instante: se espera a que acabe.
        await page.waitForTimeout(800);
        expect(await correrAxe(page)).toEqual([]);
      });

      for (const { nombre: tam, ancho, alto } of tamanos) {
        test(`captura ${nombre} ${esquema} ${tam}`, async ({ page }) => {
          mkdirSync(CAPTURAS, { recursive: true });
          await page.setViewportSize({ width: ancho, height: alto });
          await page.emulateMedia({ colorScheme: esquema });
          await page.goto(ruta);
          await page.getByRole("heading", { level: 1 }).waitFor();
          await page.waitForTimeout(800);
          await page.screenshot({ path: `${CAPTURAS}/${nombre}-${esquema}-${tam}.png`, fullPage: true });
          // Sin barra de desplazamiento horizontal en ningún ancho.
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        });
      }
    }
  }

  test("captura del error con Alert (claro y oscuro, 1440)", async ({ page }) => {
    mkdirSync(CAPTURAS, { recursive: true });
    for (const esquema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: esquema });
      await page.goto("/login?error=notRegistered");
      await page.getByRole("alert").waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${CAPTURAS}/login-error-${esquema}-1440.png`, fullPage: true });
    }
  });
});
