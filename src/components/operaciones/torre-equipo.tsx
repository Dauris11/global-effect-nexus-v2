"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Coffee,
  Flame,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Link, useRouter } from "@/i18n/navigation";
import { UMBRAL_CARGA_ALTA, type CargaPersona } from "@/lib/torre-control";

import { CLASE_SELECT } from "./torre-dialogos";

const FILTROS = ["todas", "vencidas", "sobrecarga", "libres"] as const;
type FiltroEquipo = (typeof FILTROS)[number];

const ICONO: Record<FiltroEquipo, LucideIcon> = {
  todas: Users,
  vencidas: AlertCircle,
  sobrecarga: Flame,
  libres: Coffee,
};

const ETIQUETA: Record<FiltroEquipo, "filterAll" | "filterOverdue" | "filterOverloaded" | "filterIdle"> = {
  todas: "filterAll",
  vencidas: "filterOverdue",
  sobrecarga: "filterOverloaded",
  libres: "filterIdle",
};

function pasa(p: CargaPersona, f: FiltroEquipo): boolean {
  if (f === "vencidas") return p.vencidas > 0;
  if (f === "sobrecarga") return p.abiertas >= UMBRAL_CARGA_ALTA;
  if (f === "libres") return p.abiertas === 0;
  return true;
}

/** Carga por persona: filtro, buscador y tabla (≥ md) o tarjetas (< md). */
export function TorreEquipo({ personas }: { personas: CargaPersona[] }) {
  const t = useTranslations("torre");
  const tr = useTranslations("roles");
  const [filtro, setFiltro] = useState<FiltroEquipo>("todas");
  const [texto, setTexto] = useState("");

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return personas.filter((p) => pasa(p, filtro) && (!q || p.nombre.toLowerCase().includes(q)));
  }, [personas, filtro, texto]);

  const rol = (r: string) => (tr.has(r as never) ? tr(r as never) : r);
  const enlace = (id: string) => `/administrativo/torre-control?usuario=${id}`;

  return (
    <section className="space-y-4">
      <FilaChips etiqueta={t("team.filtersLabel")}>
        {FILTROS.map((f) => (
          <ChipFiltro
            key={f}
            icono={ICONO[f]}
            etiqueta={`${t(`team.${ETIQUETA[f]}`)} · ${personas.filter((p) => pasa(p, f)).length}`}
            activo={filtro === f}
            onClick={() => setFiltro(f)}
          />
        ))}
      </FilaChips>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
        <Input
          aria-label={t("team.search")}
          placeholder={t("team.search")}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="pl-9"
        />
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio icono={Users} titulo={t("team.empty")} />
      ) : (
        <>
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-linea text-left texto-meta">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("team.person")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("team.open")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("team.overdue")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("team.week")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("team.hours")}</th>
                  <th className="px-3 py-3 font-medium">{t("team.progress")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("team.done7")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("team.projects")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {visibles.map((p) => (
                  <tr key={p.usuario_id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-tinta">{p.nombre}</p>
                      <p className="texto-meta">{rol(p.rol)}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {p.abiertas >= UMBRAL_CARGA_ALTA ? (
                        <Badge variant="solida">
                          <Flame />
                          {p.abiertas}
                        </Badge>
                      ) : (
                        p.abiertas
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {p.vencidas > 0 ? (
                        <Badge variant="solida">
                          <AlertCircle />
                          {p.vencidas}
                        </Badge>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{p.semana}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{p.horas_pendientes}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={p.progreso_medio} className="w-20" />
                        <span className="texto-meta tabular-nums">{p.progreso_medio}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{p.completadas_7d}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{p.proyectos}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={enlace(p.usuario_id)} className="inline-flex min-h-11 items-center gap-1 font-medium text-marca-600 hover:underline">
                        {t("team.openTower")}
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {visibles.map((p) => (
              <li key={p.usuario_id}>
                <Link href={enlace(p.usuario_id)} className="block rounded-card">
                  <Card className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-tinta">{p.nombre}</p>
                        <p className="texto-meta">{rol(p.rol)}</p>
                      </div>
                      <ChevronRight className="size-5 text-tinta-3" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="neutra">
                        {t("team.open")} {p.abiertas}
                      </Badge>
                      <Badge variant={p.vencidas > 0 ? "solida" : "neutra"}>
                        {p.vencidas > 0 && <AlertCircle />}
                        {t("team.overdue")} {p.vencidas}
                      </Badge>
                      <Badge variant="neutra">
                        {t("team.week")} {p.semana}
                      </Badge>
                    </div>
                    <Progress value={p.progreso_medio} />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Saltar a la torre de otra persona sin volver a la lista del equipo. */
export function SelectorPersona({
  personas,
  actual,
}: {
  personas: readonly { id: string; nombre: string }[];
  actual: string;
}) {
  const t = useTranslations("torre");
  const router = useRouter();

  return (
    <select
      aria-label={t("viewAs")}
      value={actual}
      onChange={(e) => router.push(`/administrativo/torre-control?usuario=${e.target.value}`)}
      className={`${CLASE_SELECT} sm:w-60`}
    >
      {personas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </select>
  );
}
