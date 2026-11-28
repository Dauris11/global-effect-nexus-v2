import { cn } from "@/lib/utils";

/**
 * Piezas de maquetación que comparten todas las secciones de la landing.
 *
 * Viven juntas y no en `ui/` porque solo tienen sentido aquí: el contenedor de
 * la landing y las cabeceras de sección.
 * Si mañana cambia el ancho o el margen de la página, cambia en un sitio y no
 * en nueve secciones.
 */

/**
 * Mismo ancho y margen lateral que el portal (docs/09 §2.7): 1280 px y 16 /
 * 24 / 32 px a los lados. Así pasar de la landing al portal no "salta".
 */
export const CONTENEDOR = "mx-auto w-full max-w-[1280px] px-4 md:px-6 lg:px-8";

/**
 * Separación entre secciones: aire y una línea fina, no bandas de color
 * (docs/09 §1.3). `scroll-mt` deja sitio a la barra pegajosa, que en móvil
 * mide dos filas (logo y búsqueda).
 *
 * 64 / 112 px y no 48 / 64: con el aire de antes cada sección pegaba con la
 * siguiente y la página se leía como una lista, sin pausas que marcaran dónde
 * empieza otra cosa.
 */
export const SECCION = "scroll-mt-36 border-t border-linea py-16 md:scroll-mt-24 md:py-28";

/**
 * Titular de sección de la landing. Más grande que `texto-titulo-seccion`
 * (22 px), que es la medida del portal: en la portada cada sección abre con
 * su titular y es lo que lee quien baja rápido.
 */
export const TITULO_SECCION =
  "text-[28px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance text-tinta md:text-[40px]";

/** Título de sección con una acción opcional a la derecha. */
export function CabeceraSeccion({
  titulo,
  accion,
  id,
}: {
  titulo: string;
  accion?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="rv flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 id={id} className={TITULO_SECCION}>
          {titulo}
        </h2>
      </div>
      {accion}
    </div>
  );
}

/**
 * Etiqueta de sección sobre el titular (`Qué puedes hacer`, `Primer acceso`). Es
 * una pastilla de marca con tokens `marca-*`, que ya se invierten en oscuro.
 */
export function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-marca-100 bg-marca-50 px-3 py-1 text-[13px] font-semibold text-marca-700">
      {children}
    </span>
  );
}

/**
 * Cabecera de las secciones del portal: etiqueta y titular en forma de PREGUNTA. El
 * H2 es la pregunta que una persona (o un buscador) se hace de verdad; va en el
 * HTML del servidor para que se lea sin JavaScript.
 */
export function CabeceraPregunta({
  etiqueta,
  titulo,
  id,
}: {
  etiqueta: string;
  titulo: string;
  /** Ya no se pinta (se quitaron las descripciones bajo los títulos); se acepta mientras `page.tsx` la pase. */
  respuesta?: string;
  id?: string;
}) {
  return (
    <div className="rv mb-10 max-w-[640px]">
      <Etiqueta>{etiqueta}</Etiqueta>
      <h2 id={id} className={cn(TITULO_SECCION, "mt-3.5")}>
        {titulo}
      </h2>
    </div>
  );
}
