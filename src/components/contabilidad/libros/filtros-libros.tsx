import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SELECT } from "@/components/contabilidad/comun";
import { CamposRango } from "@/components/contabilidad/libros/campos-rango";
import { Button } from "@/components/ui/button";
import type { FiltroLibros, OpcionMayor } from "@/server/contabilidad/libros/consultas";

/**
 * Filtros de los libros en un formulario GET: van a la URL y el enlace se
 * comparte tal cual. La vista viaja oculta para que filtrar no devuelva al
 * diario. Las casillas no marcadas no se envían, así que apagarlas basta
 * para quitarlas de la URL.
 *
 * El mayor se filtra por un rango de cuentas mayores, "desde qué cuenta
 * hasta qué cuenta" (Observaciones #1). Son `<select>` nativos para que el
 * formulario funcione sin hidratar.
 */
export async function FiltrosLibros({
  filtro,
  mayores,
}: {
  filtro: FiltroLibros;
  mayores: OpcionMayor[];
}) {
  const t = await getTranslations("contab.libros.filtros");

  return (
    <form method="get" className="space-y-3">
      <input type="hidden" name="vista" value={filtro.vista} />
      {filtro.vista === "mayor" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectorMayor nombre="cdesde" etiqueta={t("cuentaDesde")} vacio={t("primera")} valor={filtro.cuentaDesde} mayores={mayores} />
          <SelectorMayor nombre="chasta" etiqueta={t("cuentaHasta")} vacio={t("ultima")} valor={filtro.cuentaHasta} mayores={mayores} />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* `key`: al navegar a otro rango, los campos controlados arrancan de la URL nueva. */}
        <CamposRango key={`${filtro.desde}-${filtro.hasta}`} desde={filtro.desde} hasta={filtro.hasta} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {filtro.vista !== "diario" && (
          <Casilla nombre="ceros" marcada={filtro.ceros} etiqueta={t("ceros")} />
        )}
        <Button type="submit" className="ml-auto">
          <Search className="size-4" />
          {t("aplicar")}
        </Button>
      </div>
    </form>
  );
}

function SelectorMayor({
  nombre,
  etiqueta,
  vacio,
  valor,
  mayores,
}: {
  nombre: string;
  etiqueta: string;
  vacio: string;
  valor: string | null;
  mayores: OpcionMayor[];
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-tinta">{etiqueta}</span>
      <select name={nombre} defaultValue={valor ?? ""} className={SELECT}>
        <option value="">{vacio}</option>
        {mayores.map((m) => (
          <option key={m.codigo} value={m.codigo}>
            {`${m.codigo} · ${m.nombre}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function Casilla({ nombre, marcada, etiqueta }: { nombre: string; marcada: boolean; etiqueta: string }) {
  // La etiqueta entera es el objetivo táctil (44 px), no el cuadrito.
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-tinta">
      <input
        type="checkbox"
        name={nombre}
        value="1"
        defaultChecked={marcada}
        className="size-5 accent-marca-500"
      />
      {etiqueta}
    </label>
  );
}
