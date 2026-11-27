import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { diaEnRD } from "@/lib/fechas";
import type { AccesoRapido } from "@/lib/prioridades/rapidas";
import type { EventoAgenda } from "@/server/prioridades/inicio";

/** Columna lateral de `/inicio` de los roles sin proyectos: «Hoy en agenda» y «Crear rápido». */
export async function LateralInicio({ agenda, accesos, locale }: { agenda: EventoAgenda[]; accesos: readonly AccesoRapido[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: "priorities" });

  return (
    <aside className="space-y-8">
      <section aria-labelledby="lateral-agenda">
        <h2 id="lateral-agenda" className="text-section mb-3">{t("side.agenda")}</h2>
        {agenda.length === 0 ? (
          <p className="text-meta">{t("side.agendaEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {agenda.map((e) => (
              <li key={`${e.tipo}-${e.id}`} className="flex items-baseline gap-3">
                <span className="text-meta w-20 shrink-0 tabular-nums">
                  {e.fecha === diaEnRD() ? t("side.today") : t("side.tomorrow")}
                  {e.hora ? ` ${e.hora}` : ""}
                </span>
                <span className="text-body min-w-0 truncate">{e.titulo}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lateral-rapido">
        <h2 id="lateral-rapido" className="text-section mb-3">{t("side.quick")}</h2>
        <ul className="space-y-1">
          {accesos.map((a) => (
            <li key={a.clave}>
              <Link href={a.href} className="text-body flex min-h-11 items-center gap-3 rounded-control px-2 hover:bg-muted">
                <a.icono aria-hidden className="size-4 text-tinta-2" />
                {t(`quick.${a.clave}`)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
