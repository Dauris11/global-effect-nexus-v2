"use client";

import { useState } from "react";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoEstado, useAccionConfig } from "@/components/contabilidad/configuracion/aviso-estado";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cerrarPeriodo, reabrirPeriodo } from "@/server/contabilidad/configuracion/acciones";

/**
 * Cerrar o reabrir un mes, siempre con confirmación en una hoja aparte:
 * los dos cambian qué se puede registrar en un mes entero. Reabrir pide
 * además el motivo, que queda en el período y en la bitácora.
 */
export function DialogoPeriodo({
  id,
  nombre,
  modo,
}: {
  id: string;
  nombre: string;
  modo: "cerrar" | "reabrir";
}) {
  const t = useTranslations("contab.config.periodos");
  const [abierto, setAbierto] = useState(false);
  const Icono = modo === "cerrar" ? Lock : LockOpen;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11">
          <Icono className="size-4" />
          {modo === "cerrar" ? t("cerrar") : t("reabrir")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modo === "cerrar" ? t("cerrarTitulo", { nombre }) : t("reabrirTitulo", { nombre })}
          </DialogTitle>
          <DialogDescription>
            {modo === "cerrar" ? t("cerrarDescripcion") : t("reabrirDescripcion")}
          </DialogDescription>
        </DialogHeader>
        <FormularioPeriodo id={id} modo={modo} alTerminar={() => setAbierto(false)} />
      </DialogContent>
    </Dialog>
  );
}

function FormularioPeriodo({
  id,
  modo,
  alTerminar,
}: {
  id: string;
  modo: "cerrar" | "reabrir";
  alTerminar: () => void;
}) {
  const t = useTranslations("contab.config.periodos");
  const [estado, enviar, enviando] = useAccionConfig(
    modo === "cerrar" ? cerrarPeriodo : reabrirPeriodo,
    alTerminar,
  );
  const Icono = modo === "cerrar" ? Lock : LockOpen;

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {modo === "reabrir" && (
        <div className="space-y-1.5">
          <Label htmlFor={`motivo-${id}`} className="text-sm font-medium">
            {t("motivo")}
          </Label>
          <Textarea id={`motivo-${id}`} name="motivo" required minLength={10} maxLength={500} rows={3} />
          <p className="texto-meta">{t("motivoAyuda")}</p>
        </div>
      )}
      <AvisoEstado estado={estado} />
      <DialogFooter>
        <Button type="submit" variant={modo === "reabrir" ? "destructive" : "default"} disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Icono className="size-4" />}
          {modo === "cerrar" ? t("confirmarCerrar") : t("confirmarReabrir")}
        </Button>
      </DialogFooter>
    </form>
  );
}
