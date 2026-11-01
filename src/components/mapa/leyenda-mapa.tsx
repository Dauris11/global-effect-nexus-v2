import { MapPin, School } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Leyenda bajo el mapa. Las muestras copian la forma de los marcadores de
 * `marcadores.ts` (círculo lleno, círculo discontinuo, punto con halo) para
 * que la diferencia se lea también sin color.
 */
export function LeyendaMapa({
  modo,
  hayAproximados,
}: {
  modo: "seleccion" | "liceos" | "vista_vivienda";
  hayAproximados: boolean;
}) {
  const t = useTranslations("common.mapa.leyenda");

  return (
    <ul aria-label={t("titulo")} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-tinta-2">
      {modo === "liceos" ? (
        <>
          <li className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-marca-500 text-white shadow-card">
              <School className="size-3" />
            </span>
            {t("liceo")}
          </li>
          {hayAproximados && (
            <li className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full border-2 border-dashed border-marca-500 bg-card text-marca-600">
                <School className="size-3" />
              </span>
              {t("aproximado")}
            </li>
          )}
        </>
      ) : (
        <li className="flex items-center gap-1.5">
          <MapPin className="size-5 fill-marca-600 text-white" />
          {t("punto")}
        </li>
      )}
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border-2 border-white bg-marca-500 ring-4 ring-marca-500/25" />
        {t("tuUbicacion")}
      </li>
    </ul>
  );
}
