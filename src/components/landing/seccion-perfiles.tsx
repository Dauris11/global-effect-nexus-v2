"use client";

import { useEffect, useRef, useState } from "react";
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

import { MotionConfig, motion } from "motion/react";

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
 * La píldora vive DENTRO del botón activo con `layoutId`: `motion` la desliza de un
 * botón al otro. Es de lo poco que usa `motion` (lo demás es CSS), porque medir
 * anchos a mano y animar `left/width` rompería la regla de solo `transform`. Al
 * ir dentro del botón, el servidor ya la pinta bajo la pestaña activa: no hay
 * instante con texto claro sobre nada.
 *
 * Al cambiar de pestaña, las cuatro filas de la lista entran escalonadas (60 ms) y
 * la vista previa hace cross-fade: la anterior se queda encima desvaneciéndose
 * mientras la nueva aparece. Sin acciones ni subtítulos: solo el título de cada una.
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
      /** `detalle` ya no se pinta; se acepta mientras `page.tsx` lo siga pasando. */
      acciones: readonly { titulo: string; detalle?: string }[];
      vista: readonly { titulo: string; estado: string }[];
    }
  >;
};

const TIEMPO_FUNDIDO_MS = 300;

export function SeccionPerfiles({ textos }: { textos: TextosPerfiles }) {
  const [activo, setActivo] = useState<Perfil>("est");
  // Perfil que se va: se mantiene encima de la vista nueva lo que dura el fundido.
  const [saliente, setSaliente] = useState<Perfil | null>(null);
  // Hasta el primer cambio las filas no se animan: la sección ya se revela entera con `rv`.
  const [cambiado, setCambiado] = useState(false);
  const botones = useRef<Partial<Record<Perfil, HTMLButtonElement | null>>>({});
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const elegir = (perfil: Perfil) => {
    if (perfil === activo) return;

    setSaliente(activo);
    setCambiado(true);
    setActivo(perfil);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setSaliente(null), TIEMPO_FUNDIDO_MS);
  };

  // Flechas izquierda/derecha entre pestañas, como pide el patrón ARIA de tabs.
  const alTeclear = (evento: React.KeyboardEvent, indice: number) => {
    if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;

    evento.preventDefault();
    const paso = evento.key === "ArrowRight" ? 1 : -1;
    const siguiente = PERFILES[(indice + paso + PERFILES.length) % PERFILES.length];

    elegir(siguiente);
    botones.current[siguiente]?.focus();
  };

  const vistaPrevia = (perfil: Perfil, clase?: string) => {
    const datos = textos.perfiles[perfil];

    return (
      <div
        key={perfil}
        className={cn("rounded-[20px] border border-linea bg-card p-4 shadow-elevada dark:shadow-none md:p-[18px]", clase)}
      >
        <div className="mb-3.5 flex items-center gap-1.5">
          <i className="size-2.5 rounded-full bg-linea-fuerte" />
          <i className="size-2.5 rounded-full bg-linea-fuerte" />
          <i className="size-2.5 rounded-full bg-linea-fuerte" />
          <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-3">
            <Home className="size-3.5" />
            {textos.vista}
          </span>
        </div>

        {datos.vista.map((fila, i) => {
          const { estado, icono: Icono } = FILAS_VISTA[perfil][i];

          return (
            <div
              key={fila.titulo}
              className="mb-2 flex items-center gap-3 rounded-[12px] border border-linea bg-surface-2 p-3 last:mb-0"
            >
              <Icono className="size-4 shrink-0 text-tinta-2" />
              <b className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">{fila.titulo}</b>
              <StatusBadge status={estado} label={fila.estado} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    // `reducedMotion="user"`: con «reducir movimiento» la píldora salta sin deslizarse.
    <MotionConfig reducedMotion="user">
      <div className="rv">
        <div
          role="tablist"
          aria-label={textos.pestanas}
          className="relative mb-7 inline-flex max-w-full gap-1 rounded-[12px] border border-linea bg-card p-1"
        >
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
              onClick={() => elegir(perfil)}
              onKeyDown={(evento) => alTeclear(evento, indice)}
              className={cn(
                "relative isolate rounded-[9px] px-3 py-2.5 text-sm font-semibold transition-colors duration-[160ms] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-4",
                activo === perfil ? "text-primary-foreground" : "text-tinta-2 hover:text-tinta",
              )}
            >
              {activo === perfil && (
                <motion.span
                  layoutId="perfil-pastilla"
                  aria-hidden
                  className="absolute inset-0 -z-10 bg-primary"
                  style={{ borderRadius: 9 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                />
              )}
              {textos.perfiles[perfil].nombre}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            {PERFILES.map((perfil) => (
              <ol
                key={perfil}
                role="tabpanel"
                id={`perfil-panel-${perfil}`}
                aria-labelledby={`perfil-pestana-${perfil}`}
                hidden={activo !== perfil}
              >
                {textos.perfiles[perfil].acciones.map((accion, i) => (
                  <li
                    key={accion.titulo}
                    className={cn("flex items-center gap-3.5 border-b border-linea py-3.5", cambiado && "perfil-fila")}
                    style={{ "--paso": i } as React.CSSProperties}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-marca-50 text-[13px] font-bold text-marca-700">
                      {i + 1}
                    </span>
                    <b className="font-semibold text-tinta">{accion.titulo}</b>
                  </li>
                ))}
              </ol>
            ))}
          </div>

          {/* Maqueta decorativa: lo que dice ya está en la lista de al lado. */}
          <div aria-hidden className="relative">
            {vistaPrevia(activo, cambiado ? "vista-entra" : undefined)}
            {saliente && vistaPrevia(saliente, "vista-sale")}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
