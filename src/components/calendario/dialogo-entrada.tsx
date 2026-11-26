"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CalendarDays, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Entrada } from "@/lib/calendario";
import { eliminarEvento, guardarEvento } from "@/server/calendario/acciones";

const TIPOS_EVENTO = [
  "academico",
  "administrativo",
  "social",
  "reunion",
  "otro",
] as const;

export { TIPOS_EVENTO };

export function DialogoEntrada({
  entrada,
  onCerrar,
  puedeCrear,
}: {
  entrada: Entrada | null;
  onCerrar: () => void;
  puedeCrear: boolean;
}) {
  const t = useTranslations("calendar");
  const [guardando, transicion] = useTransition();

  if (!entrada) return null;

  const editableComoEvento = entrada.origen === "evento" && puedeCrear;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entrada.titulo}</DialogTitle>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-tinta-3 w-24 shrink-0">
              {t("event.date")}
            </dt>
            <dd>
              {entrada.dia}
              {entrada.hora ? ` · ${entrada.hora.slice(0, 5)}` : ` · ${t("allDay")}`}
              {entrada.horaFin ? `–${entrada.horaFin.slice(0, 5)}` : ""}
            </dd>
          </div>

          {entrada.detalle && (
            <div className="flex gap-2">
              <dt className="text-tinta-3 w-24 shrink-0">
                {t("event.type")}
              </dt>
              <dd>{entrada.detalle}</dd>
            </div>
          )}

          {entrada.ubicacion && (
            <div className="flex gap-2">
              <dt className="text-tinta-3 w-24 shrink-0">
                {t("event.place")}
              </dt>
              <dd>{entrada.ubicacion}</dd>
            </div>
          )}

          {entrada.descripcion && (
            <div className="flex gap-2">
              <dt className="text-tinta-3 w-24 shrink-0">
                {t("event.description")}
              </dt>
              <dd className="min-w-0">{entrada.descripcion}</dd>
            </div>
          )}
        </dl>

        {editableComoEvento && (
          <FormularioEvento entrada={entrada} onTerminar={onCerrar} />
        )}

        <DialogFooter>
          {editableComoEvento && (
            <Button
              variant="destructive"
              size="sm"
              cargando={guardando}
              onClick={() => {
                if (!window.confirm(t("deleteConfirm"))) return;

                const datos = new FormData();
                datos.set("id", entrada.id);

                transicion(async () => {
                  await eliminarEvento({ estado: "inicial" }, datos);
                  onCerrar();
                });
              }}
            >
              <Trash2 className="size-3.5" />
              {guardando ? t("deleting") : t("deleteEvent")}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={onCerrar}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Alta de un evento en un día concreto. */
export function DialogoAlta({
  dia,
  onCerrar,
}: {
  dia: string | null;
  onCerrar: () => void;
}) {
  const t = useTranslations("calendar");

  if (!dia) return null;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newEvent.title")}</DialogTitle>
        </DialogHeader>

        <FormularioEvento dia={dia} onTerminar={onCerrar} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Formulario de evento, para alta y para edición.
 *
 * Un `form` de verdad contra la Server Action: guardar no depende de que haya
 * JavaScript cargado, y el servidor vuelve a comprobar el permiso y el tipo.
 */
function FormularioEvento({
  entrada,
  dia,
  onTerminar,
}: {
  entrada?: Entrada;
  dia?: string;
  onTerminar: () => void;
}) {
  const t = useTranslations("calendar");
  const [guardando, transicion] = useTransition();
  const [error, setError] = useState(false);

  return (
    <form
      action={(datos) =>
        transicion(async () => {
          const resultado = await guardarEvento({ estado: "inicial" }, datos);

          if (resultado.estado === "ok") onTerminar();
          else setError(true);
        })
      }
      className="space-y-3 border-t pt-3"
    >
      <input type="hidden" name="id" value={entrada?.id ?? ""} />

      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.evento")}>
          <div className="space-y-1.5">
            <Label htmlFor="ev-titulo">{t("event.title")}</Label>
            <Input
              id="ev-titulo"
              name="titulo"
              defaultValue={entrada?.titulo}
              required
              maxLength={160}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-tipo">{t("event.type")}</Label>
            <select
              id="ev-tipo"
              name="tipo"
              defaultValue={entrada?.detalle ?? "otro"}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-control border bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            >
              {TIPOS_EVENTO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {t(`eventType.${tipo}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">{t("event.description")}</Label>
            <Textarea
              id="ev-desc"
              name="descripcion"
              defaultValue={entrada?.descripcion ?? ""}
              maxLength={600}
              rows={2}
            />
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.cuandoDonde")}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-fecha">{t("event.date")}</Label>
              <Input
                id="ev-fecha"
                name="fecha"
                type="date"
                defaultValue={entrada?.dia ?? dia}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ev-inicio">{t("event.start")}</Label>
              <Input
                id="ev-inicio"
                name="hora_inicio"
                type="time"
                defaultValue={entrada?.hora?.slice(0, 5) ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ev-fin">{t("event.end")}</Label>
              <Input
                id="ev-fin"
                name="hora_fin"
                type="time"
                defaultValue={entrada?.horaFin?.slice(0, 5) ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-lugar">{t("event.place")}</Label>
            <Input
              id="ev-lugar"
              name="ubicacion"
              defaultValue={entrada?.ubicacion ?? ""}
              maxLength={160}
            />
          </div>
        </PasoFormulario>

        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs font-medium text-background"
          >
            <AlertCircle className="size-4 shrink-0" />
            {t("newEvent.error")}
          </p>
        )}

        <AccionesFormulario>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" cargando={guardando}>
              <CalendarDays className="size-3.5" />
              {guardando ? t("saving") : t("saveEvent")}
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={onTerminar}>
              {t("newEvent.cancel")}
            </Button>
          </div>
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}
