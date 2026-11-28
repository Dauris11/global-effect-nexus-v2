import { expect, test } from "@playwright/test";

/**
 * Roles: owner (negocio) frente a developer (negocio + técnico). Mismo estilo que `ux-guard.spec.ts`: sesiones
 * guardadas en e2e/.auth (ignorado por git) y «Ver como» por la cookie real `ge_ver_como`.
 *
 * Sesiones que hacen falta (se generan con `npm run test:ux:login`, una por cuenta de prueba):
 *   · e2e/.auth/owner.json      → una cuenta con rol `owner` ACTIVA.
 *   · e2e/.auth/developer.json  → una cuenta con rol `developer`.
 *
 * ESCRITOS PERO SIN CORRER: la sesión de Playwright caducó cuando se hicieron. Los selectores marcados con «UI»
 * ya apuntan a la pantalla real (`/dev` con `forbidden.tsx`, detalle de Personal, selector «Ver como»), pero no se
 * han ejecutado contra ella.
 */

const COOKIE_VER_COMO = "ge_ver_como";
const base = () => test.info().project.use.baseURL ?? "http://localhost:3000";

test.describe("owner", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("no entra a /dev: acceso denegado amable (403), no una pantalla rota", async ({ page }) => {
    const resp = await page.goto("/dev", { waitUntil: "domcontentloaded" });

    expect(resp?.status()).toBe(403);
    // UI: `dev/forbidden.tsx`. Nota: con la carga en streaming del portal Next puede responder 200 en vez de 403;
    // si pasa, relajar el estado y dejar el resto de comprobaciones, que son lo que ve la persona.
    await expect(page.getByText(/esta sección es del equipo de desarrollo|this section is for the development team/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /ir a mi inicio|go to my home/i })).toBeVisible();
    await expect(page.getByText(/stack|exception|internal server error/i)).toHaveCount(0);
  });

  test("no ve las pantallas técnicas de configuración (IA, actividad, auditoría)", async ({ page }) => {
    for (const ruta of ["/configuracion/ia", "/configuracion/actividad", "/configuracion/auditoria"]) {
      await page.goto(ruta, { waitUntil: "domcontentloaded" });
      // `requerirPermiso("tecnico.*")` lo lleva a su portal: no se queda en la ruta técnica.
      await expect(page).not.toHaveURL(new RegExp(`${ruta}$`));
    }
  });

  test("quitar al último owner activo falla con mensaje claro", async ({ page }) => {
    await page.goto("/administrativo/personal", { waitUntil: "domcontentloaded" });

    // UI: la lista es una tabla; el rol se cambia en el detalle de la persona («Cuenta»). Hace falta OTRO owner
    // como objetivo (la propia cuenta se bloquea con «no puedes cambiar tu cuenta») y que sea el único activo;
    // con dos owners activos el cambio procede.
    await page.getByRole("row").filter({ hasText: /Propietario/ }).first().getByRole("link").first().click();
    await page.getByRole("combobox", { name: /cambiar rol|change role/i }).selectOption("admin");

    await expect(page.getByRole("alert")).toContainText(/al menos un propietario activo/i);
  });

  test("el selector «Ver como» no ofrece Propietario ni Desarrollador al owner", async ({ page }) => {
    await page.goto("/inicio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /ver como/i }).click();

    await expect(page.getByRole("menuitem", { name: /^Propietario/ })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /^Desarrollador/ })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /Administrativo/ })).toBeVisible();
  });
});

test.describe("developer", () => {
  test.use({ storageState: "e2e/.auth/developer.json" });

  test("entra a /dev", async ({ page }) => {
    const resp = await page.goto("/dev", { waitUntil: "domcontentloaded" });

    expect(resp?.status()).toBe(200);
  });

  test("«Ver como Propietario» muestra el Inicio de dirección", async ({ page, context }) => {
    await context.addCookies([{ name: COOKIE_VER_COMO, value: "owner", url: base() }]);
    await page.goto("/inicio", { waitUntil: "domcontentloaded" });

    // La franja fija avisa que se está mirando como otro rol…
    await expect(page.locator("[data-impersonation-bar]")).toBeVisible();
    // …y el inicio es el de dirección: tiene la pestaña «Equipo» (solo el owner efectivo la recibe).
    await expect(page.getByRole("link", { name: /^Equipo$/ })).toBeVisible();
    // Y como owner efectivo ya no entra a lo técnico.
    const resp = await page.goto("/dev", { waitUntil: "domcontentloaded" });

    expect(resp?.status()).toBe(403);
  });

  test("el selector «Ver como» ofrece Propietario como primera opción", async ({ page }) => {
    await page.goto("/inicio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /ver como/i }).click();

    await expect(page.getByRole("menuitem").first()).toHaveText(/Propietario/);
  });

  test("«Ver como usuario…» bloquea las acciones que escriben", async ({ page }) => {
    // UI: «Ver como usuario…» abre un diálogo con buscador y una lista (role=option); con
    // `tecnico.impersonation_write` en falso (por defecto).
    await page.goto("/inicio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /ver como/i }).click();
    await page.getByRole("menuitem", { name: /ver como usuario/i }).click();
    await page.getByRole("option").first().click();

    await expect(page.locator("[data-impersonation-bar]")).toContainText(/acciones que escriben están bloqueadas/i);

    // Cualquier acción que escribe (p. ej. crear una tarea) vuelve con ?suplantacion_bloqueada=1.
    await page.goto("/administrativo/tareas", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /nueva tarea|crear/i }).first().click();
    await page.getByRole("button", { name: /guardar/i }).click();

    await expect(page).toHaveURL(/suplantacion_bloqueada=1/);
  });
});
