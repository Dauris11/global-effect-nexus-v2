"use client";

import { useState } from "react";
import { Building2, Plus, Search, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatearIdentificacion } from "@/lib/contabilidad/identificacion";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { FilaProveedor } from "@/server/contabilidad/proveedores/consultas";

export function ListaProveedores({
  proveedores,
  puedeRegistrar,
}: {
  proveedores: FilaProveedor[];
  puedeRegistrar: boolean;
}) {
  const t = useTranslations("contab.proveedores");
  const tc = useTranslations("contab");
  const [busqueda, setBusqueda] = useState("");

  const filtrados = proveedores.filter((p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    const idLimpia = p.identificacion.replace(/\D/g, "");
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.nombre_comercial && p.nombre_comercial.toLowerCase().includes(q)) ||
      idLimpia.includes(q.replace(/\D/g, ""))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-2 pointer-events-none" />
          <Input
            type="search"
            placeholder={t("buscar")}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        {puedeRegistrar && (
          <Button asChild>
            <Link href="/contabilidad/proveedores/nuevo">
              <Plus className="size-4" />
              {t("nuevo")}
            </Link>
          </Button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-tarjeta border border-linea bg-background p-8 text-center text-tinta-2">
          <p className="font-medium text-tinta">
            {busqueda ? t("vacioFiltro") : t("vacio")}
          </p>
          {!busqueda && <p className="mt-1 text-sm">{t("vacioTexto")}</p>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((p) => {
            const tieneSaldo = p.saldos.some(
              (s) => Number(s.saldo) > 0.005,
            );
            return (
              <Link
                key={p.id}
                href={`/contabilidad/proveedores/${p.id}`}
                className={cn(TARJETA.interactiva, "p-4 block")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {p.tipo === "juridica" ? (
                        <Building2 className="size-4 shrink-0 text-tinta-2" />
                      ) : (
                        <User className="size-4 shrink-0 text-tinta-2" />
                      )}
                      <h3 className="truncate font-semibold text-tinta">
                        {p.nombre}
                      </h3>
                    </div>
                    {p.nombre_comercial && (
                      <p className="truncate text-xs text-tinta-2">
                        {p.nombre_comercial}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-xs text-tinta-2">
                      {formatearIdentificacion(p.identificacion)}
                    </p>
                  </div>
                  <Badge
                    className={p.estado === "activo" ? undefined : INSIGNIA_SEMAFORO.alerta}
                    variant={p.estado === "activo" ? "neutra" : undefined}
                  >
                    {tc(`estadoProveedor.${p.estado}` as never)}
                  </Badge>
                </div>

                <div className="mt-4 border-t border-linea pt-3 text-xs text-tinta-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>{t("condiciones", { dias: p.condiciones_pago_dias })}</span>
                    <span>{t("facturas", { n: p.facturas })}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-medium text-tinta">{t("debe")}:</span>
                    {tieneSaldo ? (
                      <div className="flex flex-col items-end gap-0.5">
                        {p.saldos
                          .filter((s) => Number(s.saldo) > 0.005)
                          .map((s) => (
                            <Monto
                              key={s.moneda}
                              valor={s.saldo}
                              moneda={s.moneda}
                              className="font-semibold text-marca-700"
                            />
                          ))}
                      </div>
                    ) : (
                      <span className="text-marca-700 font-medium">{t("alDia")}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
