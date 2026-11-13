import { Layers, Search, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ICONO_TIPO } from "@/components/contabilidad/asientos/insignias";
import { SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { FilaChips } from "@/components/ui/fila-chips";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { TIPOS_ASIENTO } from "@/lib/contabilidad/asientos";
import { mesLargo } from "@/lib/fechas";
import {
  FILTRO_ANULADOS,
  FILTRO_PROCESO,
  type FiltroAsientos,
  type PeriodoContable,
} from "@/server/contabilidad/asientos/consultas";

/**
 * Tipo en chips (lo que más se cambia) y el resto en un formulario GET:
 * todo vive en la URL, se comparte por enlace y no necesita JavaScript.
 * Cada chip conserva los demás filtros; el formulario lleva el tipo oculto
 * para no perderlo al aplicar.
 */
export async function FiltrosAsientos({
  filtro,
  periodos,
  hayFiltro,
  idioma,
}: {
  filtro: FiltroAsientos;
  periodos: PeriodoContable[];
  hayFiltro: boolean;
  idioma: "es" | "en";
}) {
  const t = await getTranslations("contab.asientos");

  const conTipo = (tipo: string | null) => {
    const consulta = new URLSearchParams();
    if (filtro.periodo) consulta.set("periodo", filtro.periodo);
    if (filtro.texto) consulta.set("q", filtro.texto);
    if (filtro.anulados) consulta.set("anulados", filtro.anulados);
    if (filtro.proceso) consulta.set("proceso", filtro.proceso);
    if (tipo) consulta.set("tipo", tipo);
    const texto = consulta.toString();
    return `/contabilidad/asientos${texto ? `?${texto}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <FilaChips etiqueta={t("filtros.tipos")}>
        <ChipFiltro icono={Layers} etiqueta={t("filtros.todos")} activo={!filtro.tipo} href={conTipo(null)} />
        {TIPOS_ASIENTO.map((tipo) => (
          <ChipFiltro
            key={tipo}
            icono={ICONO_TIPO[tipo]}
            etiqueta={t(`tipo.${tipo}`)}
            activo={filtro.tipo === tipo}
            href={conTipo(tipo)}
          />
        ))}
      </FilaChips>

      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        {filtro.tipo && <input type="hidden" name="tipo" value={filtro.tipo} />}
        <Campo etiqueta={t("filtros.buscar")} className="sm:col-span-2 lg:col-span-1">
          <Input name="q" type="search" defaultValue={filtro.texto ?? ""} maxLength={80} />
        </Campo>
        <Campo etiqueta={t("filtros.periodo")}>
          <select name="periodo" defaultValue={filtro.periodo ?? ""} className={SELECT}>
            <option value="">{t("filtros.todosPeriodos")}</option>
            {periodos.map((p) => (
              <option key={p.clave} value={p.clave}>
                {p.cerrado
                  ? t("filtros.periodoCerrado", { mes: mesLargo(p.clave, idioma) })
                  : mesLargo(p.clave, idioma)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta={t("filtros.proceso")}>
          <select name="proceso" defaultValue={filtro.proceso ?? ""} className={SELECT}>
            <option value="">{t("filtros.procesoTodos")}</option>
            {FILTRO_PROCESO.map((v) => (
              <option key={v} value={v}>
                {t(`filtros.proceso_${v}`)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta={t("filtros.anulados")}>
          <select name="anulados" defaultValue={filtro.anulados ?? ""} className={SELECT}>
            <option value="">{t("filtros.anuladosTodos")}</option>
            {FILTRO_ANULADOS.map((v) => (
              <option key={v} value={v}>
                {t(`filtros.anulados_${v}`)}
              </option>
            ))}
          </select>
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">
            <Search className="size-4" />
            {t("filtros.aplicar")}
          </Button>
          {hayFiltro && (
            <Button asChild variant="ghost">
              <Link href="/contabilidad/asientos">
                <X className="size-4" />
                {t("filtros.limpiar")}
              </Link>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Campo({
  etiqueta,
  className,
  children,
}: {
  etiqueta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium text-tinta">{etiqueta}</span>
      {children}
    </label>
  );
}
