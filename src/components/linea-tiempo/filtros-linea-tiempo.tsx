"use client";

import { useSearchParams } from "next/navigation";
import { CalendarRange, FolderKanban, GraduationCap, Globe, ListChecks, type LucideIcon } from "lucide-react";

import { ChipFiltro } from "@/components/ui/chip-filtro";
import { FilaChips } from "@/components/ui/fila-chips";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Un icono por familia: el chip lo pide y la clave viene del servidor. */
const ICONO_FAMILIA: Record<string, LucideIcon> = {
  academico: GraduationCap,
  tareas: ListChecks,
  operaciones: FolderKanban,
  clases360: Globe,
};

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

      <ChipFiltro
        icono={CalendarRange}
        etiqueta={etiquetaTodo}
        activo={todo}
        onClick={() =>
          aplicar((p) => {
            if (todo) p.delete("tramo");
            else p.set("tramo", "todo");
          })
        }
      />

      <span aria-hidden className="hidden h-6 w-px bg-linea sm:block" />

      <FilaChips etiqueta={etiquetaFamilias} className="border-b-0">
        {familias.map((f) => (
          <ChipFiltro
            key={f.clave}
            icono={ICONO_FAMILIA[f.clave] ?? ListChecks}
            etiqueta={f.etiqueta}
            activo={activas.includes(f.clave)}
            onClick={() => alternarFamilia(f.clave)}
          />
        ))}
      </FilaChips>
    </div>
  );
}
