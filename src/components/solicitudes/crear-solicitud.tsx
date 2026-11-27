"use client";

import { useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { TipoSolicitud } from "@/lib/solicitudes";
import type { EstudianteOpcion } from "@/server/solicitudes/consultas";

import { FormularioCompra } from "./formulario-compra";
import { FormularioSolicitud } from "./formulario-solicitud";

/**
 * Botón que abre el alta en un panel lateral (docs/ux-rules.md §6), en vez de dejar los
 * dos formularios encima de la lista. `modo` elige cuál: la aprobación interna
 * (constancia, gasto, beca…) o la compra con cotización, que va aparte porque la
 * pueden pedir todos los roles y sube un archivo.
 *
 * `abrirInicial` es para los atajos con `?tipo=` (Habitudes, chofer, «Crear solicitud de
 * gasto» de Rendiciones): llegan con el panel ya abierto y el tipo elegido.
 */
export function CrearSolicitud({
  modo,
  variante = "default",
  tipos = [],
  estudiantes = [],
  minimoFecha,
  tipoInicial,
  abrirInicial = false,
}: {
  modo: "solicitud" | "compra";
  variante?: "default" | "outline";
  tipos?: readonly TipoSolicitud[];
  estudiantes?: readonly EstudianteOpcion[];
  minimoFecha?: string;
  tipoInicial?: TipoSolicitud;
  abrirInicial?: boolean;
}) {
  const t = useTranslations("requests");
  const tl = useTranslations("listas");
  const [abierto, setAbierto] = useState(abrirInicial);
  const esCompra = modo === "compra";
  const titulo = esCompra ? t("purchase.title") : t("newTitle");

  return (
    <>
      <Button type="button" variant={variante} onClick={() => setAbierto(true)}>
        {esCompra ? <ShoppingCart /> : <Plus />}
        {tl((esCompra ? "solicitudes.pedirCompra" : "solicitudes.crear") as never)}
      </Button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent>
          <div className="border-b border-linea px-6 py-5 pr-14">
            <SheetTitle className="text-section">{titulo}</SheetTitle>
            <SheetDescription className="sr-only">{titulo}</SheetDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {esCompra ? (
              <FormularioCompra />
            ) : (
              <FormularioSolicitud
                origen="personal"
                tipos={tipos}
                estudiantes={estudiantes}
                minimoFecha={minimoFecha ?? ""}
                tipoInicial={tipoInicial}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
