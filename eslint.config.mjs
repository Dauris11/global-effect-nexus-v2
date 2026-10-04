/**
 * Configuración de ESLint (flat config) — Next.js 16 + TypeScript.
 * `next lint` se retiró en Next 16; se usa la CLI de ESLint (`eslint .`).
 */
import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...coreWebVitals,
  {
    ignores: [".next/**", "node_modules/**", "scripts/**"],
  },
];

export default config;
