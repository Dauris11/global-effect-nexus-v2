"use client";

import { Check, ChevronRight, MoreHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CLASES_TOKEN, type TokenEstado } from "@/lib/status-map";
import { Link } from "@/i18n/navigation";
import type { GrupoPrioridad, ListaPrioridades, PrioridadItem } from "@/lib/prioridades/types";
import { cn } from "@/lib/utils";
import { deshacerPosponer, posponerPrioridad, resolverPrioridad, type ResultadoPrioridad } from "@/server/prioridades/acciones";

/** Segundos que se puede deshacer; la acción real se manda al servidor cuando se agotan. */
const VENTANA_DESHACER_MS = 5000;
/** Duración de la salida del ítem (docs: 160 ms). */
const SALIDA_MS = 160;

// El color sale del grupo en el que está el ítem: vencido rojo, hoy ámbar, esta semana marca.
const TOKEN_DE_GRUPO: Record<GrupoPrioridad, TokenEstado> = { vencido: "danger", hoy: "warning", semana: "info", adelante: "neutral" };
const ORDEN: GrupoPrioridad[] = ["vencido", "hoy", "semana", "adelante"];

type Pendiente = { cancelar: () => void; ejecutar: () => void };

/**
 * «Lo que te toca»: la lista ordenada por urgencia, con el botón para resolver sin salir. Al actuar,
 * el ítem se va con una animación de 160 ms y un aviso «Deshacer» de 5 s; la acción se manda al
 * servidor al terminar esa ventana (si se deshace, nunca llega). Al salir de la pantalla, lo
 * pendiente se manda enseguida: no se pierde una decisión por navegar.
 */
