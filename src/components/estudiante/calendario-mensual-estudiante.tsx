"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { CalendarioBase } from "@/components/ui/calendario-base";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { FilaChips } from "@/components/ui/fila-chips";
import { useRouter } from "@/i18n/navigation";
import {
  ORIGEN_VISUAL,
  type EventoCalendario,
  type OrigenCalendario,
  type VistaCalendario,
} from "@/lib/calendario";
import type { EntradaAgenda } from "@/server/estudiantes/agenda";

type OrigenFiltro = "todos" | EntradaAgenda["origen"];

/** A dónde lleva cada origen al tocarlo: la entrada no tiene página propia. */
const DESTINO: Record<EntradaAgenda["origen"], string> = {
  clase: "/portal/estudiante/prematricula",
  asignacion: "/portal/estudiante/aula-virtual",
  reunion: "/reuniones",
  evento: "/portal/estudiante",
  solicitud: "/portal/estudiante/solicitudes",
};

const FILTROS: readonly {
  id: OrigenFiltro;
  llave: string;
}[] = [
  { id: "todos", llave: "filterAll" },
  { id: "clase", llave: "filterClasses" },
  { id: "asignacion", llave: "filterTasks" },
  { id: "reunion", llave: "filterMeetings" },
  { id: "evento", llave: "filterEvents" },
  { id: "solicitud", llave: "filterRequests" },
];

/**
 * Calendario del portal del estudiante: el calendario base con la fila de
 * filtros por origen. El mes y la vista van en la URL para poder enlazarlos; el
 * servidor trae las entradas del mes que se mira.
 */
export function CalendarioMensualEstudiante({
  mes,
  vista,
  hoy,
  entradas,
}: {
  mes: string; // YYYY-MM
  vista?: VistaCalendario;
  hoy: string; // YYYY-MM-DD
  entradas: readonly EntradaAgenda[];
}) {
  const tCal = useTranslations("studentPortal.fullCalendar");
  const tBase = useTranslations("calendar");
  const router = useRouter();
  const parametros = useSearchParams();

  const [filtro, setFiltro] = useState<OrigenFiltro>("todos");

  // Una clase se repite cada semana con el mismo id: la clave lleva día, hora
  // y posición para que FullCalendar no confunda dos clases de la misma materia.
  const claves = useMemo(
    () =>
      entradas.map(
        (e, i) => `${e.origen}:${e.id}:${e.dia}:${e.hora ?? ""}:${i}`,
      ),
    [entradas],
  );

  const eventos = useMemo<EventoCalendario[]>(
    () =>
      entradas.flatMap((e, i) =>
        filtro === "todos" || e.origen === filtro
          ? [
              {
                clave: claves[i],
                origen: e.origen,
                titulo: e.titulo,
                dia: e.dia,
                hora: e.hora,
              },
            ]
          : [],
      ),
    [entradas, claves, filtro],
  );

  const origenPorClave = useMemo(
    () => new Map(entradas.map((e, i) => [claves[i], e.origen])),
    [entradas, claves],
  );

  const etiquetaOrigen = (origen: OrigenCalendario) =>
    tBase(`origin.${ORIGEN_VISUAL[origen].llave}`);

  return (
    <div className="space-y-4">
      <FilaChips etiqueta={tCal("filterAll")}>
        {FILTROS.map((f) => (
          <ChipFiltro
            key={f.id}
            icono={f.id === "todos" ? CalendarDays : ORIGEN_VISUAL[f.id].icono}
            etiqueta={tCal(f.llave)}
            activo={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          />
        ))}
      </FilaChips>

      <CalendarioBase
        className="rounded-card border border-linea bg-card p-3 shadow-card sm:p-4"
        eventos={eventos}
        hoy={hoy}
        fechaInicial={hoy.startsWith(mes) ? hoy : `${mes}-01`}
        vistaInicial={vista}
        etiquetaOrigen={etiquetaOrigen}
        onAbrir={(clave) => {
          const origen = origenPorClave.get(clave);
          if (origen) router.push(DESTINO[origen as EntradaAgenda["origen"]]);
        }}
        onCambioRango={(rango) => {
          if (rango.mes === mes && rango.vista === (vista ?? "mes")) return;

          const siguientes = new URLSearchParams(parametros);
          siguientes.set("mes", rango.mes);
          siguientes.set("vista", rango.vista);
          router.replace(`/portal/estudiante/calendario?${siguientes}`, {
            scroll: false,
          });
        }}
      />
    </div>
  );
}
