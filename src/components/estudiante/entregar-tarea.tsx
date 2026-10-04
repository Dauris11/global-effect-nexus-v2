"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  entregarTarea,
  type EstadoEntrega,
} from "@/server/estudiantes/acciones-aula";

/**
 * Botón de entregar una tarea: elegir archivo y subirlo.
 *
 * El `input file` va escondido y lo dispara el botón, porque el control nativo
 * enseña el nombre del archivo y un texto en inglés del navegador que no se
 * puede traducir. El nombre elegido se muestra debajo, ya en su idioma.
 *
 * Se envía al elegir el archivo, sin un segundo clic en "subir": el paso
 * intermedio no decide nada, y con él la mitad de las entregas se quedaban a
 * medias.
 *
 * El `label` lleva el anillo de foco (`focus-within`): el foco de teclado cae en
 * el `input` escondido y, sin esto, quien navega con Tab no vería dónde está.
 * El botón es de tamaño normal (44 px) porque en el teléfono es el objetivo
 * principal de la tarjeta.
 *
 * Una tarea vencida también se puede entregar. Lo que decide si cuenta es el
 * profesor al revisarla, no el reloj; lo que queda es la fecha, que es lo que le
 * permite ver que llegó tarde.
 */
export function EntregarTarea({
  asignacionId,
  yaEntregada,
}: {
  asignacionId: string;
  /** Si ya hay entrega, el botón ofrece reemplazarla. */
  yaEntregada: boolean;
}) {
  const t = useTranslations("studentPortal");
  const [estado, enviar, enviando] = useActionState<EstadoEntrega, FormData>(
    entregarTarea,
    { estado: "inicial" },
  );
  const [nombre, setNombre] = useState<string | null>(null);

  return (
    <form action={enviar} className="flex flex-col items-end gap-1">
      <input type="hidden" name="asignacion" value={asignacionId} />

      <label className="inline-flex cursor-pointer items-center rounded-control focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <input
          type="file"
          name="archivo"
          accept="application/pdf,image/jpeg,image/png"
          className="sr-only"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0];
            setNombre(archivo?.name ?? null);
            // Enviar al elegir: el segundo clic no decide nada.
            if (archivo) evento.currentTarget.form?.requestSubmit();
          }}
        />

        <Button asChild variant={yaEntregada ? "secondary" : "default"}>
          <span>
            {enviando ? (
              <Loader2 className="animate-spin" />
            ) : estado.estado === "ok" ? (
              <Check />
            ) : (
              <Upload />
            )}
            {enviando
              ? t("classroom.uploading")
              : yaEntregada
                ? t("classroom.replace")
                : t("classroom.submit")}
          </span>
        </Button>
      </label>

      {nombre && !enviando && (
        <p className="texto-meta max-w-56 truncate">{nombre}</p>
      )}

      {estado.estado === "ok" && (
        <p className="flex max-w-64 items-start gap-1.5 text-right text-xs font-medium text-marca-700">
          <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("classroom.submitted")}
        </p>
      )}

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="flex max-w-64 items-start gap-1.5 text-right text-xs font-medium text-tinta">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {estado.estado === "tipo_invalido"
            ? t("classroom.errType")
            : estado.estado === "muy_grande"
              ? t("classroom.errSize")
              : estado.estado === "sin_archivo"
                ? t("classroom.errEmpty")
                : estado.estado === "no_es_tuya"
                  ? t("classroom.errNotYours")
                  : t("classroom.errGeneric")}
        </p>
      )}
    </form>
  );
}
