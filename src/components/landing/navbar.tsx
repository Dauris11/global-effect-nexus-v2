"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { useApariencia } from "@/components/apariencia/usar-apariencia";
import { CONTENEDOR } from "@/components/landing/piezas";
import { Revelador } from "@/components/landing/revelador";
import { variantesBoton } from "@/components/ui/button-variantes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { TEMAS, type Tema } from "@/lib/apariencia";
import { cn } from "@/lib/utils";

/**
 * Encabezado fijo de la portada: 68 px, transparente arriba y, al bajar más de
 * 12 px, superficie al 88 % con desenfoque y línea inferior.
 *
 * Arriba no lleva fondo ni línea porque el hero ya empieza separado por aire y
 * una raya sobre nada se ve como un corte. Al rodar sí: sin fondo, el texto de
 * las secciones se vería pasar por debajo de los enlaces.
 *
 * Las anclas son `<a>` y no el `Link` de i18n: un ancla no cambia de ruta y
 * pasarla por el enrutador solo le añadiría el prefijo de idioma. En el móvil se
 * ocultan (no caben junto al botón) y siguen en el pie de la página.
 *
 * Este componente también monta `Revelador` (`useReveal`): es el único cliente que toda la
 * portada renderiza, y así las secciones de servidor no necesitan envoltorio.
 *
 * El icono del tema gira 180° al cambiar (no al cargar: `giros` empieza en 0).
 *
 * El tema usa `useApariencia`, el mismo mecanismo del portal: se guarda en el
 * aparato y el script del `<head>` lo aplica antes de pintar, sin destello.
 */

const ICONOS_TEMA: Record<Tema, typeof Sun> = { claro: Sun, oscuro: Moon, sistema: Monitor };

export function Navbar({
  enlaces,
  textos,
}: {
  enlaces: readonly { ancla: string; texto: string }[];
  textos: {
    acceder: string;
    accederCorto: string;
    logo: string;
    principal: string;
    tema: string;
    temas: Record<Tema, string>;
  };
}) {
  const [bajado, setBajado] = useState(false);
  const [giros, setGiros] = useState(0);
  const { tema, cambiar } = useApariencia();
  const IconoTema = ICONOS_TEMA[tema];

  useEffect(() => {
    const alRodar = () => setBajado(window.scrollY > 12);

    alRodar();
    window.addEventListener("scroll", alRodar, { passive: true });

    return () => window.removeEventListener("scroll", alRodar);
  }, []);

  return (
    <>
    <Revelador />
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-[250ms] ease-[var(--landing-ease)] motion-reduce:transition-none",
        bajado ? "border-linea bg-surface/88 backdrop-blur-[10px]" : "border-transparent",
      )}
    >
      <div className={cn(CONTENEDOR, "flex h-[68px] items-center gap-2.5 md:gap-6")}>
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {/* Dos versiones del logo, una por tema: la de texto oscuro y la de texto claro. */}
          <Image src="/logo.webp" alt={textos.logo} width={720} height={157} priority className="logo-claro h-8 w-auto" />
          <Image src="/logo-dark.webp" alt={textos.logo} width={720} height={157} priority className="logo-oscuro h-8 w-auto" />
        </Link>

        <nav aria-label={textos.principal} className="ml-auto hidden gap-1 md:flex">
          {enlaces.map((enlace) => (
            <a
              key={enlace.ancla}
              href={`#${enlace.ancla}`}
              className="rounded-[8px] px-3 py-2 text-sm font-medium text-tinta-2 transition-colors hover:bg-surface-2 hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {enlace.texto}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 md:ml-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={textos.tema}
                className="flex size-9 items-center justify-center rounded-[8px] border border-linea-fuerte bg-surface text-tinta transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span key={giros} className={cn("flex", giros > 0 && "tema-giro")}>
                  <IconoTema className="size-[18px]" />
                </span>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              {TEMAS.map((valor) => {
                const Icono = ICONOS_TEMA[valor];

                return (
                  <DropdownMenuItem key={valor} onSelect={() => {
                      setGiros((n) => n + 1);
                      cambiar({ tema: valor });
                    }}>
                    <Icono className="size-4" />
                    {textos.temas[valor]}
                    {tema === valor && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/login" className={variantesBoton()}>
            <span className="hidden sm:inline">{textos.acceder}</span>
            <span className="sm:hidden">{textos.accederCorto}</span>
          </Link>
        </div>
      </div>
    </header>
    </>
  );
}
