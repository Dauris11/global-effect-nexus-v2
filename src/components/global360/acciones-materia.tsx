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
 * El botón de elegir una materia para la tanda abierta, y el de quitarla.
 *
 * Cada uno es su propio `form` contra su Server Action, así que funciona sin
 * JavaScript. No manda la tanda: la pone la ventana en el servidor. El error se
 * muestra pegado al botón y no arriba de la pantalla: con doce materias en la
 * lista, un mensaje en la cabecera no dice a cuál se refiere.
 *
 * Vive al pie de la tarjeta de la materia, así que ocupa todo su ancho y tiene
 * el alto normal (44 px): en el teléfono es el objetivo táctil de la tarjeta.
 *
 * Solo se dibuja cuando la ventana está abierta. La comprobación de verdad está
 * en la acción —ventana, tanda y cupo dentro de una transacción, y el índice
 * único detrás— y esto es únicamente para no ofrecer un botón que va a fallar.
 */
export function AccionesMateria({
  materiaId,
  elegida,
  sinCupo = false,
}: {
  materiaId: string;
  /** Si ya la eligió para la tanda abierta, el botón ofrece quitarla. */
  elegida: boolean;
  sinCupo?: boolean;
}) {
  const t = useTranslations("global360");
  const [estado, enviar, enviando] = useActionState<EstadoPrematricula, FormData>(
    elegida ? retirarPrematricula : prematricular,
    { estado: "inicial" },
  );

  const bloqueada = !elegida && sinCupo;

  return (
    <form action={enviar} className="w-full">
      <input type="hidden" name="materia" value={materiaId} />

      <Button
        type="submit"
        variant={elegida ? "secondary" : "default"}
        disabled={enviando || bloqueada}
        className="w-full"
      >
        {enviando ? (
          <Loader2 className="animate-spin" />
        ) : elegida ? (
          <X />
        ) : (
          <Plus />
        )}
        {enviando
          ? t("enrolling")
          : elegida
            ? t("withdraw")
            : bloqueada
              ? t("noCapacity")
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
          {t(MENSAJE_ERROR[estado.estado])}
        </p>
      )}
    </form>
  );
}

/** Un mensaje por estado: así un estado nuevo sin texto no compila. */
const MENSAJE_ERROR = {
  cerrada: "errClosed",
  repetida: "errRepeated",
  ya_aprobada: "errAlreadyPassed",
  ya_tiene_materia_en_tanda: "errTandaTaken",
  sin_cupo: "errNoCapacity",
  sin_ficha: "errNoRecord",
  invalida: "errGeneric",
  error: "errGeneric",
} as const satisfies Record<
  Exclude<EstadoPrematricula["estado"], "inicial" | "ok">,
  string
>;
