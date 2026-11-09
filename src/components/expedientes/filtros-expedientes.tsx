import { LayoutGrid, List, Search, Users, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { FilaChips } from "@/components/ui/fila-chips";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { ESTADOS_ESTUDIANTE, visualDeEstado } from "@/lib/expedientes";
import {
  ORDENES_EXPEDIENTE,
  SITUACIONES_EXPEDIENTE,
  enlaceExpedientes,
  hayFiltros,
  type ConsultaExpedientes,
} from "@/lib/filtros-expedientes";
import { cn } from "@/lib/utils";

const CLASE_SELECT =
  "h-11 min-w-0 rounded-control border border-linea-fuerte bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Los filtros de la lista de expedientes.
 *
 * El estado va en chips (con su icono, el mismo de la ficha) porque es el
 * filtro que más se usa y se cambia de un toque; el resto —universidad,
 * situación y orden— en un formulario GET, sin JavaScript: la página es de
 * servidor y el resultado queda en la URL.
 */
export async function FiltrosExpedientes({
  consulta,
  universidades,
  rutaBusqueda,
}: {
  consulta: ConsultaExpedientes;
  universidades: string[];
  /** La acción del formulario GET, con el prefijo del idioma si lo lleva. */
  rutaBusqueda: string;
}) {
  const t = await getTranslations("records");

  return (
    <div className="space-y-4">
      <FilaChips etiqueta={t("filters.status")}>
        <ChipFiltro
          href={enlaceExpedientes(consulta, { estado: null })}
          icono={Users}
          etiqueta={t("filters.allStatuses")}
          activo={consulta.estado === null}
        />
        {ESTADOS_ESTUDIANTE.map((estado) => (
          <ChipFiltro
            key={estado}
            href={enlaceExpedientes(consulta, { estado })}
            icono={visualDeEstado(estado).icono}
            etiqueta={t(`status.${estado}`)}
            activo={consulta.estado === estado}
          />
        ))}
      </FilaChips>

      <form
        action={rutaBusqueda}
        method="get"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]"
      >
        {/* Lo que no está en este formulario se conserva como campo oculto:
            si no, aplicar la búsqueda borraría el estado elegido en los chips. */}
        {consulta.estado && <input type="hidden" name="estado" value={consulta.estado} />}
        {consulta.vista !== "tarjetas" && (
          <input type="hidden" name="vista" value={consulta.vista} />
        )}

        <Input
          name="q"
          defaultValue={consulta.busqueda ?? ""}
          placeholder={t("filters.searchPlaceholder")}
          aria-label={t("filters.search")}
          className="sm:col-span-2 lg:col-span-1"
        />

        <select
          name="universidad"
          defaultValue={consulta.universidad ?? ""}
          aria-label={t("filters.university")}
          className={CLASE_SELECT}
        >
          <option value="">{t("filters.allUniversities")}</option>
          {universidades.map((universidad) => (
            <option key={universidad} value={universidad}>
              {universidad}
            </option>
          ))}
        </select>

        <select
          name="situacion"
          defaultValue={consulta.situacion ?? ""}
          aria-label={t("filters.situation")}
          className={CLASE_SELECT}
        >
          <option value="">{t("filters.anySituation")}</option>
          {SITUACIONES_EXPEDIENTE.map((situacion) => (
            <option key={situacion} value={situacion}>
              {t(`filters.situations.${situacion}`)}
            </option>
          ))}
        </select>

        <select
          name="orden"
          defaultValue={consulta.orden}
          aria-label={t("filters.order")}
          className={CLASE_SELECT}
        >
          {ORDENES_EXPEDIENTE.map((orden) => (
            <option key={orden} value={orden}>
              {t(`filters.orders.${orden}`)}
            </option>
          ))}
        </select>

        <Button type="submit" variant="secondary">
          <Search className="size-4" />
          {t("filters.apply")}
        </Button>
      </form>

      {hayFiltros(consulta) && (
        <Link
          href={enlaceExpedientes(consulta, {
            busqueda: null,
            estado: null,
            universidad: null,
            situacion: null,
          })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-marca-600 underline-offset-2 hover:underline"
        >
          <X className="size-4" />
          {t("filters.clear")}
        </Link>
      )}
    </div>
  );
}

/** Tarjetas o lista: dos píldoras dentro de un mismo borde. */
export async function SelectorVista({ consulta }: { consulta: ConsultaExpedientes }) {
  const t = await getTranslations("records");
  const opciones = [
    { vista: "tarjetas", icono: LayoutGrid, texto: t("views.cards") },
    { vista: "lista", icono: List, texto: t("views.list") },
  ] as const;

  return (
    <div className="inline-flex rounded-full border border-linea p-1">
      {opciones.map(({ vista, icono: Icono, texto }) => {
        const activa = consulta.vista === vista;

        return (
          <Link
            key={vista}
            href={enlaceExpedientes(consulta, { vista, pagina: consulta.pagina })}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activa ? "bg-tinta text-background" : "text-tinta-2 hover:text-tinta",
            )}
          >
            <Icono className="size-4" />
            {texto}
          </Link>
        );
      })}
    </div>
  );
}
