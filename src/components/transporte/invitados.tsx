"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Trash2, UserPlus, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { FormularioPuntual } from "@/components/transporte/formulario-puntual";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { fechaCorta } from "@/lib/fechas";
import type {
  InvitadoInscrito,
  TransporteHorario,
  TransporteParada,
} from "@/lib/transporte";
import { inscribirInvitado, quitarInvitado } from "@/server/transporte/acciones";

/**
 * Los invitados del estudiante: a quién anotó en los próximos viajes, con
 * la forma de anotar a otra persona y de quitarla si cambia el plan.
 */
export function Invitados({
  invitados,
  horarios,
  paradas,
  hoy,
}: {
  invitados: InvitadoInscrito[];
  horarios: TransporteHorario[];
  paradas: TransporteParada[];
  hoy: string;
}) {
  const t = useTranslations("transport");
  const idioma = useLocale() === "en" ? "en" : "es";
  const [quitados, setQuitados] = useState<string[]>([]);
  const [, iniciar] = useTransition();

  const visibles = invitados.filter((i) => !quitados.includes(i.id));

  const quitar = (id: string) => {
    setQuitados((q) => [...q, id]);
    iniciar(async () => {
      const res = await quitarInvitado(id);
      if (!res.ok) setQuitados((q) => q.filter((x) => x !== id));
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h3 className="texto-titulo-tarjeta flex items-center gap-2">
          <UserPlus className="size-4" />
          {t("addGuest")}
        </h3>
        <FormularioPuntual
          horarios={horarios}
          paradas={paradas}
          enviar={inscribirInvitado}
          conFecha
          hoy={hoy}
        />
      </section>

      <section className="space-y-3">
        <h3 className="texto-titulo-tarjeta flex items-center gap-2">
          <Users className="size-4" />
          {t("myGuests")}
        </h3>

        {visibles.length === 0 ? (
          <EstadoVacio icono={Users} titulo={t("noGuests")} />
        ) : (
          <ul className="divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card">
            {visibles.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-tinta">{i.nombre}</p>
                  <p className="texto-meta flex flex-wrap items-center gap-x-3">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {fechaCorta(i.fecha, idioma)}
                    </span>
                    <span>
                      {i.horario_nombre} · {i.hora_salida}
                    </span>
                    <span>
                      {i.parada_abordaje_nombre} → {i.parada_destino_nombre}
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeGuest")}
                  onClick={() => quitar(i.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
