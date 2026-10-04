"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu, UtensilsCrossed, X } from "lucide-react";

import {
  BuscadorPortal,
  type DestinoPortal,
} from "@/components/landing/buscador-portal";
import { CONTENEDOR } from "@/components/landing/piezas";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Barra superior de la landing: blanca, con la búsqueda-píldora como acceso.
 *
 * Los enlaces de sección son anclas (`#que-hacemos`), así que van con `<a>` y no
 * con el `Link` de i18n: un ancla no cambia de ruta y pasarla por el enrutador
 * solo le añadiría el prefijo de idioma sin motivo.
 *
 * Decisiones que no se ven en el JSX:
 *
 * - La píldora va en el centro en escritorio y en una segunda fila a todo lo
 *   ancho en el teléfono, como en Airbnb. Junto al logo y "Acceder" no cabe a
 *   390 px sin recortar la pregunta, y la pregunta es lo que la hace útil.
 *
 * - Las anclas de sección viven en el menú de la derecha a todos los anchos.
 *   Antes iban en línea en `lg`, pero con la píldora en el centro competirían
 *   las dos por la mirada; la sección se encuentra también bajando y en el pie.
 *
 * - "Acceder" es el único botón relleno; "Comida" es un enlace discreto. Antes
 *   eran dos azules iguales y no se sabía cuál era el camino normal.
 *
 * - Al bajar, la barra gana su línea inferior. Arriba no la lleva: el hero ya
 *   empieza separado por aire y una línea sobre nada se ve como un corte.
 */
export function Navbar({
  enlaces,
  destinos,
  roles,
  textos,
}: {
  enlaces: readonly { ancla: string; texto: string }[];
  destinos: readonly DestinoPortal[];
  roles: readonly DestinoPortal[];
  textos: {
    comida: string;
    acceder: string;
    abrirMenu: string;
    cerrarMenu: string;
    secciones: string;
    pregunta: string;
    ayuda: string;
    porRol: string;
    logo: string;
  };
}) {
  const [abierto, setAbierto] = useState(false);
  const [posada, setPosada] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alRodar = () => setPosada(window.scrollY > 8);

    alRodar();
    window.addEventListener("scroll", alRodar, { passive: true });

    return () => window.removeEventListener("scroll", alRodar);
  }, []);

  // El menú se cierra con Escape o al pulsar fuera, como cualquier desplegable.
  useEffect(() => {
    if (!abierto) return;

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };
    const alPulsar = (evento: PointerEvent) => {
      if (!menu.current?.contains(evento.target as Node)) setAbierto(false);
    };

    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alPulsar);

    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alPulsar);
    };
  }, [abierto]);

  const buscador = (
    <BuscadorPortal
      destinos={destinos}
      roles={roles}
      textos={{ pregunta: textos.pregunta, ayuda: textos.ayuda, porRol: textos.porRol }}
    />
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background transition-colors duration-200",
        posada ? "border-linea" : "border-transparent",
      )}
    >
      <div className={cn(CONTENEDOR, "flex h-16 items-center gap-4 md:h-20")}>
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Image
            src="/logo-white.webp"
            alt={textos.logo}
            width={132}
            height={36}
            priority
            // El logo es blanco; sobre la barra clara se pasa a negro. En modo
            // oscuro la barra es oscura y el logo vuelve a ser blanco.
            className="h-9 w-auto brightness-0 dark:brightness-100"
          />
        </Link>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className="w-full max-w-sm">{buscador}</div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          <Link
            href="/comida"
            className="hidden h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-tinta transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:flex"
          >
            <UtensilsCrossed className="size-4" />
            {textos.comida}
          </Link>

          <Button asChild>
            <Link href="/login">{textos.acceder}</Link>
          </Button>

          <div ref={menu} className="relative">
            <button
              type="button"
              onClick={() => setAbierto((valor) => !valor)}
              aria-label={abierto ? textos.cerrarMenu : textos.abrirMenu}
              aria-expanded={abierto}
              aria-controls="menu-landing"
              className="ml-1 flex size-11 items-center justify-center rounded-full border border-linea-fuerte text-tinta transition-shadow hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {abierto ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            {abierto && (
              <nav
                id="menu-landing"
                aria-label={textos.secciones}
                className="animate-in fade-in slide-in-from-top-1 absolute top-full right-0 mt-2 w-64 rounded-card border border-linea bg-background py-2 shadow-elevada duration-150"
              >
                {enlaces.map((enlace) => (
                  <a
                    key={enlace.ancla}
                    href={`#${enlace.ancla}`}
                    onClick={() => setAbierto(false)}
                    className="flex h-11 items-center px-4 text-sm text-tinta transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    {enlace.texto}
                  </a>
                ))}

                <div className="my-2 border-t border-linea" />

                <Link
                  href="/comida"
                  onClick={() => setAbierto(false)}
                  className="flex h-11 items-center gap-2 px-4 text-sm font-semibold text-tinta transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <UtensilsCrossed className="size-4" />
                  {textos.comida}
                </Link>
              </nav>
            )}
          </div>
        </div>
      </div>

      {/* Segunda fila en el teléfono: la píldora a todo lo ancho. */}
      <div className={cn(CONTENEDOR, "pb-3 md:hidden")}>{buscador}</div>
    </header>
  );
}
