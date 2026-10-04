import { Search, SlidersHorizontal, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { ESTADOS_RECIBO, MONEDAS, TIPOS_RECIBO } from "@/lib/contabilidad/formato";
import type { FiltroRecibos, OpcionesRecibo } from "@/server/contabilidad/recibos/consultas";

/**
 * Los filtros de §4.3, en un formulario GET: van a la URL, se comparten
 * por enlace y la recarga no los pierde. No hace falta JavaScript.
 *
 * Los cuatro de uso diario quedan a la vista; el resto se pliega en "Más
 * filtros", que se abre solo si alguno de ellos está puesto (si no, quien
 * vuelve a la pantalla no sabría por qué la lista sale corta).
 */
export async function FiltrosRecibos({
  filtro,
  opciones,
  hayFiltro,
}: {
  filtro: FiltroRecibos;
  opciones: OpcionesRecibo;
  hayFiltro: boolean;
}) {
  const t = await getTranslations("contab.recibos");
  const tc = await getTranslations("contab");
  const masAbierto = Boolean(
    filtro.numero || filtro.proyecto || filtro.categoria || filtro.tercero || filtro.montoMin ||
      filtro.montoMax || filtro.moneda || filtro.creadoPor || filtro.aprobadoPor,
  );

  return (
    <form method="get" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Campo etiqueta={t("buscar")} className="sm:col-span-2 lg:col-span-1">
          <Input name="q" type="search" defaultValue={filtro.texto ?? ""} maxLength={80} />
        </Campo>
        <Campo etiqueta={t("desde")}>
          <Input name="desde" type="date" defaultValue={filtro.desde ?? ""} />
        </Campo>
        <Campo etiqueta={t("hasta")}>
          <Input name="hasta" type="date" defaultValue={filtro.hasta ?? ""} />
        </Campo>
        <Campo etiqueta={t("tipo")}>
          <select name="tipo" defaultValue={filtro.tipo ?? ""} className={SELECT}>
            <option value="">{t("todos")}</option>
            {TIPOS_RECIBO.map((v) => (
              <option key={v} value={v}>{tc(`tipoCorto.${v}`)}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta={t("estado")}>
          <select name="estado" defaultValue={filtro.estado ?? ""} className={SELECT}>
            <option value="">{t("todos")}</option>
            {ESTADOS_RECIBO.map((v) => (
              <option key={v} value={v}>{tc(`estado.${v}`)}</option>
            ))}
          </select>
        </Campo>
      </div>

      <details open={masAbierto} className="group">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-marca-600">
          <SlidersHorizontal className="size-4" />
          {t("masFiltros")}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta={t("numero")}>
            <Input name="numero" inputMode="numeric" defaultValue={filtro.numero ?? ""} />
          </Campo>
          <Campo etiqueta={t("cuenta")}>
            <Seleccion nombre="cuenta" valor={filtro.cuenta} todas={t("todas")} opciones={opciones.cuentas} />
          </Campo>
          <Campo etiqueta={t("proyecto")}>
            <Seleccion nombre="proyecto" valor={filtro.proyecto} todas={t("todos")} opciones={opciones.proyectos} />
          </Campo>
          <Campo etiqueta={t("categoria")}>
            <Seleccion nombre="categoria" valor={filtro.categoria} todas={t("todas")} opciones={opciones.categorias} />
          </Campo>
          <Campo etiqueta={t("tercero")}>
            <Input name="tercero" defaultValue={filtro.tercero ?? ""} maxLength={80} />
          </Campo>
          <Campo etiqueta={t("montoMin")}>
            <Input name="min" inputMode="decimal" defaultValue={filtro.montoMin ?? ""} />
          </Campo>
          <Campo etiqueta={t("montoMax")}>
            <Input name="max" inputMode="decimal" defaultValue={filtro.montoMax ?? ""} />
          </Campo>
          <Campo etiqueta={t("moneda")}>
            <select name="moneda" defaultValue={filtro.moneda ?? ""} className={SELECT}>
              <option value="">{t("todas")}</option>
              {MONEDAS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta={t("creadoPor")}>
            <Seleccion nombre="creado" valor={filtro.creadoPor} todas={t("todos")} opciones={opciones.personas} />
          </Campo>
          <Campo etiqueta={t("aprobadoPor")}>
            <Seleccion nombre="aprobado" valor={filtro.aprobadoPor} todas={t("todos")} opciones={opciones.personas} />
          </Campo>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          <Search className="size-4" />
          {t("aplicar")}
        </Button>
        {hayFiltro && (
          <Button asChild variant="ghost">
            <Link href="/contabilidad/recibos">
              <X className="size-4" />
              {t("limpiar")}
            </Link>
          </Button>
        )}
      </div>
    </form>
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
  // <label> envolvente: asocia la etiqueta sin inventar ids para cada filtro.
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium text-tinta">{etiqueta}</span>
      {children}
    </label>
  );
}

function Seleccion({
  nombre,
  valor,
  todas,
  opciones,
}: {
  nombre: string;
  valor: string | null;
  todas: string;
  opciones: { id: string; nombre: string }[];
}) {
  return (
    <select name={nombre} defaultValue={valor ?? ""} className={SELECT}>
      <option value="">{todas}</option>
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>{o.nombre}</option>
      ))}
    </select>
  );
}
