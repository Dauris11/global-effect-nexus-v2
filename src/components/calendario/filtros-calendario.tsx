"use client";

import { Filter, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Un filtro puesto, con su cruz para quitarlo. */
export function FiltroPuesto({
  nombre,
  onQuitar,
}: {
  nombre: string;
  onQuitar: () => void;
}) {
  return (
    <Badge className="gap-1 bg-marca-500/15 text-[11px] text-marca-600">
      {nombre}
      {/* `size-6` y `-mr-1`: la cruz es la diana que se usa con el dedo y
          sola quedaba en 12 px; el margen negativo evita que crezca la
          insignia. */}
      <button
        type="button"
        onClick={onQuitar}
        aria-label={nombre}
        className="-mr-1 flex size-6 items-center justify-center rounded-full transition-colors outline-none hover:bg-marca-500/25 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

/** Menú de filtro con casillas. */
export function FiltroMenu({
  etiqueta,
  opciones,
  elegidas,
  onCambiar,
}: {
  etiqueta: string;
  opciones: readonly (readonly [string, string])[];
  elegidas: string[];
  onCambiar: (valores: string[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={etiqueta}>
          <Filter className="size-4" />
          <span>{etiqueta}</span>
          {elegidas.length > 0 && (
            <Badge className="ml-1 bg-marca-500/15 px-1.5 text-[10px] text-marca-600">
              {elegidas.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{etiqueta}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {opciones.map(([valor, nombre]) => (
          <DropdownMenuCheckboxItem
            key={valor}
            checked={elegidas.includes(valor)}
            onCheckedChange={(marcada) =>
              onCambiar(
                marcada
                  ? [...elegidas, valor]
                  : elegidas.filter((v) => v !== valor),
              )
            }
          >
            {nombre}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
