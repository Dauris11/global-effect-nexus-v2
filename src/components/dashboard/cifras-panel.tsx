import {
  BookOpen,
  FolderKanban,
  GraduationCap,
  HandCoins,
  ListTodo,
  TrendingDown,
  TrendingUp,
  UserRoundSearch,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/stat-card";
import type { CifrasPanel as Cifras } from "@/server/dashboard/consultas";

/**
 * Las cifras del panel general, en dos filas de `StatCard`.
 *
 * Arriba la gente (a cuántos atendemos), abajo la operación (qué está en
 * marcha, qué espera y cómo va el dinero): es el orden en que se preguntan, y
 * antes la primera fila iba en blanco sobre el banner en degradado y la segunda
 * en tarjetas, así que parecían dos cosas distintas. Ahora son la misma tarjeta.
 *
 * El acento lo lleva solo "tareas pendientes", que es la cifra que se viene a
 * mirar; si todas destacan, ninguna destaca. El balance solo se recibe si el
 * rol tiene `finanzas.leer` (la página no lo consulta si no); sin él, su hueco
 * lo ocupa el reclutamiento para que la fila no quede coja.
 */
export function CifrasPanel({
  cifras,
  neto,
}: {
  cifras: Cifras;
  /** Ingresos menos egresos del mes; `null` si el rol no ve finanzas. */
  neto: number | null;
}) {
  const t = useTranslations("dashboard");

  return (
    <section className="space-y-3 md:space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatCard
          icono={GraduationCap}
          valor={cifras.universitarios}
          etiqueta={t("university")}
        />
        <StatCard icono={Wrench} valor={cifras.tecnicos} etiqueta={t("technical")} />
        <StatCard
          icono={BookOpen}
          valor={cifras.cursos}
          etiqueta={t("technicalCourses")}
          className="col-span-2 md:col-span-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          icono={FolderKanban}
          valor={cifras.proyectos}
          etiqueta={t("activeProjects")}
        />
        <StatCard
          icono={ListTodo}
          valor={cifras.tareas}
          etiqueta={t("pendingTasks")}
          acento
        />
        <StatCard
          icono={HandCoins}
          valor={cifras.patrocinadores}
          etiqueta={t("sponsors")}
        />

        {neto === null ? (
          <StatCard
            icono={UserRoundSearch}
            valor={cifras.reclutamiento}
            etiqueta={t("pipeline")}
          />
        ) : (
          // El signo escrito, no un color: es lo único que sobrevive en gris.
          <StatCard
            icono={neto >= 0 ? TrendingUp : TrendingDown}
            valor={`${neto < 0 ? "−" : ""}$${Math.abs(neto).toLocaleString()}`}
            etiqueta={t("balance")}
          />
        )}
      </div>
    </section>
  );
}
