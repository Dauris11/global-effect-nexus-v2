import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { tipoDeEvento } from "@/components/estudiante/periodos";
import {
  EnlaceSeccion,
  FILA,
  ICONO_FILA,
  Seccion,
} from "@/components/estudiante/seccion";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import type { Locale } from "@/i18n/routing";
import { fechaConHora } from "@/lib/fechas";
import type { EventoProximo } from "@/server/estudiantes/portal";

/** Próximos eventos de la Fundación, los mismos que ve todo el mundo. */
export async function EventosProximos({
  eventos,
  locale,
}: {
  eventos: readonly EventoProximo[];
  locale: Locale;
}) {
  const t = await getTranslations("studentPortal");

  return (
    <Seccion
      titulo={t("eventsTitle")}
      accion={
        <EnlaceSeccion
          href="/portal/estudiante/calendario"
          texto={t("agenda.title")}
        />
      }
    >
      {eventos.length === 0 ? (
        <EstadoVacio icono={CalendarDays} titulo={t("eventsEmpty")} />
      ) : (
        <ul className="md:grid md:grid-cols-2 md:gap-x-8">
          {eventos.map((evento) => (
            <li key={evento.id} className={FILA}>
              <span className={ICONO_FILA}>
                <CalendarDays className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{evento.titulo}</p>
                <p className="truncate text-sm text-tinta-2">
                  {fechaConHora(evento.fecha, evento.hora_inicio, locale)}
                </p>
              </div>

              <Badge variant="neutra">
                {t(`agenda.eventType.${tipoDeEvento(evento.tipo)}`)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}
