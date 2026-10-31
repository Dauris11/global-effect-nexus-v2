import { differenceInCalendarDays, parseISO } from "date-fns";
import { ArrowRight, CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  ListaEventos,
  type EventoListado,
} from "@/components/landing/lista-eventos";
import {
  CabeceraSeccion,
  CONTENEDOR,
  SECCION,
} from "@/components/landing/piezas";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { fechaCorta } from "@/lib/fechas";
import type { Locale } from "@/i18n/routing";
import type { EventoPublico } from "@/server/landing/consultas";

/**
 * Calendario institucional público.
 *
 * Aquí se resuelve todo lo que depende del idioma o de la fecha —etiqueta del
 * tipo, fecha formateada y el "cuándo"— y el componente cliente solo filtra.
 * Así los plurales ICU se calculan en el servidor y no viajan al navegador.
 */
export async function SeccionEventos({
  eventos,
  locale,
}: {
  eventos: readonly EventoPublico[];
  locale: Locale;
}) {
  const t = await getTranslations("landing");
  const hoy = new Date();

  const listados: EventoListado[] = eventos.map((evento) => {
    const dias = differenceInCalendarDays(parseISO(evento.fecha), hoy);

    let cuando: string;
    if (dias <= 0) cuando = t("eventsToday");
    else if (dias === 1) cuando = t("eventsTomorrow");
    else cuando = t("eventsInDays", { n: dias });

    return {
      id: evento.id,
      titulo: evento.titulo,
      descripcion: evento.descripcion,
      tipo: evento.tipo,
      // Un tipo desconocido en la base no debe romper la página: cae en "otro".
      tipoEtiqueta: TIPOS_CONOCIDOS.includes(evento.tipo)
        ? t(`eventType_${evento.tipo}`)
        : t("eventType_otro"),
      ubicacion: evento.ubicacion,
      fechaTexto: evento.hora_inicio
        ? `${fechaCorta(evento.fecha, locale)} · ${evento.hora_inicio.slice(0, 5)}`
        : fechaCorta(evento.fecha, locale),
      cuando,
    };
  });

  return (
    <section id="eventos" className={SECCION}>
      <div className={CONTENEDOR}>
        {/* Titular y CTA en la misma línea: el calendario completo vive dentro
            del sistema, así que la sección pública siempre termina en entrar. */}
        <CabeceraSeccion
          titulo={t("eventsTitle")}
          accion={
            <Button asChild variant="secondary">
              <Link href="/login">
                {t("enter")}
                <ArrowRight />
              </Link>
            </Button>
          }
        />

        {listados.length === 0 ? (
          <EstadoVacio
            icono={CalendarDays}
            titulo={t("eventsEmptyTitle")}
            className="mt-8"
          />
        ) : (
          <ListaEventos
            eventos={listados}
            textos={{
              buscar: t("eventsSearchPlaceholder"),
              todos: t("eventsFilterAll"),
              etiquetaFiltro: t("eventsFilterLabel"),
              sinResultados: t("eventsNoResults"),
              limpiar: t("eventsClear"),
              cuenta: t.raw("eventsCount") as string,
            }}
          />
        )}
      </div>
    </section>
  );
}

const TIPOS_CONOCIDOS = [
  "academico",
  "administrativo",
  "social",
  "reunion",
  "otro",
];