export function ListaDePrioridades({ lista, soloLectura = false }: { lista: ListaPrioridades; /** Dirección mirando a otra persona: sin botones que actúen. */ soloLectura?: boolean }) {
  const t = useTranslations("priorities");
  const avisar = useToast();
  const [ocultos, setOcultos] = useState<ReadonlySet<string>>(new Set());
  const [saliendo, setSaliendo] = useState<ReadonlySet<string>>(new Set());
  const [rechazando, setRechazando] = useState<string | null>(null);
  const pendientes = useRef(new Map<string, Pendiente>());

  const marcar = useCallback((setter: typeof setOcultos, id: string, activo: boolean) => {
    setter((previo) => {
      const nuevo = new Set(previo);
      if (activo) nuevo.add(id);
      else nuevo.delete(id);

      return nuevo;
    });
  }, []);

  // Al desmontar se manda lo que quedó en la ventana de «Deshacer».
  useEffect(() => {
    const mapa = pendientes.current;

    return () => mapa.forEach((p) => p.ejecutar());
  }, []);

  const lanzar = useCallback(
    (item: PrioridadItem, mensaje: string, accion: () => Promise<ResultadoPrioridad>, revertir?: () => Promise<unknown>) => {
      marcar(setSaliendo, item.id, true);
      setTimeout(() => {
        marcar(setOcultos, item.id, true);
        marcar(setSaliendo, item.id, false);
      }, SALIDA_MS);

      let hecho = false;
      const ejecutar = async () => {
        if (hecho) return;
        hecho = true;
        clearTimeout(temporizador);
        pendientes.current.delete(item.id);
        const r = await accion();

        if (!r.ok) {
          marcar(setOcultos, item.id, false);
          avisar({ titulo: t(`errors.${r.error ?? "error"}`) });
        }
      };
      const temporizador = setTimeout(ejecutar, VENTANA_DESHACER_MS);
      const cancelar = () => {
        if (hecho) return;
        hecho = true;
        clearTimeout(temporizador);
        pendientes.current.delete(item.id);
        marcar(setOcultos, item.id, false);
        marcar(setSaliendo, item.id, false);
        void revertir?.();
      };

      pendientes.current.set(item.id, { cancelar, ejecutar });
      avisar({ titulo: mensaje, duracionMs: VENTANA_DESHACER_MS, accion: { etiqueta: t("undo"), alPulsar: cancelar } });
    },
    [avisar, marcar, t],
  );

  const resolver = (item: PrioridadItem, accion: string, motivo?: string) =>
    lanzar(item, t("doneToast", { titulo: item.titulo }), () => resolverPrioridad(item.id, accion, { motivo }));
  const posponer = (item: PrioridadItem, cuando: "manana" | "semana") =>
    lanzar(item, t("postponedToast", { titulo: item.titulo }), () => posponerPrioridad(item.id, cuando), () => deshacerPosponer(item.id));

  const pintarFila = (item: PrioridadItem, grupo?: GrupoPrioridad) => (
    <Fila
      key={item.id}
      item={item}
      grupo={grupo}
      soloLectura={soloLectura}
      saliendo={saliendo.has(item.id)}
      oculto={ocultos.has(item.id)}
      rechazando={rechazando === item.id}
      onAccion={() => item.accion.action && resolver(item, item.accion.action)}
      onPedirRechazo={() => setRechazando(item.id)}
      onCancelarRechazo={() => setRechazando(null)}
      onRechazar={(motivo) => {
        setRechazando(null);
        item.accionSecundaria && resolver(item, item.accionSecundaria.action, motivo);
      }}
      onPosponer={(cuando) => posponer(item, cuando)}
    />
  );

  return (
    <div className="space-y-4">
      {ORDEN.map((g) => {
        const items = lista.grupos[g].filter((i) => !ocultos.has(i.id));
        if (items.length === 0) return null;

        return (
          <Seccion key={g} id={`prio-${g}`} abierta={g !== "adelante"} titulo={t(`groups.${g}`)} cuenta={items.length} token={TOKEN_DE_GRUPO[g]}>
            {agruparPorTipo(lista.grupos[g]).map((bloque) =>
              bloque.length >= 3 ? (
                <li key={bloque[0].tipo} className="list-none">
                  <details className="group/bloque">
                    <summary className="text-label flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 hover:bg-muted/50">
                      <ChevronRight aria-hidden className="size-4 transition-transform group-open/bloque:rotate-90" />
                      {t("row.groupOf", { n: bloque.filter((i) => !ocultos.has(i.id)).length, tipo: t(`types.${bloque[0].tipo}`) })}
                    </summary>
                    <ul className="divide-y divide-linea border-t border-linea">{bloque.map((i) => pintarFila(i, g))}</ul>
                  </details>
                </li>
              ) : (
                bloque.map((i) => pintarFila(i, g))
              ),
            )}
          </Seccion>
        );
      })}

      {lista.esperando.length > 0 && (
        <Seccion id="prio-esperando" abierta titulo={t("groups.esperando")} cuenta={lista.esperando.length} token="neutral">
          {lista.esperando.map((i) => pintarFila(i))}
        </Seccion>
      )}
    </div>
  );
}

/** Sección colapsable (`<details>`): se abre y se cierra con teclado sin una línea de estado. */
function Seccion({ id, abierta, titulo, cuenta, token, children }: { id: string; abierta: boolean; titulo: string; cuenta: number; token: TokenEstado; children: React.ReactNode }) {
  return (
    <details open={abierta} className="group/seccion" data-seccion={id}>
      <summary className="text-section mb-2 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control">
        <ChevronRight aria-hidden className="size-4 transition-transform group-open/seccion:rotate-90" />
        <span aria-hidden className={cn("size-2.5 rounded-full bg-current", CLASES_TOKEN[token].icono)} />
        {titulo}
        <span className="text-meta tabular-nums">{cuenta}</span>
      </summary>
      <ul data-list className="divide-y divide-linea rounded-card border border-linea bg-card">
        {children}
      </ul>
    </details>
  );
}

/** Los ítems del mismo tipo, juntos y en el orden de su primera aparición. */
function agruparPorTipo(items: readonly PrioridadItem[]): PrioridadItem[][] {
  const mapa = new Map<string, PrioridadItem[]>();
  for (const i of items) mapa.set(i.tipo, [...(mapa.get(i.tipo) ?? []), i]);

  return [...mapa.values()];
}

