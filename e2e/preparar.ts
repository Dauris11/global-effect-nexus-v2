import { existsSync, mkdirSync, rmSync } from "node:fs";

/** Limpia los resultados de la corrida anterior y exige la sesión del owner de prueba. */
export default function preparar() {
  if (!existsSync("e2e/.auth/owner.json")) {
    throw new Error("Falta e2e/.auth/owner.json: inicia sesión con `npm run test:ux:login`.");
  }
  rmSync("e2e/.resultados", { recursive: true, force: true });
  mkdirSync("e2e/.resultados", { recursive: true });
}
