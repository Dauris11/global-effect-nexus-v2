"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CalendarClock,
  Globe2,
  LogOut,
  Menu,
  Palette,
  Search,
  Settings,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { BuscadorComandos } from "@/components/layout/buscador-comandos";
import { Campana, type AvisoVisible } from "@/components/layout/campana";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { VerComo } from "@/components/layout/ver-como";
import { useOcultos, usePermisos } from "@/components/layout/visibilidad";
import { menuDe } from "@/lib/nav";
import type { Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Barra superior (docs/09-sistema-visual.md §3): blanca, `h-16`, y con la línea
 * de abajo solo cuando la página se ha desplazado —arriba del todo no hay nada
 * que separar—.
 *
 * Tres zonas, como en Airbnb:
 *   · Izquierda: en el móvil, el isotipo (allí no hay barra lateral que lleve
 *     el logo). En escritorio, nada: el logo ya está en la lateral.
 *   · Centro (≥ md): el buscador en píldora. Abre un buscador de comandos sobre
 *     las pantallas del rol, también con Cmd/Ctrl+K.
 *   · Derecha: el aviso de prematrícula si lo hay, la campana y el botón
 *     "menú + avatar", que abre perfil, configuración, idioma y cerrar sesión.
 *
 * El TÍTULO de la página ya no vive aquí: lo pone cada página con
 * `EncabezadoPagina`. En el móvil este título acababa en `text-xs`.
 */
export function TopBar({
  rol,
  rolReal,
  nombre,
  foto,
  aviso,
  avisos,
  sinLeer,
  onCerrarSesion,
}: {
  rol: Rol;
  rolReal: Rol;
  nombre: string;
  /** URL pública de la foto de perfil, o `null` para dibujar la inicial. */
  foto: string | null;
  /**
   * Aviso puntual, ya traducido en el servidor: hoy, la ventana de prematrícula
   * de Global Effect 360. Va en la cabecera y no en una sección porque tiene
   * fecha de caducidad y hay que verlo desde cualquier pantalla.
   */
  aviso: { texto: string; href: string } | null;
  /** Últimos avisos de `notificacion`, ya formateados en el servidor. */
  avisos: readonly AvisoVisible[];
  /** Sin leer del total de la cuenta, no de los `avisos` que llegan. */
  sinLeer: number;
  onCerrarSesion: () => void;
}) {
  const t = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const tAuth = useTranslations("auth");
  const tComun = useTranslations("common");
  const ruta = usePathname();
  const idioma = useLocale();

  const [buscando, setBuscando] = useState(false);
  const [desplazada, setDesplazada] = useState(false);

  // La línea aparece al desplazarse. Con un oyente pasivo: no bloquea el scroll.
  useEffect(() => {
    const alDesplazar = () => setDesplazada(window.scrollY > 4);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, []);

  // Cmd+K en Mac, Ctrl+K en el resto: el atajo de buscador que ya conoce todo
  // el mundo. Se ignora con modificadores de más para no pisar otros atajos.
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (
        evento.key.toLowerCase() === "k" &&
        (evento.metaKey || evento.ctrlKey) &&
        !evento.shiftKey &&
        !evento.altKey
      ) {
        evento.preventDefault();
        setBuscando((valor) => !valor);
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  // "Configuración" solo para quien la tiene en su menú: ofrecer una puerta que
  // el servidor va a cerrar no sirve de nada.
  const ocultos = useOcultos();
  const permisos = usePermisos();
  const tieneConfiguracion = menuDe(rol, ocultos, permisos).some((area) =>
    area.secciones.some((seccion) =>
      seccion.items.some((item) => item.href === "/configuracion"),
    ),
  );

  return (
    <header
      className={cn(
        "bg-background/95 sticky top-0 z-30 flex h-16 items-center gap-3 px-4 backdrop-blur-md transition-[border-color,box-shadow] md:px-6 lg:px-8",
        desplazada ? "border-b border-linea shadow-card" : "border-b border-transparent",
      )}
    >
      <Link
        href="/"
        title={tComun("appName")}
        className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
      >
        <Image src="/isotipo.webp" alt={tComun("appName")} width={212} height={212} className="size-10" />
      </Link>

      {/* La píldora de búsqueda, centrada en el espacio libre. */}
      <div className="hidden flex-1 justify-center md:flex">
        <button
          type="button"
          onClick={() => setBuscando(true)}
          className="flex h-12 w-full max-w-md items-center gap-3 rounded-full border border-linea bg-background pr-1.5 pl-5 text-left shadow-card transicion-control duration-(--duracion-media) hover:shadow-elevada active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="flex-1 truncate text-[15px] text-tinta-2">{t("commandOpen")}</span>
          <kbd className="texto-meta hidden rounded-md border border-linea px-1.5 py-0.5 font-sans lg:inline">
            {t("commandShortcut")}
          </kbd>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marca-500 text-white">
            <Search className="size-4" />
          </span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        {/* En el móvil la búsqueda es un icono: no cabe la píldora. */}
        <button
          type="button"
          onClick={() => setBuscando(true)}
          aria-label={t("commandOpen")}
          className="flex size-11 items-center justify-center rounded-full text-tinta transicion-control hover:bg-muted active:scale-95 md:hidden"
        >
          <Search className="size-5" />
        </button>

        {/* El aviso es un enlace: quien lo lee quiere ir a elegir sus
            materias, no solo enterarse. En pantalla estrecha queda el icono. */}
        {aviso && (
          <Link
            href={aviso.href}
            title={aviso.texto}
            className="inline-flex h-11 max-w-[18rem] items-center gap-1.5 rounded-full bg-marca-50 px-3 text-sm font-semibold text-marca-700 transicion-control hover:bg-marca-100 active:scale-[0.97]"
          >
            <CalendarClock className="size-4 shrink-0" />
            <span className="hidden truncate lg:inline">{aviso.texto}</span>
          </Link>
        )}

        {/* Con un rol prestado, el control vive en la franja de arriba. */}
        {rol === rolReal && (
          <div className="hidden md:block">
            <VerComo rol={rol} rolReal={rolReal} />
          </div>
        )}

        <Campana avisos={avisos} sinLeer={sinLeer} />

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("accountMenu")}
            className="flex h-11 items-center gap-2 rounded-full border border-linea pr-1 pl-3 transicion-control hover:shadow-card active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Menu className="size-4 text-tinta" />
            <Avatar className="size-8">
              {foto && <AvatarImage src={foto} alt="" />}
              <AvatarFallback className="bg-tinta text-background text-xs font-semibold">
                {inicial(nombre)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            {/* Quién eres y con qué rol: la insignia del rol vive aquí y no
                en la barra, que ya no tiene sitio para lo que no se usa. */}
            <DropdownMenuLabel className="flex flex-col gap-1.5 py-2">
              <span className="truncate text-[15px] font-semibold text-tinta">{nombre}</span>
              <Badge variant="neutra" className="font-medium">
                {tRoles(rol)}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/perfil">
                <User />
                {t("profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/perfil">
                <Palette />
                {t("appearance")}
              </Link>
            </DropdownMenuItem>
            {rol === "contabilidad" && (
              <DropdownMenuItem asChild>
                <Link href="/contabilidad/configuracion">
                  <Settings />
                  {t("accountingSettings")}
                </Link>
              </DropdownMenuItem>
            )}
            {tieneConfiguracion && (
              <DropdownMenuItem asChild>
                <Link href="/configuracion">
                  <Settings />
                  {t("settings")}
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="texto-meta flex items-center gap-2 font-medium">
              <Globe2 className="size-4" />
              {t("language")}
            </DropdownMenuLabel>
            {(["es", "en"] as const).map((codigo) => (
              <DropdownMenuItem key={codigo} asChild>
                <Link
                  href={ruta}
                  locale={codigo}
                  aria-current={idioma === codigo ? "true" : undefined}
                  className={cn(idioma === codigo && "font-semibold text-tinta")}
                >
                  {codigo === "es" ? t("spanish") : t("english")}
                </Link>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCerrarSesion}>
              <LogOut />
              {tAuth("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <BuscadorComandos
        abierto={buscando}
        onCambiar={setBuscando}
        rol={rol}
      />
    </header>
  );
}

function inicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || "?";
}
