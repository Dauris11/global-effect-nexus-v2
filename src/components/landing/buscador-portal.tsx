"use client";

import {
  BookOpen,
  ChevronRight,
  DollarSign,
  GraduationCap,
  Inbox,
  LogIn,
  Search,
  Shield,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * La búsqueda-píldora de la barra: "¿A qué portal entras?".
 *
 * No busca texto: abre una hoja con los destinos que la landing ya ofrecía
 * (portal, comida, solicitudes y los accesos por rol). Es la barra de Airbnb
 * usada como acceso, porque quien llega aquí casi siempre viene a entrar, y
 * así la puerta está en el primer sitio donde mira.
 *
 * Los destinos llegan del servidor ya traducidos; el icono va como clave y no
 * como componente porque una función no se puede pasar de servidor a cliente.
 */

const ICONOS = {
  portal: LogIn,
  comida: UtensilsCrossed,
  solicitudes: Inbox,
  estudiantes: GraduationCap,
  profesores: BookOpen,
  administracion: Shield,
  contabilidad: DollarSign,
} satisfies Record<string, LucideIcon>;

export type ClaveIcono = keyof typeof ICONOS;

export type DestinoPortal = {
  icono: ClaveIcono;
  titulo: string;
  texto?: string;
  href: string;
};

export function BuscadorPortal({
  destinos,
  roles,
  textos,
  className,
}: {
  destinos: readonly DestinoPortal[];
  roles: readonly DestinoPortal[];
  textos: { pregunta: string; ayuda: string; porRol: string };
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          "group flex h-12 w-full items-center gap-3 rounded-full border border-linea bg-background pr-1.5 pl-5 text-left shadow-card transition-shadow hover:shadow-elevada focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-tinta">
            {textos.pregunta}
          </span>
          <span className="block truncate text-xs text-tinta-2">{textos.ayuda}</span>
        </span>
        {/* El círculo turquesa es el "botón de buscar" de la píldora: el
            acento que marca dónde se pulsa. */}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marca-500 text-white transition-colors group-hover:bg-marca-600">
          <Search className="size-4" />
        </span>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{textos.pregunta}</DialogTitle>
          <DialogDescription>{textos.ayuda}</DialogDescription>
        </DialogHeader>

        <ul className="-mx-2">
          {destinos.map((destino) => {
            const Icono = ICONOS[destino.icono];
            return (
              <li key={destino.href + destino.titulo}>
                <Link
                  href={destino.href}
                  className="flex min-h-14 items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-tinta">
                    <Icono className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-tinta">
                      {destino.titulo}
                    </span>
                    {destino.texto && (
                      <span className="line-clamp-1 block text-sm text-tinta-2">
                        {destino.texto}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-tinta-3" />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-linea pt-4">
          <p className="texto-meta">{textos.porRol}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {roles.map((rol) => {
              const Icono = ICONOS[rol.icono];
              return (
                <li key={rol.titulo}>
                  <Link
                    href={rol.href}
                    className="flex h-11 items-center gap-2 rounded-full border border-linea-fuerte px-4 text-sm font-medium text-tinta transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Icono className="size-4 shrink-0 text-tinta-2" />
                    <span className="truncate">{rol.titulo}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
