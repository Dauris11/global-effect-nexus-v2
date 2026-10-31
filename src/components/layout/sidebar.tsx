"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Search, User, X } from "lucide-react";
import { useTranslations } from "next-intl";

import Image from "next/image";

import { useOcultos } from "@/components/layout/visibilidad";
import { Link, usePathname } from "@/i18n/navigation";
import { esRutaActiva, itemsDeArea, menuDe, type ItemNav } from "@/lib/nav";
import type { Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Barra lateral CLARA (docs/09-sistema-visual.md §3): blanca, con un borde
 * fino a la derecha, el logo real arriba y el activo en una píldora gris con el
 * icono en turquesa. Hasta octubre de 2026 era negra; con el lenguaje "app web"
 * el turquesa se reserva a lo activo y el fondo no compite con la página.
 *
 * UN solo panel, no dos. Antes eran un raíl de iconos y, al lado, el panel del
 * área elegida: dos columnas en paralelo que obligaban a pulsar un icono sin
 * texto para descubrir qué guardaba. Ahora es una columna con TODOS los módulos
 * del rol, cada uno con su icono y su nombre, agrupados por área.
 *
 * Dos anchos, y el nombre es lo único que cambia:
 *
 *   · Desplegada (w-64): icono + nombre de cada módulo, con el área como
 *     encabezado y el buscador arriba.
 *   · Replegada (w-16): solo los iconos, con el nombre en el `title` para el
 *     ratón y en `aria-label` para un lector de pantalla.
 *
 * Cerrar sesión va SIEMPRE visible, en los dos anchos y para todos los roles: es
 * lo único que alguien puede necesitar con urgencia en un sistema con datos
 * confidenciales, y esconderlo detrás de un menú es exactamente lo que no debe
 * pasar. Junto a él, el acceso al perfil propio.
 *
 * En móvil no hay barra: la navegación son las pestañas de abajo
 * (`BarraInferior`), y su pestaña "Más" abre ESTE mismo menú como hoja que sube
 * desde abajo, siempre con los nombres. Una sola definición del menú para los
 * dos tamaños.
 */

export function Sidebar({
  rol,
  nombre,
  foto,
  contraida,
  onContraer,
  abiertaEnMovil,
  onCerrarMovil,
  onCerrarSesion,
}: {
  rol: Rol;
  /** Nombre de quien mira, para el pie de la barra. */
  nombre: string;
  /** URL pública de su foto de perfil, o `null` para dibujar el icono. */
  foto: string | null;
  contraida: boolean;
  onContraer: () => void;
  abiertaEnMovil: boolean;
  onCerrarMovil: () => void;
  onCerrarSesion: () => void;
}) {
  const t = useTranslations("nav");
  const tComun = useTranslations("common");
  const tAuth = useTranslations("auth");
  const ruta = usePathname();
  const ocultos = useOcultos();
  const areas = menuDe(rol, ocultos);

  /*
   * Solo UNA entrada activa: la más específica. Con un simple "empieza por",
   * en `/portal/estudiante/solicitudes` se encendían a la vez "Mi Portal"
   * (`/portal/estudiante`) y "Mis solicitudes".
   */
  const hrefActivo =
    areas
      .flatMap(itemsDeArea)
      .map((item) => item.href)
      .filter((href) => esRutaActiva(ruta, href))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  const [busqueda, setBusqueda] = useState("");
  const termino = normalizar(busqueda);

  /*
   * ¿Se ven los nombres? En móvil SIEMPRE: el repliegue es de escritorio, y en
   * una pantalla estrecha una tira de iconos no ayuda a nadie. Una sola variable
   * y no la condición repetida en cada bloque, que es como una se queda
   * desparejada y la barra sale a medias.
   */
  const nombresVisibles = !contraida || abiertaEnMovil;

  /*
   * El buscador recorre TODAS las áreas del rol, no una sola. Quien busca
   * "becas" no sabe —ni tiene por qué— que eso vive dentro de Patrocinadores.
   * Cuando hay término, el menú se sustituye por los resultados: mantener los
   * grupos alrededor de dos coincidencias solo estorba.
   */
  const grupos = termino
    ? [
        {
          clave: "resultados",
          etiqueta: null,
          items: areas.flatMap((area) =>
            itemsDeArea(area).filter((item) =>
              normalizar(t(item.etiqueta)).includes(termino),
            ),
          ),
        },
      ]
    : areas.map((area) => ({
        clave: area.clave,
        etiqueta: area.etiqueta,
        items: itemsDeArea(area),
      }));

  return (
    <>
      {/* Velo del cajón móvil. */}
      {abiertaEnMovil && (
        <div
          className="animate-velo fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onCerrarMovil}
          aria-hidden
        />
      )}

      <nav
        aria-label={tComun("appName")}
        data-barra-lateral
        className={cn(
          /*
           * Dos comportamientos que NO se pisan, y ahí estaba el fallo.
           *
           * Antes la barra era `fixed` en todos los tamaños y se le añadía
           * `md:sticky` encima. Dos utilidades de `position` compitiendo, más
           * `inset-y-0 left-0` declarados sin acotar: en escritorio seguía
           * comportándose como una capa sobre el portal en lugar de ocupar su
           * sitio. Ahora todo lo de capa va con `max-md:`, así que a partir de
           * `md` esas propiedades no existen: no hay nada que ganar ni perder.
           *
           * MÓVIL (`max-md:`): hoja inferior que sube por encima de la página
           * (la abre la pestaña "Más"). En 360 px reservarle 256 de ancho a una
           * columna no dejaría sitio para nada.
           *
           * ESCRITORIO (`md:`): columna dentro del flujo, hermana del contenido
           * en el flex de `AppShell`, pegada arriba con `sticky`. El contenido
           * empieza donde ella acaba, desplegada o replegada, porque su ancho lo
           * ocupa de verdad en lugar de simularse con un `padding`.
           */
          /*
           * Solo se animan el ancho (replegar, en escritorio: pasa pocas veces
           * al día y explica de dónde sale el sitio ganado), la posición de la
           * hoja móvil y su visibilidad, que así se oculta al TERMINAR de bajar.
           * Curva de cajón de iOS: arranca rápido y frena sin rebote.
           */
          "bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col transition-[width,translate,visibility] duration-[260ms] ease-cajon",
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:h-[85dvh] max-md:w-full max-md:rounded-t-hoja max-md:border-t max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-elevada",
          "md:sticky md:top-0 md:h-dvh md:border-r",
          nombresVisibles ? "md:w-64" : "md:w-[72px]",
          abiertaEnMovil ? "max-md:translate-y-0" : "max-md:translate-y-full max-md:invisible",
        )}
      >
        {/* ── Cabecera: marca y el botón de replegar ─────────────────── */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center gap-2",
            !nombresVisibles ? "justify-center px-2" : "pr-3 pl-5",
          )}
        >
          {/* El logo real cuando hay sitio y el isotipo —el globo— cuando la
              barra está replegada. `Image` con tamaño fijo: es un archivo de
              `public/` y no hace falta configurar dominios. */}
          <Link
            href="/"
            title={tComun("appName")}
            className={cn(
              "flex shrink-0 items-center rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              nombresVisibles ? "min-w-0 flex-1" : "",
            )}
          >
            {nombresVisibles ? (
              <Image
                src="/logo.webp"
                alt={tComun("appName")}
                width={720}
                height={157}
                priority
                className="logo-barra h-8 w-auto"
              />
            ) : (
              <Image
                src="/isotipo.webp"
                alt={tComun("appName")}
                width={212}
                height={212}
                priority
                className="size-10"
              />
            )}
          </Link>

          {(nombresVisibles) && (
            <>
              <button
                type="button"
                onClick={onContraer}
                title={t("collapse")}
                aria-label={t("collapse")}
                className="hover:bg-sidebar-accent text-tinta-2 hover:text-tinta hidden size-9 shrink-0 items-center justify-center rounded-full transicion-control active:scale-95 md:flex"
              >
                <ChevronLeft className="size-4" />
              </button>

              <button
                type="button"
                onClick={onCerrarMovil}
                aria-label={t("closeMenu")}
                className="hover:bg-sidebar-accent text-tinta flex size-11 shrink-0 items-center justify-center rounded-full transicion-control active:scale-95 md:hidden"
              >
                <X className="size-5" />
              </button>
            </>
          )}
        </div>

        {/* Replegada, el botón de desplegar ocupa su propia fila: dentro de la
            cabecera no cabía junto al logo sin apretarlo. */}
        {!nombresVisibles && (
          <button
            type="button"
            onClick={onContraer}
            title={t("expand")}
            aria-label={t("expand")}
            className="hover:bg-sidebar-accent text-tinta-2 hover:text-tinta mx-auto mb-1 hidden size-11 shrink-0 items-center justify-center rounded-full transicion-control active:scale-95 md:flex"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        {(nombresVisibles) && (
          <div className="px-3 pb-3">
            <div className="bg-muted focus-within:ring-ring flex h-11 items-center gap-2 rounded-full px-4 transition-shadow focus-within:ring-2">
              <Search className="text-tinta-2 size-4 shrink-0" />
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                className="placeholder:text-tinta-3 min-w-0 flex-1 bg-transparent text-[15px] text-tinta outline-none"
              />
            </div>
          </div>
        )}

        {/* ── Los módulos del rol ────────────────────────────────────── */}
        {/*
         * `min-h-0` no es decorativo: sin él, en Safari esta lista no se encoge.
         *
         * Es una hija flex con scroll propio. Chromium le da mínimo cero por
         * tener scroll, así que la lista se queda dentro y rueda; WebKit le da
         * el alto de su contenido, y con un rol de muchos módulos la lista
         * crece hasta empujar el pie —el perfil y CERRAR SESIÓN— fuera de la
         * pantalla. Con `min-h-0` los dos motores la dejan rodar.
         */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-3">
          {grupos.length === 0 || grupos.every((g) => g.items.length === 0) ? (
            (nombresVisibles) && (
              <p className="text-tinta-3 px-3 py-6 text-center text-sm">
                {t("noResults")}
              </p>
            )
          ) : (
            grupos
              .filter((grupo) => grupo.items.length > 0)
              .map((grupo) => (
                <div key={grupo.clave}>
                  {grupo.etiqueta && (nombresVisibles) && (
                    <p className="texto-meta px-3 pb-1.5 font-medium">
                      {t(grupo.etiqueta)}
                    </p>
                  )}

                  <div
                    className={cn(
                      "space-y-0.5",
                      !nombresVisibles && "flex flex-col items-center",
                    )}
                  >
                    {grupo.items.map((item) => (
                      <Enlace
                        key={item.href}
                        item={item}
                        texto={t(item.etiqueta)}
                        activo={item.href === hrefActivo}
                        soloIcono={!nombresVisibles}
                      />
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* ── Pie: perfil propio y cerrar sesión, siempre ────────────── */}
        <div
          className={cn(
            "border-sidebar-border shrink-0 space-y-0.5 border-t py-3",
            !nombresVisibles
              ? "flex flex-col items-center px-2"
              : "px-3",
          )}
        >
          {/* Con foto, la foto; sin foto, el icono. Es la fila que la persona
              usa para ir a cambiarla, así que enseñar ahí la que tiene puesta
              cierra el círculo. */}
          <Enlace
            item={{ etiqueta: "profile", href: "/perfil", icono: User }}
            texto={t("profile")}
            activo={esRutaActiva(ruta, "/perfil")}
            soloIcono={!nombresVisibles}
            foto={foto}
          />

          {/*
            Cerrar sesión, en los dos anchos y para todos los roles. Es un botón
            y no un enlace porque dispara una Server Action, y va aquí abajo
            junto al nombre de quien está dentro: es la respuesta a "¿quién soy
            y cómo salgo?", que son la misma pregunta.
          */}
          <button
            type="button"
            onClick={onCerrarSesion}
            title={tAuth("signOut")}
            aria-label={tAuth("signOut")}
            className={cn(
              "hover:bg-sidebar-accent text-tinta-2 hover:text-tinta flex items-center gap-3 rounded-control transicion-control active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              !nombresVisibles
                ? "size-11 justify-center"
                : "h-11 w-full px-3 text-[15px]",
            )}
          >
            <LogOut className="size-5 shrink-0" />
            {(nombresVisibles) && (
              <span className="truncate">{tAuth("signOut")}</span>
            )}
          </button>

          {(nombresVisibles) && (
            <p className="texto-meta truncate px-3 pt-1">
              {nombre}
            </p>
          )}
        </div>
      </nav>
    </>
  );
}

/** Un módulo: icono y nombre, o solo el icono cuando la barra está replegada. */
function Enlace({
  item,
  texto,
  activo,
  soloIcono,
  foto,
}: {
  item: ItemNav;
  texto: string;
  activo: boolean;
  soloIcono: boolean;
  /** Solo la fila de perfil la usa: pinta la foto en lugar del icono. */
  foto?: string | null;
}) {
  const Icono = item.icono;

  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      title={soloIcono ? texto : undefined}
      aria-label={soloIcono ? texto : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-control transicion-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.98]",
        soloIcono ? "size-11 justify-center" : "h-11 px-3 text-[15px]",
        /*
         * Indicador del activo: una raya turquesa a la izquierda que crece en
         * vertical. Los enlaces no se desmontan al navegar, así que la del que
         * se apaga encoge mientras la del nuevo crece: se lee como un cambio,
         * no como dos estados sueltos.
         */
        "before:absolute before:top-1/2 before:left-0 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-marca-500 before:transition-transform before:duration-(--duracion-media) before:ease-salida",
        activo
          ? "bg-sidebar-accent text-tinta font-semibold before:scale-y-100"
          : "text-tinta-2 hover:bg-sidebar-accent hover:text-tinta before:scale-y-0",
      )}
    >
      {foto ? (
        // `img` y no `next/image`: la foto vive en Supabase Storage, que no está
        // en `images.remotePatterns`, y el optimizador la rechazaría.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto}
          alt=""
          className="size-6 shrink-0 rounded-full object-cover ring-1 ring-linea"
        />
      ) : (
        <Icono
          className={cn(
            "size-5 shrink-0 transition-colors duration-(--duracion-rapida) ease-salida",
            activo ? "text-marca-500" : "text-tinta-2",
          )}
        />
      )}
      {!soloIcono && <span className="truncate">{texto}</span>}
    </Link>
  );
}

/**
 * Minúsculas y sin tildes, para que "academico" encuentre "Académico". Sin
 * esto habría que escribir el acento exacto, que en un buscador de menú nadie
 * escribe.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
