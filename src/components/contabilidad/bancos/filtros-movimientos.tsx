"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { ImpuestoCargo } from "@/lib/contabilidad/impuestos-cargos";
import { cn } from "@/lib/utils";
import type { FiltroExtracto } from "@/server/contabilidad/bancos/consultas";

/**
 * Filtros en vivo de Movimientos del estado de cuenta bancario:
 * aplican el filtro automáticamente al cambiar fecha, tipo, comisión o texto,
 * sin botón «Filtrar».
 */
export function FiltrosMovimientosBanco({
  cuentaId,
  filtro,
  cargos,
}: {
  cuentaId: string;
  filtro: FiltroExtracto;
  cargos: ImpuestoCargo[];
}) {
  const t = useTranslations("contab.libro");
  const router = useRouter();

  const [desde, setDesde] = useState(filtro.desde ?? "");
  const [hasta, setHasta] = useState(filtro.hasta ?? "");
  const [tipo, setTipo] = useState(filtro.tipo ?? "");
  const [comision, setComision] = useState(filtro.comision ?? "");
  const [q, setQ] = useState(filtro.q ?? "");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navegar = useCallback(
    (valores: {
      desde: string;
      hasta: string;
      tipo: string;
      comision: string;
      q: string;
    }) => {
      const params = new URLSearchParams();
      params.set("vista", "movimientos");
      if (valores.desde) params.set("desde", valores.desde);
      if (valores.hasta) params.set("hasta", valores.hasta);
      if (valores.tipo) params.set("tipo", valores.tipo);
      if (valores.comision) params.set("comision", valores.comision);
      if (valores.q.trim()) params.set("q", valores.q.trim());
      router.replace(`/contabilidad/bancos/${cuentaId}?${params.toString()}`, {
        scroll: false,
      });
    },
    [cuentaId, router],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const hayFiltro = Boolean(desde || hasta || tipo || comision || q.trim());
  const controlAlineado = "h-9 px-3 py-0 text-sm";
  const selectAlineado = cn(SELECT, "h-9 px-3 text-sm");

  function onCambiarCampo(
    campo: "desde" | "hasta" | "tipo" | "comision",
    valor: string,
  ) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const siguiente = { desde, hasta, tipo, comision, q, [campo]: valor };
    if (campo === "desde") setDesde(valor);
    if (campo === "hasta") setHasta(valor);
    if (campo === "tipo") setTipo(valor);
    if (campo === "comision") setComision(valor);
    navegar(siguiente);
  }

  function onCambiarBusqueda(valor: string) {
    setQ(valor);
    if (timerRef.current) clearTimeout(timerRef.current);
    const siguiente = { desde, hasta, tipo, comision, q: valor };
    timerRef.current = setTimeout(() => {
      navegar(siguiente);
    }, 250);
  }

  function limpiar() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDesde("");
    setHasta("");
    setTipo("");
    setComision("");
    setQ("");
    router.replace(`/contabilidad/bancos/${cuentaId}?vista=movimientos`, {
      scroll: false,
    });
  }

  return (
    <div className="rounded-card border border-linea bg-card p-4 shadow-card">
      <div
        className={cn(
          "grid grid-cols-1 items-end gap-3 sm:grid-cols-2 md:grid-cols-3",
          hayFiltro
            ? "lg:grid-cols-[150px_150px_150px_215px_minmax(180px,1fr)_auto]"
            : "lg:grid-cols-[150px_150px_150px_215px_minmax(180px,1fr)]",
        )}
      >
        <label className="min-w-0 space-y-1.5">
          <span className="block text-xs font-medium leading-none text-tinta-2">
            {t("desde")}
          </span>
          <Input
            type="date"
            name="desde"
            value={desde}
            onChange={(e) => onCambiarCampo("desde", e.target.value)}
            className={controlAlineado}
          />
        </label>

        <label className="min-w-0 space-y-1.5">
          <span className="block text-xs font-medium leading-none text-tinta-2">
            {t("hasta")}
          </span>
          <Input
            type="date"
            name="hasta"
            value={hasta}
            onChange={(e) => onCambiarCampo("hasta", e.target.value)}
            className={controlAlineado}
          />
        </label>

        <label className="min-w-0 space-y-1.5">
          <span className="block text-xs font-medium leading-none text-tinta-2">
            {t("tipo")}
          </span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => onCambiarCampo("tipo", e.target.value)}
            className={selectAlineado}
          >
            <option value="">{t("todos")}</option>
            <option value="retiro">{t("retiros")}</option>
            <option value="deposito">{t("depositos")}</option>
          </select>
        </label>

        <label className="min-w-0 space-y-1.5">
          <span className="block text-xs font-medium leading-none text-tinta-2">
            {t("comisiones")}
          </span>
          <select
            name="comision"
            value={comision}
            onChange={(e) => onCambiarCampo("comision", e.target.value)}
            className={selectAlineado}
          >
            <option value="">{t("todasComisiones")}</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 space-y-1.5">
          <span className="block text-xs font-medium leading-none text-tinta-2">
            {t("buscar")}
          </span>
          <Input
            type="search"
            name="q"
            value={q}
            onChange={(e) => onCambiarBusqueda(e.target.value)}
            className={controlAlineado}
          />
        </label>

        {hayFiltro && (
          <Button
            type="button"
            variant="ghost"
            onClick={limpiar}
            className="h-9 shrink-0"
          >
            <X className="size-4" />
            {t("limpiar")}
          </Button>
        )}
      </div>
    </div>
  );
}
