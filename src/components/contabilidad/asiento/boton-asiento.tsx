"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenCheck, CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { PanelAsiento } from "@/components/contabilidad/asiento/panel-asiento";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { VistaAsiento } from "@/lib/contabilidad/vista-asiento";

type Estado = { tipo: "cargando" } | { tipo: "error" } | { tipo: "listo"; vista: VistaAsiento };

/**
 * Botón «Asiento»: abre un diálogo y, cada vez que se abre, pide la vista a
 * `cargar` (una acción de servidor que ya comprobó el permiso). Se vuelve a
 * pedir en cada apertura porque lo que muestra depende de lo que la persona
 * acaba de elegir (banco, montos) y de la configuración de códigos, que puede
 * cambiar en otra pestaña.
 *
 * `cargar` se guarda en una referencia para que pasar una flecha nueva en cada
 * render no dispare otra carga.
 */
export function BotonAsiento({
  cargar,
  className,
  size = "sm",
}: {
  cargar: () => Promise<VistaAsiento>;
  className?: string;
  size?: "default" | "sm";
}) {
  const t = useTranslations("contab.asiento");
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  // Se pide al abrir (en el manejador, no en un efecto) y se descarta la
  // respuesta de una apertura anterior si ya se cerró o se volvió a abrir.
  const peticion = useRef(0);
  const cambiarApertura = (valor: boolean) => {
    setAbierto(valor);
    const mia = ++peticion.current;
    if (!valor) return;
    setEstado({ tipo: "cargando" });
    cargarRef
      .current()
      .then((vista) => mia === peticion.current && setEstado({ tipo: "listo", vista }))
      .catch(() => mia === peticion.current && setEstado({ tipo: "error" }));
  };

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size={size} className={className}>
          <BookOpenCheck className="size-4" />
          {t("boton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("titulo")}</DialogTitle>
        </DialogHeader>
        {estado.tipo === "cargando" && (
          <div className="space-y-3" role="status" aria-label={t("cargando")}>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {estado.tipo === "error" && (
          <p role="alert" className="flex items-start gap-2 rounded-control bg-tinta p-3 text-sm text-background">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {t("error")}
          </p>
        )}
        {estado.tipo === "listo" && <PanelAsiento vista={estado.vista} />}
      </DialogContent>
    </Dialog>
  );
}
