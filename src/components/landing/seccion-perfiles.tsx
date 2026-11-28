"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  FileText,
  Home,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";

/**
 * «¿Qué puedo hacer en el portal según mi perfil?»: tres pestañas, cuatro
 * acciones numeradas por perfil y una vista previa del Inicio de ese perfil.
 *
 * Los tres paneles se dibujan SIEMPRE en el HTML y el inactivo solo lleva
 * `hidden`: quien lee sin JavaScript (un buscador, un lector de pantalla con el
 * script bloqueado) ve las doce acciones y no solo las del primer perfil. La
 * pestaña solo cambia cuál se muestra.
 *
 * La píldora que se desliza se mide con el botón activo. Hasta que se mide (el
 * servidor y el primer pintado) el botón activo lleva su propio fondo, para que
 * la pestaña seleccionada nunca quede con texto claro sobre nada.
 *
 * Los estados de la vista previa pasan por `StatusBadge` con valores del mapa de
 * estados (`pendiente`, `programada`, `aprobada`, `vencida`): el color lo decide
 * el sistema, no esta pantalla. Cada fila lleva además su icono.
 */

export type Perfil = "est" | "doc" | "eq";

type FilaVista = { estado: string; icono: LucideIcon };

const PERFILES: readonly Perfil[] = ["est", "doc", "eq"];

const FILAS_VISTA: Record<Perfil, readonly FilaVista[]> = {
  est: [
    { estado: "pendiente", icono: ClipboardList },
    { estado: "programada", icono: CalendarClock },
    { estado: "aprobada", icono: FileCheck2 },
  ],
  doc: [
    { estado: "pendiente", icono: ListChecks },
    { estado: "programada", icono: CalendarCheck },
    { estado: "aprobada", icono: FileText },
  ],
  eq: [
    { estado: "vencida", icono: Users },
    { estado: "pendiente", icono: FileText },
    { estado: "programada", icono: ClipboardList },
  ],
};

export type TextosPerfiles = {
  pestanas: string;
  vista: string;
  perfiles: Record<
    Perfil,
    {
      nombre: string;
      acciones: readonly { titulo: string; detalle: string }[];
      vista: readonly { titulo: string; estado: string }[];
    }
  >;
};

export function SeccionPerfiles({ textos }: { textos: TextosPerfiles }) {
  const [activo, setActivo] = useState<Perfil>("est");
  const [pastilla, setPastilla] = useState<{ left: number; width: number } | null>(null);
  const botones = useRef<Partial<Record<Perfil, HTMLButtonElement | null>>>({});

  // Se mide antes de pintar para que la píldora no «llegue» desde la izquierda
  // la primera vez; después `transition` hace el deslizamiento.
  useLayoutEffect(() => {
    const medir = () => {
      const boton = botones.current[activo];

      if (boton) setPastilla({ left: boton.offsetLeft, width: boton.offsetWidth });
    };

    medir();
    window.addEventListener("resize", medir);

    return () => window.removeEventListener("resize", medir);
  }, [activo]);

  // Flechas izquierda/derecha entre pestañas, como pide el patrón ARIA de tabs.
  const alTeclear = (evento: React.KeyboardEvent, indice: number) => {
    if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;

    evento.preventDefault();
    const paso = evento.key === "ArrowRight" ? 1 : -1;
    const siguiente = PERFILES[(indice + paso + PERFILES.length) % PERFILES.length];

    setActivo(siguiente);
    botones.current[siguiente]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={textos.pestanas}
        className="relative mb-7 inline-flex max-w-full gap-1 rounded-[12px] border border-linea bg-card p-1"
      >
        {pastilla && (
          <span
            aria-hidden
            className="absolute top-1 bottom-1 rounded-[9px] bg-primary transition-[left,width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
            style={pastilla}
          />
        )}

        {PERFILES.map((perfil, indice) => (
          <button
            key={perfil}
            ref={(el) => {
              botones.current[perfil] = el;
            }}
            type="button"
            role="tab"
            id={`perfil-pestana-${perfil}`}
            aria-selected={activo === perfil}
            aria-controls={`perfil-panel-${perfil}`}
            tabIndex={activo === perfil ? 0 : -1}
            onClick={() => setActivo(perfil)}
            onKeyDown={(evento) => alTeclear(evento, indice)}
            className={cn(
              "relative z-[1] rounded-[9px] px-3 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-4",
              activo === perfil ? "text-primary-foreground" : "text-tinta-2 hover:text-tinta",
              // Sin la píldora medida (servidor o primer pintado) el activo se pinta solo.
              activo === perfil && !pastilla && "bg-primary",
            )}
          >
            {textos.perfiles[perfil].nombre}
          </button>
        ))}
      </div>

      {PERFILES.map((perfil) => {
        const datos = textos.perfiles[perfil];

        return (
          <div
            key={perfil}
            role="tabpanel"
            id={`perfil-panel-${perfil}`}
            aria-labelledby={`perfil-pestana-${perfil}`}
            hidden={activo !== perfil}
            className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[1fr_1.1fr]"
          >
            <ol>
              {datos.acciones.map((accion, i) => (
                <li
                  key={accion.titulo}
                  className="landing-perfil-fila flex gap-3.5 border-b border-linea py-3.5"
                  style={{ "--paso": i } as React.CSSProperties}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-marca-50 text-[13px] font-bold text-marca-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <b className="block font-semibold text-tinta">{accion.titulo}</b>
                    <small className="text-sm text-tinta-2">{accion.detalle}</small>
                  </div>
                </li>
              ))}
            </ol>

            {/* Maqueta decorativa: lo que dice ya está en la lista de al lado. */}
            <div aria-hidden className="rounded-[20px] border border-linea bg-card p-4 shadow-elevada dark:shadow-none md:p-[18px]">
              <div className="mb-3.5 flex items-center gap-1.5">
                <i className="size-2.5 rounded-full bg-linea-fuerte" />
                <i className="size-2.5 rounded-full bg-linea-fuerte" />
                <i className="size-2.5 rounded-full bg-linea-fuerte" />
                <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-3">
                  <Home className="size-3.5" />
                  {textos.vista}
                </span>
              </div>

              <div className="landing-perfil-vista">
                {datos.vista.map((fila, i) => {
                  const { estado, icono: Icono } = FILAS_VISTA[perfil][i];

                  return (
                    <div
                      key={fila.titulo}
                      className="mb-2 flex items-center gap-3 rounded-[12px] border border-linea bg-surface-2 p-3 last:mb-0"
                      style={{ "--paso": i } as React.CSSProperties}
                    >
                      <Icono className="size-4 shrink-0 text-tinta-2" />
                      <b className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">{fila.titulo}</b>
                      <StatusBadge status={estado} label={fila.estado} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
