"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  prematricular,
  retirarPrematricula,
  type EstadoPrematricula,
} from "@/server/global360/acciones";

/**
 * El botón de prematricular una materia, y el de quitarla.
 *
 * Cada uno es su propio `form` contra su Server Action, así que funciona sin
 * JavaScript. El error se muestra pegado al botón y no arriba de la pantalla:
 * con doce materias en la lista, un mensaje en la cabecera no dice a cuál se
 * refiere.
 *
 * Vive al pie de la tarjeta de la materia, así que ocupa todo su ancho y tiene
 * el alto normal (44 px): en el teléfono es el objetivo táctil de la tarjeta.
 *
 * Solo se dibuja cuando la ventana está abierta. La comprobación de verdad está
 * en el INSERT de la acción —la ventana se valida en la base, dentro de la
 * escritura— y esto es únicamente para no ofrecer un botón que va a fallar.
 */
export function AccionesMateria({
  materiaId,
  prematriculada,
}: {
  materiaId: string;
  /** Si ya la eligió, el botón ofrece quitarla en vez de añadirla. */
  prematriculada: boolean;
}) {
  const t = useTranslations("global360");
  const [estado, enviar, enviando] = useActionState<EstadoPrematricula, FormData>(
    prematriculada ? retirarPrematricula : prematricular,
    { estado: "inicial" },
  );

  return (
    <form action={enviar} className="w-full">
      <input type="hidden" name="materia" value={materiaId} />

      <Button
        type="submit"
        variant={prematriculada ? "secondary" : "default"}
        disabled={enviando}
        className="w-full"
      >
        {enviando ? (
          <Loader2 className="animate-spin" />
        ) : prematriculada ? (
          <X />
        ) : (
          <Plus />
        )}
        {enviando
          ? t("enrolling")
          : prematriculada
            ? t("withdraw")
            : t("enrol")}
      </Button>

      {estado.estado === "ok" && (
        <p className="mt-1.5 flex justify-center text-marca-700">
          <CheckCircle2 className="size-4" aria-hidden />
        </p>
      )}

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-tinta">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {estado.estado === "cerrada"
            ? t("errClosed")
            : estado.estado === "repetida"
              ? t("errRepeated")
              : estado.estado === "no_becado"
                ? t("errNotScholar")
                : estado.estado === "sin_ficha"
                  ? t("errNoRecord")
                  : t("errGeneric")}
        </p>
      )}
    </form>
  );
}
