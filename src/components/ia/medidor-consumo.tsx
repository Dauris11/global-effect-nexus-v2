"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

/**
 * Medidor del consumo mensual de quien pregunta. Con tope muestra una barra y
 * se oscurece al pasar el umbral de aviso; sin tope solo dice cuánto lleva,
 * porque una barra sin referencia no dice nada.
 */
export type ConsumoVisible = { usados: number; tope: number | null; aviso: boolean };

export function MedidorConsumo({ consumo }: { consumo: ConsumoVisible }) {
  const t = useTranslations("widgetIA");
  const formato = new Intl.NumberFormat();
  const porcentaje =
    consumo.tope && consumo.tope > 0
      ? Math.min(100, Math.round((consumo.usados / consumo.tope) * 100))
      : null;

  return (
    <div className="border-linea border-b px-4 py-1.5">
      <div className="text-tinta-3 flex items-center justify-between text-[11px]">
        <span>{t("consumo.titulo")}</span>
        <span className={cn(consumo.aviso && "text-tinta font-semibold")}>
          {consumo.tope
            ? t("consumo.conTope", {
                usados: formato.format(consumo.usados),
                tope: formato.format(consumo.tope),
              })
            : t("consumo.sinTope", { usados: formato.format(consumo.usados) })}
        </span>
      </div>

      {porcentaje !== null && (
        <Progress value={porcentaje} tono={consumo.aviso ? "tinta" : "acento"} aria-label={t("consumo.titulo")} className="mt-1 h-1" />
      )}

      {consumo.aviso && <p className="text-tinta mt-1 text-[11px]">{t("consumo.aviso")}</p>}
    </div>
  );
}
