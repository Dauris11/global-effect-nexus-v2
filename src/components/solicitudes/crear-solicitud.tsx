"use client";

import { useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  esSolicitudDinamica,
  type TipoSolicitud,
} from "@/lib/solicitudes";
import type { EstudianteOpcion } from "@/server/solicitudes/consultas";

import { FormularioCompra } from "./formulario-compra";
import { FormularioSolicitud } from "./formulario-solicitud";
import {
  FormularioSolicitudDinamica,
  type CatalogosSolicitud,
} from "./formulario-solicitud-dinamica";

/**
 * Botón que abre el alta de solicitudes en un panel lateral.
 * Por defecto muestra el formulario dinámico de Etapa 1 (`MATERIALES`, `PASAJE`, `OTRO`);
 * si el usuario tiene aprobaciones internas legadas (`alta_expediente`, `beca`, `gasto`),
 * las conserva en una segunda pestaña (y respeta los atajos `?tipo=`).
 */
export function CrearSolicitud({
  modo,
  variante = "default",
  tipos = [],
  estudiantes = [],
  catalogos,
  minimoFecha,
  tipoInicial,
  abrirInicial = false,
}: {
  modo: "solicitud" | "compra";
  variante?: "default" | "outline";
  tipos?: readonly TipoSolicitud[];
  estudiantes?: readonly EstudianteOpcion[];
  catalogos?: CatalogosSolicitud;
  minimoFecha?: string;
  tipoInicial?: TipoSolicitud;
  abrirInicial?: boolean;
}) {
  const t = useTranslations("requests");
  const td = useTranslations("requests.dinamica");
  const tl = useTranslations("listas");
  const [abierto, setAbierto] = useState(abrirInicial);
  const esCompra = modo === "compra";
  const titulo = esCompra ? t("purchase.title") : t("newTitle");

  const tiposInternos = tipos.filter((x) => !esSolicitudDinamica(x));
  const iniciaEnInternos = Boolean(
    tipoInicial && !esSolicitudDinamica(tipoInicial) && tiposInternos.includes(tipoInicial),
  );

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
            ) : catalogos ? (
              tiposInternos.length > 0 ? (
                <Tabs defaultValue={iniciaEnInternos ? "internas" : "dinamicas"} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="dinamicas">{td("tabSolicitudes")}</TabsTrigger>
                    <TabsTrigger value="internas">{td("tabAprobaciones")}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="dinamicas">
                    <FormularioSolicitudDinamica
                      catalogos={catalogos}
                      tipoInicial={
                        tipoInicial && esSolicitudDinamica(tipoInicial) ? tipoInicial : undefined
                      }
                      hrefLista="/administrativo/solicitudes"
                      alGuardar={() => setAbierto(false)}
                    />
                  </TabsContent>
                  <TabsContent value="internas">
                    <FormularioSolicitud
                      origen="personal"
                      tipos={tiposInternos}
                      estudiantes={estudiantes}
                      minimoFecha={minimoFecha ?? ""}
                      tipoInicial={
                        tipoInicial && !esSolicitudDinamica(tipoInicial) ? tipoInicial : undefined
                      }
                      hrefLista="/administrativo/solicitudes"
                      alCrear={() => setAbierto(false)}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <FormularioSolicitudDinamica
                  catalogos={catalogos}
                  tipoInicial={
                    tipoInicial && esSolicitudDinamica(tipoInicial) ? tipoInicial : undefined
                  }
                  hrefLista="/administrativo/solicitudes"
                  alGuardar={() => setAbierto(false)}
                />
              )
            ) : (
              <FormularioSolicitud
                origen="personal"
                tipos={tipos}
                estudiantes={estudiantes}
                minimoFecha={minimoFecha ?? ""}
                tipoInicial={tipoInicial}
                hrefLista="/administrativo/solicitudes"
                alCrear={() => setAbierto(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
