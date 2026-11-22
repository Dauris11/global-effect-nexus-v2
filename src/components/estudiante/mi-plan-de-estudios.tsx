import { CheckCircle2, CircleDashed, Info } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { AlertaAcademica } from "@/server/academico/indice";
import type { CatalogoDelEstudiante } from "@/server/universidades/consultas";

/**
 * «Mi plan de estudios»: lo mismo que ve administración de su avance, en palabras
 * sencillas y solo lectura. Cuántos créditos lleva, qué materias le faltan y, si hay
 * algo que atender, un aviso amable (nunca un color de alarma).
 */
export async function MiPlanDeEstudios({ catalogo, alertas }: { catalogo: CatalogoDelEstudiante; alertas: AlertaAcademica[] }) {
  const t = await getTranslations("studentPortal.plan");

  // Sin universidad, carrera y plan elegidos no hay nada que mostrar: no se inventa.
  if (!catalogo.pensum || catalogo.materias.length === 0) return null;

  const porEstado = (e: string) => catalogo.materias.filter((m) => m.estado === e);
  const aprobadas = porEstado("aprobada").length;
  const cursando = porEstado("cursando").length;
  const faltan = catalogo.materias.filter((m) => m.estado === "pendiente" || m.estado === "reprobada" || m.estado === "retirada");
  const proximas = [...faltan].sort((a, b) => (a.periodo_sugerido ?? 99) - (b.periodo_sugerido ?? 99) || a.codigo.localeCompare(b.codigo)).slice(0, 6);
  const avance = catalogo.creditosTotales > 0 ? Math.min(100, Math.round((catalogo.creditosAprobados / catalogo.creditosTotales) * 100)) : 0;
  const avisos = alertas.flatMap((a) =>
    a.tipo === "reprobadas"
      ? [t("failed", { count: a.materias.length, subjects: a.materias.join(", ") })]
      : a.tipo === "retiradas"
        ? [t("withdrawn", { count: a.materias.length, subjects: a.materias.join(", ") })]
        : [],
  );

  return (
    <section className="space-y-4 rounded-card border border-linea bg-card p-4 shadow-card sm:p-6" aria-labelledby="mi-plan-titulo">
      <div>
        <h2 id="mi-plan-titulo" className="texto-titulo-seccion">{t("title")}</h2>
        <p className="texto-meta">
          {[catalogo.universidad?.siglas, catalogo.carrera?.nombre].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[15px]">{t("credits", { done: catalogo.creditosAprobados, total: catalogo.creditosTotales, percent: avance })}</p>
        <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label={t("progress")}>
          <div className="h-full rounded-full bg-marca-500" style={{ width: `${avance}%` }} />
        </div>
        <p className="texto-meta">{t("counts", { done: aprobadas, current: cursando, missing: faltan.length })}</p>
      </div>

      {avisos.length > 0 && (
        <ul className="space-y-2">
          {avisos.map((a) => (
            <li key={a} className="flex items-start gap-2 rounded-control bg-marca-50 p-3 text-sm text-marca-700">
              <Info className="mt-0.5 size-4 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      )}

      {proximas.length > 0 ? (
        <div className="space-y-2">
          <h3 className="texto-titulo-tarjeta">{t("next")}</h3>
          <ul className="divide-y divide-linea rounded-control border border-linea">
            {proximas.map((m) => (
              <li key={m.codigo} className="flex items-center gap-3 p-3">
                <CircleDashed className="size-4 shrink-0 text-tinta-3" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{m.nombre}</span>
                  <span className="texto-meta">{m.codigo} · {t("creditsOf", { count: m.creditos })}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="size-4 text-marca-700" />
          {t("allDone")}
        </p>
      )}
    </section>
  );
}
