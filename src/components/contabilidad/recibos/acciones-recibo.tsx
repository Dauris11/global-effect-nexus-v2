"use client";

import { useActionState, useState } from "react";
import { Ban, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError } from "@/components/contabilidad/comun";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adjuntarArchivo,
  anularRecibo,
  contabilizarRecibo,
  type EstadoRecibo,
} from "@/server/contabilidad/recibos/acciones";

const INICIAL: EstadoRecibo = { estado: "inicial" };

function useMensajeError(estado: EstadoRecibo): string | null {
  const t = useTranslations("contab");
  return estado.estado === "inicial" || estado.estado === "ok"
    ? null
    : t(`error.${estado.estado}` as never);
}

/**
 * Contabilizar. Un solo botón y su explicación: el servidor decide si esta
 * persona puede (permiso y "quien registra no aprueba") y lo dice si no.
 */
export function BotonContabilizar({ id }: { id: string }) {
  const t = useTranslations("contab.detalle");
  const [estado, enviar, enviando] = useActionState(contabilizarRecibo, INICIAL);
  const error = useMensajeError(estado);

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {t("contabilizar")}
      </Button>
      <p className="texto-meta">{t("contabilizarAyuda")}</p>
      {error && <AvisoError>{error}</AvisoError>}
    </form>
  );
}

/** Anular con motivo obligatorio, en una hoja aparte para que no sea un clic al pasar. */
export function DialogoAnular({ id, numero }: { id: string; numero: string }) {
  const t = useTranslations("contab.detalle");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState(anularRecibo, INICIAL);
  const error = useMensajeError(estado);

  return (
    <Dialog open={abierto && estado.estado !== "ok"} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Ban className="size-4" />
          {t("anular")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("anularTitulo", { numero })}</DialogTitle>
          <DialogDescription>{t("anularDescripcion")}</DialogDescription>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <div className="space-y-1.5">
            <Label htmlFor="motivo" className="text-sm font-medium">
              {t("motivoCampo")}
            </Label>
            <Textarea id="motivo" name="motivo" required minLength={5} maxLength={500} rows={3} />
          </div>
          {error && <AvisoError>{error}</AvisoError>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              {t("confirmarAnular")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FormularioAdjunto({ id }: { id: string }) {
  const t = useTranslations("contab.detalle");
  const [estado, enviar, enviando] = useActionState(adjuntarArchivo, INICIAL);
  const error = useMensajeError(estado);

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor="archivo" className="text-sm font-medium">
        {t("adjuntar")}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="archivo"
          name="archivo"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {t("adjuntar")}
        </Button>
      </div>
      <p className="texto-meta">{t("adjuntoAyuda")}</p>
      {error && <AvisoError>{error}</AvisoError>}
    </form>
  );
}
