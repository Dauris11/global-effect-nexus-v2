import { ChevronRight, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ReunionActivaBanner } from "@/server/reuniones/consultas";

/**
 * Banner de llamadas en vivo (`estado = 'en_curso'`) para mostrar en cualquier
 * portal (Estudiante, Docente, Administración, etc.) con entrada directa en 1 clic.
 */
export async function BannerLlamadasActivas({
  activas,
}: {
  activas: readonly ReunionActivaBanner[];
}) {
  if (activas.length === 0) return null;

  const t = await getTranslations("reuniones.liveRoom");

  return (
    <section
      aria-label={t("activeCallsTitle")}
      className="space-y-2.5 rounded-card border border-marca-500/40 bg-marca-50 p-4"
    >
      <div className="flex items-center gap-2">
        <span className="size-2.5 animate-pulse rounded-full bg-marca-600" />
        <p className="text-xs font-semibold uppercase tracking-wide text-marca-700">
          {t("activeCallsTitle")} ({activas.length})
        </p>
      </div>

      <ul className="space-y-2">
        {activas.map((reunion) => (
          <li
            key={reunion.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-marca-500/20 bg-card px-3.5 py-2.5 shadow-xs"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600">
                <Video className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-tinta">
                    {reunion.titulo}
                  </p>
                  <Badge className="bg-marca-600 text-white text-[10px]">
                    {t("liveBadge")}
                  </Badge>
                </div>
                <p className="truncate text-xs text-tinta-3">
                  {reunion.organizador_nombre} · {reunion.hora_inicio}–{reunion.hora_fin}
                </p>
              </div>
            </div>

            <Button asChild size="sm">
              <Link href={`/reuniones?sala=${reunion.id}`}>
                {t("joinInWeb")}
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

