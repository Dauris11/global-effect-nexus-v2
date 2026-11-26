import { ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Filas, Seccion, Vacio } from "@/components/expedientes/detalle/ficha";
import { InsigniaCarta } from "@/components/expedientes/detalle/insignia-carta";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { fechaCorta, mesLargo } from "@/lib/fechas";
import type { ExpedienteCompleto } from "@/server/expedientes/consultas";
import type { SeguimientoExpediente } from "@/server/expedientes/seguimiento";

const Marca = ({ si }: { si: boolean }) =>
  si ? <CheckCircle2 aria-label="sí" className="text-marca-700 mx-auto size-4" /> : <XCircle aria-label="no" className="text-tinta-3 mx-auto size-4" />;

export async function TabSeguimiento({ e, seg }: { e: ExpedienteCompleto; seg: SeguimientoExpediente }) {
  const [t, idioma] = await Promise.all([getTranslations("records"), getLocale()]);
  const lang = idioma === "en" ? "en" : "es";

  return (
    <>
      <Seccion titulo={t("v2.followUp.monthly")}>
        {seg.meses.length === 0 ? (
          <p className="text-sm text-tinta-2">{t("v2.followUp.noMonths")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-tinta-3 border-b border-linea text-left text-xs">
                  <th className="py-2 font-medium">{t("v2.followUp.month")}</th>
                  <th className="w-24 py-2 text-center font-medium">{t("v2.followUp.service")}</th>
                  <th className="w-24 py-2 text-center font-medium">{t("v2.followUp.meeting")}</th>
                  <th className="w-44 py-2 text-center font-medium">{t("v2.followUp.letter")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {seg.meses.map((m) => (
                  <tr key={m.mes}>
                    <td className="py-2 capitalize">{mesLargo(m.mes, lang)}</td>
                    <td className="py-2"><Marca si={m.servicio} /></td>
                    <td className="py-2"><Marca si={m.reunion} /></td>
                    <td className="py-2 text-center"><InsigniaCarta estado={m.carta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion titulo={t("v2.followUp.notes")}>
        <Filas
          filas={[
            { etiqueta: t("field.warnings"), valor: e.amonestaciones, largo: true },
            { etiqueta: t("field.pendingRequests"), valor: e.solicitudes_pendientes, largo: true },
          ]}
        />
      </Seccion>

      <Seccion titulo={t("v2.followUp.stages")}>
        {seg.etapas.length === 0 ? (
          <p className="text-sm text-tinta-2">{t("v2.followUp.noStages")}</p>
        ) : (
          <ol className="space-y-3">
            {seg.etapas.map((et, i) => (
              <li key={`${et.cuando}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="texto-meta w-28 shrink-0">{fechaCorta(et.cuando, lang)}</span>
                <span className="flex items-center gap-1.5 text-sm">
                  {et.estado_anterior && (
                    <>
                      <Badge variant="neutra">{t(`status.${et.estado_anterior}`)}</Badge>
                      <ChevronRight className="size-3.5 text-tinta-3" />
                    </>
                  )}
                  <Badge variant="marca">{t(`status.${et.estado_nuevo}`)}</Badge>
                </span>
                {et.por && <span className="texto-meta">{t("v2.followUp.by", { name: et.por })}</span>}
              </li>
            ))}
          </ol>
        )}
      </Seccion>
    </>
  );
}

export async function TabPatrocinio({ seg }: { seg: SeguimientoExpediente }) {
  const [t, idioma] = await Promise.all([getTranslations("records"), getLocale()]);
  const lang = idioma === "en" ? "en" : "es";
  const dinero = new Intl.NumberFormat(lang === "en" ? "en-US" : "es-DO", { style: "currency", currency: "USD" });

  if (seg.asignaciones.length === 0) return <Vacio>{t("v2.sponsor.none")}</Vacio>;

  return (
    <Seccion titulo={t("v2.sponsor.title")}>
      <ul className="space-y-4">
        {seg.asignaciones.map((a) => (
          <li key={a.id} className="space-y-1 border-b border-linea pb-4 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/patrocinadores/${a.patrocinador_id}`} className="text-marca-700 hover:text-marca-600 text-[15px] font-semibold">
                {a.patrocinador}
              </Link>
              <Badge variant={a.activa ? "marca" : "neutra"}>{a.activa ? t("v2.sponsor.active") : t("v2.sponsor.ended")}</Badge>
            </div>
            <p className="texto-meta">
              {dinero.format(a.monto)} · {t("v2.sponsor.since", { date: fechaCorta(a.desde, lang) })}
              {a.hasta ? ` · ${t("v2.sponsor.until", { date: fechaCorta(a.hasta, lang) })}` : ""}
              {a.pais ? ` · ${a.pais}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
