import { cn } from "@/lib/utils";

/**
 * Piezas de maquetación que comparten todas las secciones de la landing.
 *
 * Viven juntas y no en `ui/` porque solo tienen sentido aquí: el contenedor de
 * la landing, la cabecera de sección y el carrusel de tarjetas tipo anuncio.
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

/** Título de sección, con su línea de apoyo y una acción opcional a la derecha. */
export function CabeceraSeccion({
  titulo,
  texto,
  accion,
  id,
}: {
  titulo: string;
  texto?: string;
  accion?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="revelar flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 id={id} className={TITULO_SECCION}>
          {titulo}
        </h2>
        {texto && <p className="mt-3 text-lg leading-relaxed text-tinta-2">{texto}</p>}
      </div>
      {accion}
    </div>
  );
}

/**
 * Fila de tarjetas: carrusel horizontal con snap en el teléfono y rejilla
 * desde `md`, como las filas de anuncios de Airbnb.
 *
 * En móvil cada tarjeta mide el 78 % del ancho para que asome la siguiente:
 * es lo que dice "hay más, desliza" sin poner flechas. `scroll-px-4` hace que
 * el snap respete el mismo margen que el resto de la página.
 */
export function Carrusel({
  children,
  columnas = 3,
  etiqueta,
}: {
  children: React.ReactNode;
  columnas?: 3 | 4;
  etiqueta?: string;
}) {
  return (
    <ul
      aria-label={etiqueta}
      className={cn(
        "sin-barra -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2",
        "md:mx-0 md:grid md:gap-6 md:overflow-visible md:px-0 md:pb-0 revelar-hijos",
        columnas === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3",
      )}
    >
      {children}
    </ul>
  );
}

/** Elemento del carrusel: fija el ancho en móvil y el punto de snap. */
export function ElementoCarrusel({ children }: { children: React.ReactNode }) {
  return (
    <li className="w-[78%] shrink-0 snap-start sm:w-[46%] md:w-auto">
      {children}
    </li>
  );
}

/**
 * Tarjeta tipo anuncio (docs/09 §4.4): la cabecera visual arriba —foto o un
 * icono grande—, el título en semibold y una o dos líneas en `tinta-2`.
 *
 * La cabecera la pone quien la usa porque cambia por sección (foto de la
 * noticia, icono del programa, fecha del evento); la insignia va arriba a la
 * izquierda, sobre ella.
 */
export function TarjetaAnuncio({
  cabecera,
  insignia,
  titulo,
  lineas,
  pie,
}: {
  cabecera: React.ReactNode;
  insignia?: React.ReactNode;
  titulo: string;
  lineas?: readonly (string | null | undefined)[];
  pie?: React.ReactNode;
}) {
  const lineasVisibles = lineas?.filter(Boolean) ?? [];

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-linea bg-card shadow-card transition-[translate,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:border-marca-300/80 hover:shadow-elevada">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {cabecera}
        {insignia && <div className="absolute top-3 left-3 z-10">{insignia}</div>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="texto-titulo-tarjeta text-tinta transition-colors group-hover:text-marca-600">
          {titulo}
        </h3>
        {lineasVisibles.length > 0 && (
          <div className="mt-2 space-y-1">
            {lineasVisibles.map((linea) => (
              <p key={linea} className="line-clamp-2 text-sm text-tinta-2">
                {linea}
              </p>
            ))}
          </div>
        )}
        {pie && (
          <div className="mt-auto border-t border-linea/60 pt-4">
            {pie}
          </div>
        )}
      </div>
    </article>
  );
}

/** Cabecera de tarjeta sin foto: un icono grande centrado sobre `marca-50`. */
export function CabeceraIcono({
  icono: Icono,
}: {
  icono: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex size-full items-center justify-center bg-marca-50/70 transition-colors group-hover:bg-marca-50">
      <Icono className="size-12 text-marca-600 transition-transform duration-300 group-hover:scale-110" />
    </div>
  );
}
