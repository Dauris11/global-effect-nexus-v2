import { fileURLToPath } from "url";
import { dirname } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const projectRoot = dirname(fileURLToPath(import.meta.url));

const esProduccion = process.env.NODE_ENV === "production";

/** Origen (y websocket) de Supabase: auth, REST y storage se llaman desde el navegador. */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^https:/, "wss:");

/**
 * Política de contenido. Qué se permite y por qué:
 * - script/style `'unsafe-inline'`: Next inyecta los scripts de hidratación y el de apariencia en línea
 *   y aún no hay nonce por petición (un nonce volvería dinámicas las páginas, justo lo que se evita
 *   para el LCP de `/`). `'unsafe-eval'` solo en desarrollo (React lo usa para depurar).
 * - img: Supabase Storage (avatares, adjuntos), teselas de OpenStreetMap y CARTO (mapas Leaflet),
 *   `data:` y `blob:` (vistas previas de subidas, el mapa de La Vega) y la foto de cuenta de Google.
 * - frame: el iframe de Google Maps (solo bajo demanda) y las salas Jitsi/8x8 de Reuniones.
 * - connect: Supabase (HTTP y websocket). Groq, Gemini y OpenAI se llaman desde el servidor, no aquí.
 * - `frame-ancestors 'none'`: nadie puede incrustar el portal (clickjacking).
 * Probado en `/`, `/login`, `/comida` y `/transporte` sin errores de CSP en consola.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esProduccion ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://lh3.googleusercontent.com`,
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src 'self' ${supabase} ${supabaseWs}`,
  "frame-src https://www.google.com https://meet.jit.si https://8x8.vc",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(esProduccion ? ["upgrade-insecure-requests"] : []),
].join("; ");

const cabecerasSeguridad = [
  { key: "Content-Security-Policy", value: csp },
  // Dos años y subdominios; sin `preload` hasta que el cliente confirme el dominio definitivo.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocalización: visitas de Habitudes y guagua del chofer. Cámara/micrófono/pantalla: solo la
  // propia página y las salas de Reuniones (Jitsi y 8x8), que las piden desde su iframe.
  {
    key: "Permissions-Policy",
    value:
      'geolocation=(self), camera=(self "https://meet.jit.si" "https://8x8.vc"), microphone=(self "https://meet.jit.si" "https://8x8.vc"), display-capture=(self "https://meet.jit.si" "https://8x8.vc"), payment=(), usb=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fija la raíz del workspace (hay otro lockfile en el home del usuario).
  turbopack: { root: projectRoot },
  // `quality={72}` del hero se ignoraba (salía 75) porque Next 16 solo admite las calidades declaradas aquí.
  images: { qualities: [72, 75] },
  async headers() {
    return [{ source: "/:path*", headers: cabecerasSeguridad }];
  },
  // pg y el lienzo nativo (portadas de PDF) solo corren en el servidor y no se empaquetan.
  serverExternalPackages: ["pg", "@napi-rs/canvas"],
  // El tope por defecto de una Server Action es 1 MB y las subidas (entregas,
  // cotizaciones de compra) admiten 10 MB: sin esto fallan antes de llegar a
  // la validación de tamaño del servidor, con un error opaco.
  experimental: {
    // `forbidden()` + `forbidden.tsx`: la pantalla «esto es del equipo de desarrollo» de /dev.
    authInterrupts: true,
    serverActions: { bodySizeLimit: "12mb" },
    // Volver a una pantalla vista hace menos de 30 s no pide nada al servidor. Las
    // acciones que cambian datos llaman a `updateTag`/`revalidatePath`, que vacían
    // esta caché, así que no se ve lo viejo después de guardar.
    staleTimes: { dynamic: 30, static: 180 },
  },
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
