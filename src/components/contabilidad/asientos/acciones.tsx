"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, CheckCheck, Loader2, Pause, Play, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, AvisoOk } from "@/components/contabilidad/comun";
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
import { Link } from "@/i18n/navigation";
import { MOTIVO_MINIMO } from "@/lib/contabilidad/asientos";
import {
  cambiarPlantilla,
  generarDelMes,
  procesarAsientos,
  revertirAsiento,
  type EstadoAccionAsiento,
} from "@/server/contabilidad/asientos/acciones";

const INICIAL: EstadoAccionAsiento = { estado: "inicial" };

function useError(estado: EstadoAccionAsiento): string | null {
  const t = useTranslations("contab.asientos.error");
  return estado.estado === "inicial" || estado.estado === "ok" ? null : t(estado.estado);
}

/**
 * Revertir con motivo, en un diálogo aparte para que no sea un clic al
 * pasar. El botón de confirmar espera al motivo mínimo; el servidor lo
 * vuelve a exigir.
 */
export function DialogoRevertir({
  id,
  numero,
  periodoCerrado,
}: {
  id: string;
  numero: string;
  periodoCerrado: boolean;
}) {
  const t = useTranslations("contab.asientos.revertir");
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estado, enviar, enviando] = useActionState(revertirAsiento, INICIAL);
  const error = useError(estado);

  return (
    <Dialog open={abierto && estado.estado !== "ok"} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Undo2 className="size-4" />
          {t("boton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("titulo", { numero })}</DialogTitle>
          <DialogDescription>{t("descripcion")}</DialogDescription>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          {periodoCerrado && <p className="texto-meta">{t("cerradoAviso")}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="motivo" className="text-sm font-medium">
              {t("motivo")}
            </Label>
            <Textarea
              id="motivo"
              name="motivo"
              required
              minLength={MOTIVO_MINIMO}
              maxLength={500}
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <p className="texto-meta">{t("motivoAyuda", { n: MOTIVO_MINIMO })}</p>
          </div>
          {error && <AvisoError>{error}</AvisoError>}
          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={enviando || motivo.trim().length < MOTIVO_MINIMO}
            >
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              {t("confirmar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Generar el de este mes". Al terminar enlaza al asiento que salió. */
export function BotonGenerar({ id, deshabilitado }: { id: string; deshabilitado: boolean }) {
  const t = useTranslations("contab.asientos.plantillas");
  const [estado, enviar, enviando] = useActionState(generarDelMes, INICIAL);
  const error = useError(estado);

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" disabled={deshabilitado || enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
        {t("generar")}
      </Button>
      {estado.estado === "ok" && estado.id && (
        <AvisoOk>
          <Link href={`/contabilidad/asientos/${estado.id}`} className="font-medium underline">
            {t("generadoOk")}
          </Link>
        </AvisoOk>
      )}
      {error && <AvisoError>{error}</AvisoError>}
    </form>
  );
}

export function BotonActivar({ id, activo }: { id: string; activo: boolean }) {
  const t = useTranslations("contab.asientos.plantillas");
  const [estado, enviar, enviando] = useActionState(cambiarPlantilla, INICIAL);
  const error = useError(estado);
  const Icono = activo ? Pause : Play;

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={String(!activo)} />
      <Button type="submit" variant="ghost" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Icono className="size-4" />}
        {activo ? t("desactivar") : t("activar")}
      </Button>
      {error && <AvisoError>{error}</AvisoError>}
    </form>
  );
}

/** Procesar un asiento desde su ficha. */
export function BotonProcesar({ id }: { id: string }) {
  const t = useTranslations("contab.asientos.procesar");
  const [estado, enviar, enviando] = useActionState(procesarAsientos, INICIAL);
  const error = useError(estado);

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="ids" value={id} />
      <Button type="submit" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
        {t("boton")}
      </Button>
      {error && <AvisoError>{error}</AvisoError>}
    </form>
  );
}

/**
 * La lista de asientos dentro de un formulario: cada asiento sin procesar
 * trae su casilla `ids` (la pinta la lista, que es de servidor) y este
 * envoltorio solo pone el botón y el resultado. Así la tabla no tiene que
 * hidratarse para poder elegir.
 */
export function FormularioProcesar({ children }: { children: React.ReactNode }) {
  const t = useTranslations("contab.asientos.procesar");
  const [estado, enviar, enviando] = useActionState(procesarAsientos, INICIAL);
  const error = useError(estado);

  return (
    <form action={enviar} className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {estado.estado === "ok" && <AvisoOk>{t("ok")}</AvisoOk>}
        <Button type="submit" variant="secondary" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
          {t("seleccionados")}
        </Button>
      </div>
      {error && <AvisoError>{error}</AvisoError>}
      {children}
    </form>
  );
}
