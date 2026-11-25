"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";

import { CalendarioBase } from "@/components/ui/calendario-base";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ORIGEN_VISUAL,
  type EventoCalendario,
  type OrigenCalendario,
} from "@/lib/calendario";

/** Una cosa con fecha del resumen de inicio, con el enlace a donde lleva. */
export type EntradaCompacta = {
  id: string;
  origen: OrigenCalendario;
  titulo: string;
  /** `YYYY-MM-DD`. */
  dia: string;
  hora: string | null;
  href: string;
};

/**
 * Calendario de los resúmenes de inicio (estudiante y docente): el mismo
 * calendario base en modo compacto —solo mes, sin selector de vista— dentro de
 * su tarjeta, con el enlace al calendario completo.
 *
 * Aquí tocar una entrada no abre un diálogo sino que lleva a donde vive
 * (la tarea, la reunión…), que es lo que hacía el panel de día anterior.
 */
export function CalendarioCompacto({
  titulo,
  entradas,
  hoy,
  enlaceCompleto,
  className,
}: {
  titulo: ReactNode;
  entradas: readonly EntradaCompacta[];
  hoy: string;
  enlaceCompleto: { href: string; etiqueta: string };
  className?: string;
}) {
  const t = useTranslations("calendar");
  const router = useRouter();

  const eventos = useMemo<EventoCalendario[]>(
    () =>
      entradas.map((e) => ({
        clave: e.id,
        origen: e.origen,
        titulo: e.titulo,
        dia: e.dia,
        hora: e.hora,
      })),
    [entradas],
  );

  const porClave = useMemo(
    () => new Map(entradas.map((e) => [e.id, e])),
    [entradas],
  );

  return (
    <Card className={className}>
      <CardContent className="space-y-3 pt-5">
        <CardTitle>
          <CalendarDays className="size-4 text-marca-600" />
          {titulo}
        </CardTitle>

        <CalendarioBase
          compacto
          eventos={eventos}
          hoy={hoy}
          fechaInicial={hoy}
          etiquetaOrigen={(origen) => t(`origin.${ORIGEN_VISUAL[origen].llave}`)}
          onAbrir={(clave) => {
            const entrada = porClave.get(clave);
            if (entrada) router.push(entrada.href);
          }}
        />

        <div className="flex justify-end border-t border-linea pt-3">
          <Link
            href={enlaceCompleto.href}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-marca-600 hover:underline"
          >
            {enlaceCompleto.etiqueta}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
