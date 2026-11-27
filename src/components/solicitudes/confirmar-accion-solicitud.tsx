"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { MAXIMO_TEXTO, type AccionSolicitud } from "@/lib/solicitudes";
import { avanzarSolicitud } from "@/server/solicitudes/acciones";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

/** A quién se nombra en la pregunta: la persona de la solicitud, no su folio. */
export function personaDeSolicitud(solicitud: FilaSolicitud, desconocida: string) {
  return solicitud.estudiante ?? solicitud.solicitante ?? desconocida;
}

/**
 * Acciones que se resuelven en la fila, sin abrir el panel: la positiva del paso
 * (tomar, aprobar, visto bueno de dirección o completar) y rechazar. Cancelar es de
 * quien pidió y vive en el panel. Salen de `solicitud.acciones`, o sea de
 * `accionesPermitidas`: aquí no se decide quién puede qué.
 */
export function accionesEnFila(acciones: readonly AccionSolicitud[]) {
  const positiva = (["aprobar_direccion", "aprobar", "tomar", "completar"] as const).find((a) =>
    acciones.includes(a),
  );

  return {
    positiva,
    puedeRechazar: acciones.includes("rechazar"),
  };
}

/**
 * Diálogo pequeño que nombra la solicitud antes de ejecutar el paso («¿Rechazar la
 * solicitud «Carta» de Yeimy Rodríguez?»). Una pulsación suelta sobre una fila
 * densa es fácil de errar; nombrar a la persona lo frena sin pedir un formulario.
 *
 * Reutiliza `avanzarSolicitud` tal cual: el servidor vuelve a comprobar el permiso y,
 * al rechazar, exige el motivo (aquí también, para no hacer el viaje en vano).
 */
export function ConfirmarAccionSolicitud({
  solicitud,
  accion,
  alCerrar,
}: {
  solicitud: FilaSolicitud;
  accion: AccionSolicitud;
  alCerrar: () => void;
}) {
  const t = useTranslations("requests");
  const tl = useTranslations("listas");
  const tc = useTranslations("appUi");
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pregunta = tl(`solicitudes.confirm.${accion}` as never, {
    tipo: t(`type.${solicitud.tipo}` as never),
    persona: personaDeSolicitud(solicitud, t("unknownUser")),
  } as never);
  const rechaza = accion === "rechazar";

  function confirmar() {
    if (rechaza && !motivo.trim()) {
      setError(t("step.error.falta_comentario"));
      return;
    }

    const datos = new FormData();
    datos.set("id", solicitud.id);
    datos.set("accion", accion);
    if (rechaza) datos.set("comentario", motivo);

    setError(null);
    iniciar(async () => {
      const resultado = await avanzarSolicitud({ estado: "inicial" }, datos);

      if (resultado.estado === "ok") {
        alCerrar();
        router.refresh();
        return;
      }

      setError(t(`step.error.${resultado.estado}` as never));
      // Otra persona la movió: la fila ya no es la que se ve.
      if (resultado.estado === "ya_cambio") router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-section">{pregunta}</DialogTitle>
          <DialogDescription className="sr-only">{solicitud.titulo}</DialogDescription>
        </DialogHeader>

        <p className="text-meta -mt-2 truncate">{solicitud.titulo}</p>

        {rechaza && (
          <Textarea
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setError(null);
            }}
            rows={3}
            maxLength={MAXIMO_TEXTO}
            autoFocus
            aria-label={t("step.comment")}
            placeholder={t("step.commentPlaceholder")}
          />
        )}

        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs text-background">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={alCerrar} disabled={enviando}>
            {tc("panel.cancel")}
          </Button>
          <Button type="button" variant={rechaza ? "destructive" : "default"} onClick={confirmar} cargando={enviando}>
            {rechaza ? <X /> : <Check />}
            {t(`step.action.${accion}` as never)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
