"use client";

import { Check, MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Todas las variantes × tamaños × estados del botón, en claro y en oscuro. Es la referencia
 * contra la que se revisa cualquier botón nuevo: si no aparece aquí, no existe.
 *
 * Hover y foco no se pueden «pulsar» en una muestra estática, así que se fuerzan con las
 * mismas variables `--btn-*` que usa el componente (la clase `forzar-*` solo existe aquí).
 */
const VARIANTES = ["primary", "secondary", "ghost", "danger", "danger-solid"] as const;
const TAMANOS = [
  { id: "sm", px: 32 },
  { id: "md", px: 36 },
  { id: "lg", px: 44 },
] as const;

const HOVER: Record<(typeof VARIANTES)[number], string> = {
  primary: "!bg-(--btn-primary-hover)",
  secondary: "!bg-(--btn-secondary-hover)",
  ghost: "!bg-(--btn-ghost-hover)",
  danger: "!bg-(--btn-danger-hover)",
  "danger-solid": "opacity-90",
};

function Tabla({ oscuro }: { oscuro: boolean }) {
  return (
    <div className={cn(oscuro && "dark", "overflow-x-auto rounded-card border border-linea bg-background p-5 text-tinta")}>
      <p className={"text-label mb-4"}>{oscuro ? "Oscuro" : "Claro"}</p>
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className={"text-meta text-tinta-2"}>
            <th className="pb-2 font-medium">Variante</th>
            <th className="pb-2 font-medium">Normal</th>
            <th className="pb-2 font-medium">Hover</th>
            <th className="pb-2 font-medium">Foco</th>
            <th className="pb-2 font-medium">Deshabilitado</th>
            <th className="pb-2 font-medium">Cargando</th>
          </tr>
        </thead>
        <tbody>
          {VARIANTES.map((v) => (
            <tr key={v} className="align-middle">
              <td className={"py-2 pr-3 font-mono text-xs"}>{v}</td>
              <td className="py-2 pr-3">
                <Button variant={v}><Plus />Nuevo</Button>
              </td>
              <td className="py-2 pr-3">
                <Button variant={v} className={HOVER[v]}><Plus />Nuevo</Button>
              </td>
              <td className="py-2 pr-3">
                <Button variant={v} className="shadow-[0_0_0_3px_var(--btn-halo)]"><Plus />Nuevo</Button>
              </td>
              <td className="py-2 pr-3">
                <Button variant={v} disabled><Plus />Nuevo</Button>
              </td>
              <td className="py-2 pr-3">
                <Button variant={v} loading><Plus />Guardar</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex flex-wrap items-end gap-6">
        {TAMANOS.map((tam) => (
          <div key={tam.id} className="space-y-2">
            <p className={"text-meta text-tinta-2"}>{tam.id} · {tam.px} px</p>
            <div className="flex items-center gap-2">
              <Button size={tam.id} variant="secondary"><Check />Aprobar</Button>
              <Button size={tam.id} variant="ghost" className="text-(--btn-danger-fg)">Rechazar</Button>
              <Button
                size={tam.id === "sm" ? "icon-sm" : tam.id === "md" ? "icon" : "icon-lg"}
                variant="secondary"
                aria-label="Más acciones"
                title="Más acciones"
              >
                <MoreHorizontal />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatrizBotones() {
  return (
    <div className="space-y-4">
      <Tabla oscuro={false} />
      <Tabla oscuro />
    </div>
  );
}
