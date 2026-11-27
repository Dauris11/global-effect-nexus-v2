"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CLASES_TOKEN, ICONO_TOKEN, tokenDeEstado } from "@/lib/status-map";
import { cn } from "@/lib/utils";

export type ItemAtencion = {
  id: string;
  /** Estado de `status-map` que da el icono y su color (vencido → danger, hoy → warning…). */
  status: string;
  title: string;
  /** Una línea de contexto: de quién o de qué clase es. */
  context?: string;
  /** Fecha ISO; se enseña relativa («hoy», «mañana», «hace 2 días»). */
  date?: string;
  /** El botón que resuelve sin salir: Aprobar, Calificar, Revisar. */
  action?: { label: string } & ({ href: string } | { onClick: () => void });
};

const DIA = 86_400_000;

function relativa(iso: string, idioma: string): string {
  const hoy = new Date();
  const alDia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((alDia(new Date(iso)) - alDia(hoy)) / DIA);

  return new Intl.RelativeTimeFormat(idioma, { numeric: "auto" }).format(dias, "day");
}

/**
 * «Lo que necesita tu atención»: máximo 7 ítems ya ordenados por urgencia (vencido →
 * hoy → esta semana) y «Ver todo». Cada fila trae su botón para resolver ahí mismo.
 */
export function AttentionList({ items, max = 7, viewAllHref, className }: { items: readonly ItemAtencion[]; max?: number; viewAllHref?: string; className?: string }) {
  const t = useTranslations("appUi");
  const idioma = useLocale();
  const visibles = items.slice(0, max);

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section">{t("attention.title")}</h2>
        {viewAllHref && items.length > max && (
          <Link href={viewAllHref} className="text-label text-marca-700 hover:underline">
            {t("attention.viewAll")}
          </Link>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="text-meta rounded-card border border-linea bg-card p-4">{t("attention.empty")}</p>
      ) : (
        <ul className="divide-y divide-linea rounded-card border border-linea bg-card">
          {visibles.map((i) => {
            const token = tokenDeEstado(i.status);
            const Icono = ICONO_TOKEN[token];

            return (
              <li key={i.id} className="flex items-center gap-3 p-3.5">
                <Icono aria-hidden className={cn("size-5 shrink-0", CLASES_TOKEN[token].icono)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-tinta">{i.title}</p>
                  <p className="text-meta truncate">
                    {[i.context, i.date ? relativa(i.date, idioma) : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {i.action &&
                  ("href" in i.action ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={i.action.href}>{i.action.label}</Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={i.action.onClick}>
                      {i.action.label}
                    </Button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