function Fila({
  item,
  grupo,
  soloLectura,
  saliendo,
  oculto,
  rechazando,
  onAccion,
  onPedirRechazo,
  onCancelarRechazo,
  onRechazar,
  onPosponer,
}: {
  item: PrioridadItem;
  grupo?: GrupoPrioridad;
  soloLectura: boolean;
  saliendo: boolean;
  oculto: boolean;
  rechazando: boolean;
  onAccion: () => void;
  onPedirRechazo: () => void;
  onCancelarRechazo: () => void;
  onRechazar: (motivo: string) => void;
  onPosponer: (cuando: "manana" | "semana") => void;
}) {
  const t = useTranslations("priorities");
  const idioma = useLocale();
  const [motivo, setMotivo] = useState("");
  const rechazable = item.accionSecundaria?.action === "solicitud:rechazar";

  if (oculto) return null;

  return (
    <li
      data-priority-item
      className={cn("grid transition-[grid-template-rows,opacity] duration-[160ms] ease-out", saliendo ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")}
    >
      <div className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
          <span
            role="img"
            aria-label={item.escalado ? t("escalated") : grupo ? t(`groups.${grupo}`) : ""}
            className={cn("size-2.5 shrink-0 rounded-full bg-current", CLASES_TOKEN[grupo ? TOKEN_DE_GRUPO[grupo] : "neutral"].icono)}
          />
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-body truncate font-semibold text-tinta">{item.titulo}</p>
            <p className="text-meta truncate">
              {item.escalado && <span className="font-semibold text-status-danger-fg">{t("escalated")} · </span>}
              {item.esperandoA ? `${item.contexto} · ${item.esperandoA}` : item.contexto}
              {item.venceEn && (
                <span className={cn("font-medium", grupo && grupo !== "adelante" && CLASES_TOKEN[TOKEN_DE_GRUPO[grupo]].pastilla.split(" ").find((c) => c.startsWith("text-")))}>
                  {" · "}
                  {relativa(item.venceEn, idioma)}
                </span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label={t("row.more")}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={item.href}>{t("row.open")}</Link>
                </DropdownMenuItem>
                {!item.esperandoA && !soloLectura && (
                  <>
                    <DropdownMenuItem onSelect={() => onPosponer("manana")}>{t("postpone.label")} · {t("postpone.tomorrow")}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onPosponer("semana")}>{t("postpone.label")} · {t("postpone.nextWeek")}</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {rechazable && !rechazando && !soloLectura && (
              <Button size="sm" variant="ghost" onClick={onPedirRechazo}>{item.accionSecundaria?.label}</Button>
            )}
            {item.accion.kind === "inline" && !soloLectura ? (
              <Button size="sm" variant="outline" onClick={onAccion}>
                <Check aria-hidden />
                {item.accion.label}
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href={item.href}>{item.accion.kind === "inline" ? t("row.open") : item.accion.label}</Link>
              </Button>
            )}
          </div>
        </div>

        {rechazando && (
          <form
            className="flex flex-wrap items-end gap-2 border-t border-linea bg-muted/40 px-3.5 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (motivo.trim()) onRechazar(motivo.trim());
            }}
          >
            <label className="text-label min-w-60 flex-1">
              {t("reject.reason")}
              <textarea
                autoFocus
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                className="text-body mt-1 w-full rounded-control border border-linea-fuerte bg-background px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </label>
            <Button type="button" size="sm" variant="ghost" onClick={onCancelarRechazo}>{t("reject.cancel")}</Button>
            <Button type="submit" size="sm" variant="destructive" disabled={!motivo.trim()}>{t("reject.confirm")}</Button>
          </form>
        )}
      </div>
    </li>
  );
}

function relativa(fecha: Date | undefined, idioma: string): string | null {
  if (!fecha) return null;
  const alDia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((alDia(new Date(fecha)) - alDia(new Date())) / 86_400_000);

  return new Intl.RelativeTimeFormat(idioma, { numeric: "auto" }).format(dias, "day");
}
