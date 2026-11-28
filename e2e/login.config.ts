import { defineConfig } from "@playwright/test";

import base from "../playwright.config";

/**
 * Config del login: pantallas SIN sesión. La base exige `e2e/.auth/owner.json` (globalSetup) y
 * entra ya autenticada, justo lo contrario de lo que aquí se prueba.
 * Uso: `npx playwright test -c e2e/login.config.ts`
 */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: /login\.spec\.ts/,
  outputDir: "../test-results",
  globalSetup: undefined,
  timeout: 90_000,
  use: { ...base.use, storageState: undefined },
});
