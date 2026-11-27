"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  DollarSign,
  ShieldCheck,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import type { Locale } from "@/i18n/routing";
import { fechaConHora } from "@/lib/fechas";
import { montoUsd } from "@/lib/finanzas";
import { visualDeSolicitud } from "@/lib/solicitudes";
import { cn } from "@/lib/utils";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

import { DetalleSolicitud } from "./detalle-solicitud";

/**
 * Una solicitud en una tarjeta expandible. El cuerpo (línea de tiempo y botones del
 * paso siguiente) es `DetalleSolicitud`, compartido con el panel lateral de la bandeja.
 */
export function TarjetaSolicitud({
  solicitud,
  mostrarSolicitante = false,
}: {
  solicitud: FilaSolicitud;
  /** En la bandeja de quien revisa sí importa quién lo pidió. */
  mostrarSolicitante?: boolean;
}) {
  const t = useTranslations("requests");
  const locale = useLocale() as Locale;
  const [abierta, setAbierta] = useState(solicitud.acciones.length > 0);
  const { insignia, icono: Icono } = visualDeSolicitud(solicitud.estado);

  return (
    <li className="rounded-xl border border-linea/80 bg-card shadow-xs transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <button
        type="button"
        onClick={() => setAbierta((valor) => !valor)}
        aria-expanded={abierta}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-marca-500/15 text-marca-600">
          <Icono className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-semibold tabular-nums">
              #{solicitud.folio}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {t(`type.${solicitud.tipo}` as never)}
            </Badge>
            {solicitud.requiere_direccion && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <ShieldCheck className="size-3" />
                {t("needsDirection")}
              </Badge>
            )}
          </div>

          <p className="mt-1 truncate text-sm font-bold">{solicitud.titulo}</p>

          <FilaDatos className="mt-1 text-xs">
            {mostrarSolicitante && solicitud.solicitante && (
              <Dato icono={User} className="text-xs">
                {solicitud.solicitante}
              </Dato>
            )}
            {solicitud.estudiante && solicitud.estudiante !== solicitud.solicitante && (
              <span className="text-muted-foreground">
                {t("meta.student", { nombre: solicitud.estudiante })}
              </span>
            )}
            {solicitud.monto !== null && (
              <Dato icono={DollarSign} className="text-xs">
                {montoUsd(solicitud.monto)}
              </Dato>
            )}
            {solicitud.fecha_requerida && (
              <Dato icono={CalendarDays} className="text-xs">
                {fechaConHora(solicitud.fecha_requerida, solicitud.hora_preferida, locale)}
              </Dato>
            )}
          </FilaDatos>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge className={cn("text-[10px]", insignia)}>
            {t(`status.${solicitud.estado}` as never)}
          </Badge>
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 transition-transform",
              abierta && "rotate-180",
            )}
          />
        </div>
      </button>

      {abierta && (
        <DetalleSolicitud
          solicitud={solicitud}
          className="border-t border-linea px-4 pt-3 pb-4 dark:border-slate-800"
        />
      )}
    </li>
  );
}
