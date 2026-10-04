"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

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
import {
  eliminarExpediente,
  type DepClave,
  type EstadoEliminarExpediente,
} from "@/server/expedientes/acciones";

/**
 * Borrado del expediente, con doble confirmación.
 *
 * Un solo clic no basta para borrar seis tablas de datos de un menor de edad:
 * el primer clic solo ARMA el botón (cambia el texto al de confirmación
 * final); hace falta un segundo clic sobre ESE botón para enviar la Server
 * Action. Cerrar el diálogo o volver a abrirlo desarma otra vez.
 *
 * Antes de borrar nada, el servidor cuenta lo que otros módulos tienen sobre
 * este estudiante. Si hay algo, este mismo diálogo cambia de pantalla y avisa
 * qué hay, en vez de dejar cualquier cosa a medias.
 */

export function EliminarExpediente({
  id,
  textos,
}: {
  id: string;
  textos: {
    delete: string;
    confirmDelete: string;
    deleting: string;
    cancel: string;
    confirmTitle: string;
    deleteHint: string;
    confirmHint: string;
    inUseTitle: string;
    inUseHint: string;
    understood: string;
    error: string;
    deps: Record<DepClave, string>;
  };
}) {
  const [estado, enviar, enviando] = useActionState<
    EstadoEliminarExpediente,
    FormData
  >(eliminarExpediente, { estado: "inicial" });

  const [abierto, setAbierto] = useState(false);
  const [armado, setArmado] = useState(false);

  const enUso = estado.estado === "en_uso";
  const conError = (
    ["error", "no_permitido", "no_encontrado", "invalido"] as const
  ).includes(
    estado.estado as "error" | "no_permitido" | "no_encontrado" | "invalido",
  );

  return (
    <Dialog
      open={abierto}
      onOpenChange={(valor) => {
        setAbierto(valor);
        if (!valor) setArmado(false);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="transition-transform active:scale-[0.97]"
        >
          <Trash2 className="size-4" />
          {textos.delete}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {enUso ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 shrink-0 text-[#171A1D] dark:text-white" />
                {textos.inUseTitle}
              </DialogTitle>
              <DialogDescription>{textos.inUseHint}</DialogDescription>
            </DialogHeader>

            <ul className="space-y-1.5 text-sm">
              {estado.deps &&
                Object.entries(estado.deps).map(([clave, cantidad]) => (
                  <li
                    key={clave}
                    className="bg-muted flex items-center justify-between rounded-lg px-3 py-1.5"
                  >
                    <span>{textos.deps[clave as DepClave]}</span>
                    <span className="font-semibold">{cantidad}</span>
                  </li>
                ))}
            </ul>

            <DialogFooter>
              <Button type="button" onClick={() => setAbierto(false)}>
                {textos.understood}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form action={enviar}>
            <input type="hidden" name="id" value={id} />

            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 shrink-0 text-[#171A1D] dark:text-white" />
                {textos.confirmTitle}
              </DialogTitle>
              <DialogDescription>
                {armado ? textos.confirmHint : textos.deleteHint}
              </DialogDescription>
            </DialogHeader>

            {conError && (
              <p className="mt-2 rounded-lg bg-[#171A1D]/5 p-2.5 text-xs font-medium text-[#171A1D] dark:bg-white/5 dark:text-white">
                {textos.error}
              </p>
            )}

            <DialogFooter className="mt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAbierto(false)}
              >
                {textos.cancel}
              </Button>

              {armado ? (
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={enviando}
                  className="animate-in fade-in zoom-in-95 duration-150"
                >
                  {enviando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {enviando ? textos.deleting : textos.confirmDelete}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setArmado(true)}
                >
                  <Trash2 className="size-4" />
                  {textos.delete}
                </Button>
              )}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
