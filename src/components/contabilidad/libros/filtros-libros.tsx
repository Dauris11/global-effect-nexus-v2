import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CamposRango } from "@/components/contabilidad/libros/campos-rango";
import { SelectorCuenta } from "@/components/contabilidad/libros/selector-cuenta";
import { Button } from "@/components/ui/button";
import type { FiltroLibros, OpcionCuenta } from "@/server/contabilidad/libros/consultas";

/**
 * Filtros de los libros en un formulario GET: van a la URL y el enlace se
 * comparte tal cual. La vista viaja oculta para que filtrar no devuelva al
 * diario. Las casillas no marcadas no se envían, así que apagarlas basta
 * para quitarlas de la URL.
 */
export async function FiltrosLibros({
  filtro,
  cuentas,
}: {
  filtro: FiltroLibros;
  cuentas: OpcionCuenta[];
}) {
  const t = await getTranslations("contab.libros.filtros");

  return (
    <form method="get" className="space-y-3">
      <input type="hidden" name="vista" value={filtro.vista} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {filtro.vista === "mayor" && <SelectorCuenta cuentas={cuentas} valor={filtro.cuenta} />}
        {/* `key`: al navegar a otro rango, los campos controlados arrancan de la URL nueva. */}
        <CamposRango key={`${filtro.desde}-${filtro.hasta}`} desde={filtro.desde} hasta={filtro.hasta} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {filtro.vista === "balanza" && (
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
