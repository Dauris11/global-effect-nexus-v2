"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  guardarVisibilidad,
  type EstadoVisibilidad,
} from "@/server/visibilidad/acciones";

const INICIAL: EstadoVisibilidad = { estado: "inicial" };

type Estado = "visible" | "oculto" | "bloqueado";

const ESTADOS: { valor: Estado; icono: typeof Eye }[] = [
  { valor: "visible", icono: Eye },
  { valor: "oculto", icono: EyeOff },
  { valor: "bloqueado", icono: Lock },
];

export type ItemVisibilidad = {
  clave: string;
  /** Clave de `nav` (módulo) o texto ya resuelto (función). */
  etiqueta: string;
  /** `true` si la etiqueta es una clave de `nav`. */
  esNav: boolean;
  protegido: boolean;
  estado: Estado;
};

export type GrupoVisibilidad = {
  clave: string;
  /** Clave de `nav`. */
  etiqueta: string;
  items: ItemVisibilidad[];
};

/**
 * Qué ve un rol, módulo por módulo. Cada fila elige entre visible, oculto y
 * bloqueado; el servidor vuelve a validar todo (qué claves existen, cuáles están
 * protegidas), así que lo que aquí se manipule no le gana al servidor.
 *
 * El icono acompaña a cada estado para que la diferencia no dependa del color.
 */
export function FormularioVisibilidad({
  rol,
  nombreRol,
  grupos,
}: {
  rol: string;
  nombreRol: string;
  grupos: GrupoVisibilidad[];
}) {
  const t = useTranslations("visibilidad");
  const tNav = useTranslations("nav");
  const [resultado, accion, pendiente] = useActionState(guardarVisibilidad, INICIAL);

  const inicial = Object.fromEntries(grupos.flatMap((g) => g.items.map((i) => [i.clave, i.estado])));
  const [estados, setEstados] = useState<Record<string, Estado>>(inicial);

  const cambiar = (claves: string[], valor: Estado) =>
    setEstados((previo) => ({ ...previo, ...Object.fromEntries(claves.map((c) => [c, valor])) }));

  const editables = (g: GrupoVisibilidad) => g.items.filter((i) => !i.protegido).map((i) => i.clave);

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="rol" value={rol} />

      {grupos.map((grupo) => (
        <section key={grupo.clave} className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="texto-titulo-tarjeta">{grupo.clave === "funciones" ? t("functions") : tNav(grupo.etiqueta)}</p>

            {editables(grupo).length > 1 && (
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => cambiar(editables(grupo), "visible")}>
                  <Eye className="size-4" />
                  {t("showArea")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => cambiar(editables(grupo), "oculto")}>
                  <EyeOff className="size-4" />
                  {t("hideArea")}
                </Button>
              </div>
            )}
          </div>

          <div className="divide-linea rounded-card border-linea divide-y border">
            {grupo.items.map((item) => {
              const valor = estados[item.clave] ?? "visible";
              const nombre = item.esNav ? tNav(item.etiqueta) : item.etiqueta;

              return (
                <fieldset key={item.clave} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                  <legend className="sr-only">{nombre}</legend>
                  <span aria-hidden className="min-w-0 truncate text-[15px]">{nombre}</span>

                  {item.protegido ? (
                    <span className="texto-meta flex items-center gap-1.5">
                      <Lock className="size-3.5" />
                      {t("alwaysVisible")}
                    </span>
                  ) : (
                    <div className="bg-muted inline-flex rounded-full p-1 text-xs">
                      {ESTADOS.map(({ valor: opcion, icono: Icono }) => (
                        <label
                          key={opcion}
                          className={cn(
                            "focus-within:ring-ring flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 font-medium focus-within:ring-2",
                            valor === opcion ? "bg-background text-tinta shadow-card" : "text-tinta-2 hover:text-tinta",
                          )}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name={`v:${item.clave}`}
                            value={opcion}
                            checked={valor === opcion}
                            onChange={() => cambiar([item.clave], opcion)}
                          />
                          <Icono className="size-3.5" aria-hidden />
                          {t(`states.${opcion}`)}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("save", { rol: nombreRol })}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => cambiar(grupos.flatMap(editables), "visible")}
        >
          <Eye className="size-4" />
          {t("resetAll")}
        </Button>

        {resultado.estado === "ok" && (
          <p role="status" className="text-marca-700 flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            {t("saved", { ocultas: resultado.ocultas ?? 0, bloqueadas: resultado.bloqueadas ?? 0 })}
          </p>
        )}
        {(resultado.estado === "invalido" || resultado.estado === "error") && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-medium">
            <AlertCircle className="size-4" />
            {t("failed")}
          </p>
        )}
      </div>
    </form>
  );
}
