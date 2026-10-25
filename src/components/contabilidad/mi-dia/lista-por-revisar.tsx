"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, CheckCheck, Copy, Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ItemRevision } from "@/server/contabilidad/automatizacion/consultas";
import {
  aprobarEnLote,
  persistirSugerencias,
  type EstadoMiDia,
} from "@/server/contabilidad/automatizacion/acciones";
import { cn } from "@/lib/utils";

const INICIAL: EstadoMiDia = { estado: "inicial" };

/**
 * La cola de comprobantes por revisar con aprobación en lote.
 *
 * Lo aprobable se puede marcar; lo dudoso (sin RNC/NCF válido, duplicado) no
 * tiene casilla: hay que abrirlo y mirarlo. La tecla A aprueba lo marcado, para
 * quien procesa veinte seguidos sin soltar el teclado.
 */
export function ListaPorRevisar({
  items,
  aprobables,
  nivel,
  formatoMonto,
}: {
  items: ItemRevision[];
  /** Ids que el servidor considera aprobables (la pantalla no lo decide). */
  aprobables: string[];
  nivel: 0 | 1 | 2;
  /** Monto ya formateado por id, para no mandar el formateador al cliente. */
  formatoMonto: Record<string, string>;
}) {
  const t = useTranslations("miDia");
  const [estado, accion, pendiente] = useActionState(aprobarEnLote, INICIAL);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const formulario = useRef<HTMLFormElement>(null);
  const permitidos = new Set(aprobables);

  // Guarda las sugerencias de lo que está en cola ANTES de que alguien lo
  // revise: es lo que permite medir luego cuántas se aceptaron sin tocar.
  useEffect(() => {
    void persistirSugerencias().catch(() => {});
  }, []);

  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;

      if (destino && /^(INPUT|TEXTAREA|SELECT)$/.test(destino.tagName)) return;
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
      if (evento.key.toLowerCase() === "a" && marcados.size > 0 && nivel > 0) {
        formulario.current?.requestSubmit();
      }
    };

    window.addEventListener("keydown", alTeclear);

    return () => window.removeEventListener("keydown", alTeclear);
  }, [marcados.size, nivel]);

  const alternar = (id: string) =>
    setMarcados((previo) => {
      const nuevo = new Set(previo);

      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);

      return nuevo;
    });

  return (
    <form ref={formulario} action={accion} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={nivel === 0 || aprobables.length === 0}
          onClick={() => setMarcados(new Set(aprobables))}
        >
          <CheckCheck className="size-4" />
          {t("queue.selectReady")}
        </Button>

        <Button type="submit" size="sm" disabled={pendiente || marcados.size === 0 || nivel === 0}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {t("queue.approve", { n: marcados.size })}
        </Button>

        <span className="texto-meta hidden sm:inline">{t("queue.shortcut")}</span>
      </div>

      {nivel === 0 && <p className="texto-meta">{t("queue.levelZero")}</p>}

      {estado.estado === "ok" && (
        <p role="status" className="text-marca-700 flex items-center gap-1.5 text-sm font-medium">
          <CheckCircle2 className="size-4" />
          {t("queue.result.ok", { n: estado.procesados ?? 0, m: estado.omitidos ?? 0 })}
        </p>
      )}
      {estado.estado !== "ok" && estado.estado !== "inicial" && (
        <p role="alert" className="text-tinta flex items-center gap-1.5 text-sm font-medium">
          <AlertCircle className="size-4" />
          {t(`queue.result.${estado.estado}`)}
        </p>
      )}

      <ul className="divide-linea divide-y">
        {items.map((item) => {
          const puede = permitidos.has(item.id) && nivel > 0;
          const problemas = [
            ...item.problemas.map((p) => t(`queue.problems.${p}`)),
            ...(item.duplicado ? [t("queue.duplicate")] : []),
            ...(item.ncfRepetido ? [t("queue.repeatedNcf")] : []),
          ];

          return (
            <li key={item.id} className="flex gap-3 py-3">
              <input
                type="checkbox"
                name="id"
                value={item.id}
                checked={marcados.has(item.id)}
                disabled={!puede}
                onChange={() => alternar(item.id)}
                aria-label={t("queue.select", { folio: item.folio })}
                className="mt-1 size-5 shrink-0"
              />

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[15px] font-medium">
                    #{item.folio} · {item.proveedor ?? t("queue.noSupplier")}
                  </p>
                  <p className="text-[15px] font-semibold">{formatoMonto[item.id]}</p>
                </div>

                <p className="texto-meta">
                  {item.concepto}
                  {item.ncf ? ` · ${item.ncf}` : ""}
                  {item.fecha ? ` · ${item.fecha}` : ""}
                </p>

                {problemas.length > 0 && (
                  <p className="text-tinta flex items-start gap-1.5 text-sm font-medium">
                    {item.duplicado || item.ncfRepetido ? (
                      <Copy className="mt-0.5 size-4 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    )}
                    {problemas.join(" · ")}
                  </p>
                )}

                {item.sugerencia ? (
                  <p className={cn("flex items-start gap-1.5 text-sm", puede ? "text-marca-700" : "text-tinta-2")}>
                    <Sparkles className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {t("queue.suggested", {
                        categoria: item.sugerencia.categoria ?? "—",
                        centro: item.sugerenciaTexto.centro ?? "—",
                        fondo: item.sugerenciaTexto.fondo ?? "—",
                      })}
                      <span className="texto-meta block">
                        {t("queue.confidence", { pct: item.sugerencia.confianza, n: item.sugerencia.basadoEn })}
                      </span>
                    </span>
                  </p>
                ) : (
                  <p className="texto-meta">{t("queue.noSuggestion")}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
