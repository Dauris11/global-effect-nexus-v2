"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALERTA_RIESGO } from "@/lib/paleta";
import type { EstadoCatalogo } from "@/server/academico/acciones";

/**
 * Editar y eliminar una fila del catálogo académico.
 *
 * Lo comparten períodos y materias porque el gesto es el mismo y la parte
 * delicada —el borrado— tiene que comportarse igual en los dos sitios: si en
 * una pantalla se pregunta antes y en la otra no, la que no pregunta acaba
 * borrando matrícula por un clic de más.
 *
 * Son DOS pasos y no uno:
 *
 *   1. Confirmar. Un `window.confirm` habría bastado para funcionar, pero no
 *      deja decir de qué fila se habla ni se puede leer con el nombre delante.
 *   2. Si la acción responde `tiene_datos`, el mismo diálogo cambia de cara y
 *      enumera QUÉ cuelga y cuánto. No es un "no se puede": es la lista de lo
 *      que se perdería, que es la información con la que se decide si lo que
 *      toca es archivar en lugar de borrar.
 *
 * El menú de tres puntos existe para que la fila no lleve dos botones sueltos
 * de por vida: en una lista larga, el lápiz y la papelera repetidos compiten
 * con el nombre, que es lo que se viene a leer.
 */
export function AccionesFila({
  id,
  nombre,
  alEditar,
  eliminar,
  /** Texto que explica qué implica borrar esta clase de fila. */
  avisoBorrado,
  /**
   * Qué proponer cuando no se puede borrar: archivar en vez de eliminar.
   *
   * Opcional porque no toda fila tiene de qué colgar. De una calificación no
   * cuelga nada, así que su acción no puede responder `tiene_datos` y este
   * diálogo no se abre nunca; obligar a pasar un texto ahí sería obligar a
   * escribir una frase que nadie va a leer.
   */
  avisoEnUso,
}: {
  id: string;
  nombre: string;
  alEditar: () => void;
  eliminar: (
    previo: EstadoCatalogo,
    datos: FormData,
  ) => Promise<EstadoCatalogo>;
  avisoBorrado: string;
  avisoEnUso?: string;
}) {
  const t = useTranslations("academic");
  const [abierto, setAbierto] = useState(false);
  /*
   * Un borrado que sale bien cierra el diálogo; uno que responde `tiene_datos`
   * lo deja ABIERTO para enseñar por qué. Quien decide eso es la respuesta del
   * servidor, no el clic, así que el cierre va envuelto en la propia acción y
   * no en el `onClick` del botón.
   */
  const [estado, enviar, enviando] = useActionState<EstadoCatalogo, FormData>(
    async (previo, datos) => {
      const resultado = await eliminar(previo, datos);
      if (resultado.estado === "ok") setAbierto(false);
      return resultado;
    },
    { estado: "inicial" },
  );

  const enUso = estado.estado === "tiene_datos";
  const dependencias = Object.entries(estado.dependencias ?? {});

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("rowActions.menu")}
            title={t("rowActions.menu")}
            className="transition-transform duration-150 active:scale-95"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={alEditar}>
            <Pencil className="size-3.5" />
            {t("rowActions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAbierto(true)}>
            <Trash2 className="size-3.5" />
            {t("rowActions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {enUso
                ? t("rowActions.inUseTitle", { name: nombre })
                : t("rowActions.confirmTitle", { name: nombre })}
            </DialogTitle>
            <DialogDescription>
              {enUso ? (avisoEnUso ?? t("rowActions.error")) : avisoBorrado}
            </DialogDescription>
          </DialogHeader>

          {enUso && dependencias.length > 0 && (
            <ul className="space-y-1.5">
              {dependencias.map(([clave, cuantos]) => (
                <li
                  key={clave}
                  className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">
                    {t(`rowActions.deps.${clave}` as never)}
                  </span>
                  <b>{cuantos}</b>
                </li>
              ))}
            </ul>
          )}

          {estado.estado !== "inicial" && !enUso && estado.estado !== "ok" && (
            <p role="alert" className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>
                {t("rowActions.error")}
              </span>
            </p>
          )}

          <DialogFooter>
            {enUso ? (
              <Button type="button" onClick={() => setAbierto(false)}>
                {t("rowActions.understood")}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAbierto(false)}
                >
                  {t("cancel")}
                </Button>

                <form action={enviar}>
                  <input type="hidden" name="id" value={id} />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={enviando}
                  >
                    {enviando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {enviando
                      ? t("rowActions.deleting")
                      : t("rowActions.delete")}
                  </Button>
                </form>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
