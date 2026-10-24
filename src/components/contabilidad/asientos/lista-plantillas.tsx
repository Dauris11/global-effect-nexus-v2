import { CheckCircle2, PauseCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BotonActivar, BotonGenerar } from "@/components/contabilidad/asientos/acciones";
import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { numeroDocumento } from "@/lib/contabilidad/formato";
import { mesLargo } from "@/lib/fechas";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import type { PlantillaRecurrente } from "@/server/contabilidad/asientos/consultas";

/**
 * Plantillas en tabla (≥ md) y tarjetas (< md). Las acciones solo se pintan
 * con `contabilidad.asiento_manual`; cada server action lo vuelve a mirar.
 *
 * "Generar" se deshabilita si la plantilla está inactiva o ya se generó
 * este mes: la base lo rechazaría igual, pero un botón que siempre falla
 * no dice nada.
 */
export async function ListaPlantillas({
  plantillas,
  puedeOperar,
  idioma,
}: {
  plantillas: PlantillaRecurrente[];
  puedeOperar: boolean;
  idioma: "es" | "en";
}) {
  const t = await getTranslations("contab.asientos.plantillas");

  const ultimo = (p: PlantillaRecurrente) =>
    p.ultimo_generado ? (
      <>
        {mesLargo(p.ultimo_generado.slice(0, 7), idioma)}
        {p.ultimo_asiento_id && p.ultimo_asiento_numero && (
          <>
            {" · "}
            <Link href={`/contabilidad/asientos/${p.ultimo_asiento_id}`} className="text-marca-600 hover:underline">
              {numeroDocumento("AS", p.ultimo_asiento_numero)}
            </Link>
          </>
        )}
      </>
    ) : (
      t("nunca")
    );

  const estado = (p: PlantillaRecurrente) =>
    p.activo ? (
      <Badge className={INSIGNIA_SEMAFORO.dentro}>
        <CheckCircle2 />
        {t("activa")}
      </Badge>
    ) : (
      <Badge variant="neutra">
        <PauseCircle />
        {t("inactiva")}
      </Badge>
    );

  const acciones = (p: PlantillaRecurrente) =>
    puedeOperar && (
      <div className="flex flex-wrap items-start gap-2">
        <BotonGenerar id={p.id} deshabilitado={!p.activo || p.generado_este_mes} />
        <BotonActivar id={p.id} activo={p.activo} />
      </div>
    );

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.nombre")}</th>
              <th className="px-4 py-3 font-medium">{t("col.dia")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.total")}</th>
              <th className="px-4 py-3 font-medium">{t("col.ultimo")}</th>
              <th className="px-4 py-3 font-medium">{t("col.estado")}</th>
              {puedeOperar && <th className="px-4 py-3 font-medium">{t("col.acciones")}</th>}
            </tr>
          </thead>
          <tbody>
            {plantillas.map((p) => (
              <tr key={p.id} className="border-b border-linea align-top last:border-b-0">
                <td className="max-w-72 px-4 py-3">
                  <p className="font-medium text-tinta">{p.nombre}</p>
                  <p className="texto-meta truncate">{p.concepto}</p>
                  <p className="texto-meta">{t("lineas", { n: p.lineas })}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-tinta-2 tabular-nums">{p.dia_del_mes}</td>
                <td className="px-4 py-3 text-right font-medium">
                  <Monto valor={p.total} moneda="DOP" />
                </td>
                <td className="px-4 py-3 text-tinta-2">{ultimo(p)}</td>
                <td className="px-4 py-3">{estado(p)}</td>
                {puedeOperar && <td className="px-4 py-3">{acciones(p)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {plantillas.map((p) => (
          <li key={p.id} className={`${TARJETA.contenido} space-y-3 p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-tinta">{p.nombre}</p>
                <p className="truncate text-[15px] text-tinta-2">{p.concepto}</p>
                <p className="texto-meta">
                  {t("dia", { n: p.dia_del_mes })} · {t("lineas", { n: p.lineas })}
                </p>
              </div>
              <Monto valor={p.total} moneda="DOP" className="font-semibold" />
            </div>
            <p className="texto-meta">
              {t("col.ultimo")}: {ultimo(p)}
            </p>
            {estado(p)}
            {acciones(p)}
          </li>
        ))}
      </ul>
    </>
  );
}
