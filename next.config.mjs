import { fileURLToPath } from "url";
import { dirname } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fija la raíz del workspace (hay otro lockfile en el home del usuario).
  turbopack: { root: projectRoot },
  // pg y el lienzo nativo (portadas de PDF) solo corren en el servidor y no se empaquetan.
  serverExternalPackages: ["pg", "@napi-rs/canvas"],
  // El tope por defecto de una Server Action es 1 MB y las subidas (entregas,
  // cotizaciones de compra) admiten 10 MB: sin esto fallan antes de llegar a
  // la validación de tamaño del servidor, con un error opaco.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  // Los inicios de antes (tablero ejecutivo, bandeja, resúmenes por rol) ya no existen: `/inicio` es la
  // única entrada. Redirección permanente (308) para no romper marcadores ni enlaces de avisos ya guardados.
  async redirects() {
    const antiguas = [
      "/ejecutivo",
      "/bandeja",
      "/administrativo",
      "/contabilidad/mi-dia",
      "/portal/contabilidad",
      "/portal/profesor",
      "/portal/estudiante",
      "/habitudes",
    ];

    // Raíces de los módulos del sidebar (`/estudiantes`…): sin pantalla propia, llevan a su primera pestaña.
    // Las pestañas son las rutas de siempre, así que los enlaces guardados a ellas siguen funcionando.
    const modulos = {
      "/estudiantes": { base: "/expedientes", tabs: { riesgo: "/expedientes/riesgo", becas: "/patrocinadores/becas" } },
      "/academico": {
        base: "/academico/universidades",
        tabs: { calificaciones: "/academico/universidades/calificaciones", periodos: "/academico/periodos", prematricula: "/academico/prematricula", materias: "/academico/materias", "global-effect-360": "/academico/clases-360" },
      },
      "/solicitudes": { base: "/administrativo/solicitudes", tabs: {} },
      "/proyectos": { base: "/administrativo/proyectos", tabs: { "linea-de-tiempo": "/calendario/gantt", "mis-tareas": "/administrativo/tareas" } },
      "/operaciones": {
        base: "/administrativo/inventario",
        tabs: { "servicios-mensuales": "/servicios-mensuales", comida: "/inscripcion-comida", transporte: "/administrativo/transporte" },
      },
    };
    const aModulos = Object.entries(modulos).flatMap(([origen, { base, tabs }]) =>
      ["", "/en"].flatMap((prefijo) => [
        // `/academico?tab=periodos` → la pestaña; sin `tab`, la primera.
        ...Object.entries(tabs).map(([tab, destino]) => ({
          source: `${prefijo}${origen}`,
          has: [{ type: "query", key: "tab", value: tab }],
          destination: `${prefijo}${destino}`,
          permanent: true,
        })),
        { source: `${prefijo}${origen}`, destination: `${prefijo}${base}`, permanent: true },
      ]),
    );

    return [
      ...antiguas.flatMap((origen) => [
        { source: origen, destination: "/inicio", permanent: true },
        { source: `/en${origen}`, destination: "/en/inicio", permanent: true },
      ]),
      ...aModulos,
    ];
  },
};

export default withNextIntl(nextConfig);
