import { fileURLToPath } from "url";
import { dirname } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fija la raíz del workspace (hay otro lockfile en el home del usuario).
  turbopack: { root: projectRoot },
  // pg se ejecuta solo en el servidor; no debe empaquetarse para el cliente.
  serverExternalPackages: ["pg"],
  // El tope por defecto de una Server Action es 1 MB y las subidas (entregas,
  // cotizaciones de compra) admiten 10 MB: sin esto fallan antes de llegar a
  // la validación de tamaño del servidor, con un error opaco.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default withNextIntl(nextConfig);
