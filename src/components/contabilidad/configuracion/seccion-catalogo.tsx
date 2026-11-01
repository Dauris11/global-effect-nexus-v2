"use client";

import { useMemo, useState } from "react";
import { BookOpen, CircleSlash, Pencil, Plus, Power, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Monto } from "@/components/contabilidad/comun";
import { DialogoCuenta, type ModoCuenta } from "@/components/contabilidad/configuracion/dialogo-cuenta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { CuentaCatalogo } from "@/server/contabilidad/configuracion/consultas";

type Seleccion = { modo: ModoCuenta; cuenta: CuentaCatalogo } | null;

/**
 * El catálogo como árbol: la sangría sale del nivel que calcula la base.
 * Un solo diálogo para toda la lista, no uno por fila: con setenta cuentas
 * serían doscientos diálogos montados para usar uno.
 */
export function SeccionCatalogo({
  cuentas,
  puedeEditar,
}: {
  cuentas: CuentaCatalogo[];
  puedeEditar: boolean;
}) {
  const t = useTranslations("contab.config.catalogo");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Seleccion>(null);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return cuentas;
    return cuentas.filter((c) => c.codigo.startsWith(q) || c.nombre.toLowerCase().includes(q));
  }, [busqueda, cuentas]);

  if (cuentas.length === 0) {
    return <EstadoVacio icono={BookOpen} titulo={t("vacioTitulo")} />;
  }

  const acciones = (cuenta: CuentaCatalogo) =>
    puedeEditar ? (
      <div className="flex flex-wrap justify-end gap-1">
        {cuenta.activa && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("agregarSub", { codigo: cuenta.codigo })}
            title={t("agregar")}
            onClick={() => setSeleccion({ modo: "subcuenta", cuenta })}
          >
            <Plus className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("renombrarCuenta", { codigo: cuenta.codigo })}
          title={t("renombrar")}
          onClick={() => setSeleccion({ modo: "renombrar", cuenta })}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            cuenta.activa
              ? t("desactivarCuenta", { codigo: cuenta.codigo })
              : t("activarCuenta", { codigo: cuenta.codigo })
          }
          title={cuenta.activa ? t("desactivar") : t("activar")}
          onClick={() => setSeleccion({ modo: cuenta.activa ? "desactivar" : "activar", cuenta })}
        >
          {cuenta.activa ? <CircleSlash className="size-4" /> : <Power className="size-4" />}
        </Button>
      </div>
    ) : null;

  const insignias = (cuenta: CuentaCatalogo) => (
    <>
      <Badge variant="neutra">{t(`tipo.${cuenta.tipo}`)}</Badge>
      <Badge variant={cuenta.admiteMovimiento ? "marca" : "outline"}>
        {cuenta.admiteMovimiento ? t("movimiento") : t("agrupadora")}
      </Badge>
      {!cuenta.activa && <Badge variant="solida">{t("inactiva")}</Badge>}
    </>
  );

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[15px] text-tinta-2">{t("explicacion")}</p>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-2" />
        <Input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={t("buscar")}
          aria-label={t("buscar")}
          className="pl-9"
        />
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio icono={Search} titulo={t("sinResultados")} />
      ) : (
        <>
          <div className={`${TARJETA.contenido} hidden overflow-hidden md:block`}>
            <table className="w-full text-sm">
              <thead className="texto-meta border-b border-linea text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">{t("cuenta")}</th>
                  <th className="px-5 py-3 font-medium">{t("clase")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("saldo")}</th>
                  {puedeEditar && <th className="px-5 py-3 text-right font-medium">{t("acciones")}</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.map((cuenta) => (
                  <tr key={cuenta.id} className={cn("border-b border-linea last:border-0", !cuenta.activa && "text-tinta-3")}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-baseline gap-3" style={{ paddingLeft: `${cuenta.nivel * 1.25}rem` }}>
                        <span className="shrink-0 font-mono text-xs text-tinta-2">{cuenta.codigo}</span>
                        <span className={cn(cuenta.admiteMovimiento ? "text-tinta" : "font-semibold text-tinta")}>
                          {cuenta.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap gap-1.5">{insignias(cuenta)}</div>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {cuenta.admiteMovimiento && cuenta.movimientos > 0 ? <Monto valor={cuenta.saldo} moneda="DOP" /> : null}
                    </td>
                    {puedeEditar && <td className="px-5 py-1.5">{acciones(cuenta)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {visibles.map((cuenta) => (
              <li
                key={cuenta.id}
                className={cn(`${TARJETA.contenido} space-y-2 p-4`, !cuenta.activa && "text-tinta-3")}
                style={{ marginLeft: `${Math.min(cuenta.nivel, 3) * 0.75}rem` }}
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-tinta-2">{cuenta.codigo}</p>
                  <p className={cn("text-[15px] text-tinta", !cuenta.admiteMovimiento && "font-semibold")}>
                    {cuenta.nombre}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">{insignias(cuenta)}</div>
                {cuenta.admiteMovimiento && cuenta.movimientos > 0 && (
                  <p className="texto-meta">
                    {t("saldo")}: <Monto valor={cuenta.saldo} moneda="DOP" />
                  </p>
                )}
                {acciones(cuenta)}
              </li>
            ))}
          </ul>
        </>
      )}

      {seleccion && (
        <DialogoCuenta
          key={`${seleccion.modo}-${seleccion.cuenta.id}`}
          modo={seleccion.modo}
          cuenta={seleccion.cuenta}
          alCerrar={() => setSeleccion(null)}
        />
      )}
    </div>
  );
}
