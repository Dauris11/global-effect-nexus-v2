import { getTranslations } from "next-intl/server";

import { StatusBadge } from "@/components/app/status-badge";
import { claveDia, fechaCorta } from "@/lib/fechas";
import type { HabitudesLiceo } from "@/lib/habitudes";
import { estadoDeLiceo } from "@/lib/habitudes-estado";

/** Liceos con su última visita y su estado (al día / hace un mes o más / sin visitas). */
export async function ListaLiceos({ liceos, idioma }: { liceos: readonly HabitudesLiceo[]; idioma: "es" | "en" }) {
  const t = await getTranslations("habitudes.schools");
  const hoy = claveDia();

  return (
    <div className="overflow-x-auto rounded-card border border-linea bg-card">
      <table className="w-full text-sm">
        <thead className="text-meta border-b border-linea text-left">
          <tr>
            <th className="px-4 py-3 font-medium">{t("school")}</th>
            <th className="px-4 py-3 font-medium">{t("lastVisit")}</th>
            <th className="px-4 py-3 font-medium">{t("status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {liceos.map((l) => {
            const estado = estadoDeLiceo(l.ultimaVisita ?? null, hoy);

            return (
              <tr key={l.id}>
                <td className="px-4 py-3">
                  <span className="text-body block font-medium">{l.nombre}</span>
                  <span className="text-meta">{l.municipio ?? l.distrito_educativo}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{l.ultimaVisita ? fechaCorta(l.ultimaVisita, idioma) : "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={estado} label={t(`states.${estado}`)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
