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
 */
export const SECCION = "scroll-mt-36 border-t border-linea py-12 md:scroll-mt-24 md:py-16";

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
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 id={id} className="texto-titulo-seccion md:text-[28px]">
          {titulo}
        </h2>
        {texto && <p className="mt-1.5 text-tinta-2">{texto}</p>}
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
        "md:mx-0 md:grid md:gap-6 md:overflow-visible md:px-0 md:pb-0",
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
  return (
    <article className="group flex h-full flex-col">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-muted shadow-card transition-shadow duration-200 group-hover:shadow-elevada">
        {cabecera}
        {insignia && <div className="absolute top-3 left-3">{insignia}</div>}
      </div>
      <h3 className="texto-titulo-tarjeta mt-3">{titulo}</h3>
      {lineas
        ?.filter(Boolean)
        .map((linea) => (
          <p key={linea} className="mt-0.5 line-clamp-2 text-sm text-tinta-2">
            {linea}
          </p>
        ))}
      {pie}
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
    <div className="flex size-full items-center justify-center bg-marca-50">
      <Icono className="size-12 text-marca-600 transition-transform duration-300 group-hover:scale-105" />
    </div>
  );
}
