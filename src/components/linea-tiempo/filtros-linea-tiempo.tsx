"use client";

import { useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Filtros de la línea de tiempo. Viven en la URL (la página es de servidor y
 * se puede compartir): cada cambio reescribe la consulta, sin estado propio.
 */
export function FiltrosLineaTiempo({
  periodos,
  periodoActual,
  todo,
  familias,
  activas,
  etiquetaPeriodo,
  etiquetaTodo,
  etiquetaFamilias,
}: {
  periodos: { id: string; nombre: string }[];
  periodoActual: string;
  todo: boolean;
  familias: { clave: string; etiqueta: string }[];
  activas: string[];
  etiquetaPeriodo: string;
  etiquetaTodo: string;
  etiquetaFamilias: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const actuales = useSearchParams();

  const aplicar = (cambia: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(actuales.toString());
    cambia(p);
    const texto = p.toString();
    router.replace(texto ? `${ruta}?${texto}` : ruta);
  };

  const alternarFamilia = (clave: string) =>
    aplicar((p) => {
      const siguientes = activas.includes(clave)
        ? activas.filter((f) => f !== clave)
        : [...activas, clave];
      p.delete("f");
      // Sin ninguna marcada se dibujan todas: dejarlo vacío no tiene sentido.
      if (siguientes.length > 0 && siguientes.length < familias.length) {
        siguientes.forEach((f) => p.append("f", f));
      }
    });

  const chip = (activo: boolean) =>
    cn(
      "min-h-10 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors duration-(--duracion-rapida)",
      activo
        ? "border-tinta bg-tinta text-background"
        : "border-linea-fuerte text-tinta-2 hover:border-tinta hover:text-tinta",
    );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={periodoActual}
        onValueChange={(valor) =>
          aplicar((p) => {
            p.set("periodo", valor);
            p.delete("tramo");
          })
        }
        disabled={todo}
      >
        <SelectTrigger className="w-full sm:w-56" aria-label={etiquetaPeriodo}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periodos.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        aria-pressed={todo}
        onClick={() =>
          aplicar((p) => {
            if (todo) p.delete("tramo");
            else p.set("tramo", "todo");
          })
        }
        className={chip(todo)}
      >
        {etiquetaTodo}
      </button>

      <span aria-hidden className="hidden h-6 w-px bg-linea sm:block" />

      <div role="group" aria-label={etiquetaFamilias} className="flex flex-wrap gap-2">
        {familias.map((f) => (
          <button
            key={f.clave}
            type="button"
            aria-pressed={activas.includes(f.clave)}
            onClick={() => alternarFamilia(f.clave)}
            className={chip(activas.includes(f.clave))}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
