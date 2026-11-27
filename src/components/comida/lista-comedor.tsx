"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { marcarServido } from "@/server/comida/acciones-lista";

type Comensal = { id: string; nombre: string; hora_inscripcion: string; a_tiempo: boolean; servido: boolean };

/**
 * La lista con la que sirve la cocina: número, nombre, hora y un check de «servido» que se guarda al pulsar.
 * El check cambia en pantalla antes de la respuesta y vuelve atrás si el servidor la rechaza.
 */
export function ListaComedor({ comensales, puedeMarcar }: { comensales: readonly Comensal[]; puedeMarcar: boolean }) {
  const t = useTranslations("comida");
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const [, iniciar] = useTransition();

  const servido = (c: Comensal) => local[c.id] ?? c.servido;
  const alternar = (c: Comensal) => {
    const nuevo = !servido(c);
    setLocal((l) => ({ ...l, [c.id]: nuevo }));
    iniciar(async () => {
      const r = await marcarServido(c.id, nuevo);
      if (!r.ok) setLocal((l) => ({ ...l, [c.id]: !nuevo }));
    });
  };

  return (
    <ol data-list className="divide-y divide-linea rounded-card border border-linea bg-card print:border-0">
      {comensales.map((c, i) => (
        <li key={c.id} className="flex min-h-12 items-center gap-3 px-3.5 py-2 text-sm">
          <span className="text-meta w-7 shrink-0 tabular-nums">{i + 1}</span>
          <span className={cn("min-w-0 flex-1 truncate font-medium", servido(c) && "text-tinta-3 line-through")}>{c.nombre}</span>
          <span className={cn("shrink-0 font-mono text-xs", c.a_tiempo ? "text-tinta-3" : "font-semibold text-tinta")}>{c.hora_inscripcion.slice(0, 5)}</span>
          <button
            type="button"
            onClick={() => alternar(c)}
            disabled={!puedeMarcar}
            aria-pressed={servido(c)}
            aria-label={`${t("served")} · ${c.nombre}`}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden",
              servido(c) ? "border-marca-500 bg-marca-500 text-white" : "border-linea-fuerte bg-background text-transparent hover:text-tinta-3",
            )}
          >
            <Check aria-hidden className="size-4" />
          </button>
        </li>
      ))}
    </ol>
  );
}
