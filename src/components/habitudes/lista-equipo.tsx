import { getTranslations } from "next-intl/server";

import { StatusBadge } from "@/components/app/status-badge";
import { claveMes, fechaCorta } from "@/lib/fechas";
import type { ProfesorMonitoreoItem } from "@/lib/habitudes";

/** Profesores de Habitudes con sus liceos y las visitas del mes en curso. */
export async function ListaEquipo({ profesores, idioma }: { profesores: readonly ProfesorMonitoreoItem[]; idioma: "es" | "en" }) {
  const t = await getTranslations("habitudes.team");

  return (
    <div className="overflow-x-auto rounded-card border border-linea bg-card">
      <table className="w-full text-sm">
        <thead className="text-meta border-b border-linea text-left">
          <tr>
            <th className="px-4 py-3 font-medium">{t("teacher")}</th>
            <th className="px-4 py-3 font-medium">{t("schools")}</th>
            <th className="px-4 py-3 font-medium">{t("monthVisits", { mes: claveMes() })}</th>
            <th className="px-4 py-3 font-medium">{t("lastVisit")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {profesores.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3">
                <span className="text-body block font-medium">{p.nombre}</span>
                <span className="text-meta">{p.email}</span>
              </td>
              <td className="text-meta px-4 py-3">{p.liceosAsignados.map((l) => l.liceoNombre).join(", ") || "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={p.visitasMes > 0 ? "activa" : "pendiente"}
                  label={t("visitsCount", { n: p.visitasMes })}
                />
              </td>
              <td className="px-4 py-3 tabular-nums">{p.ultimaVisita ? fechaCorta(p.ultimaVisita, idioma) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
