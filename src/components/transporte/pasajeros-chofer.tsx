"use client";

import { useMemo, useState } from "react";
import { MapPin, Search, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { GraficaAnillo, GraficaBarras } from "@/components/dashboard/graficas";
import { FormularioPuntual } from "@/components/transporte/formulario-puntual";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AZUL, AZUL_OSCURO } from "@/lib/paleta";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PasajeroViaje,
  TransporteHorario,
  TransporteParada,
} from "@/lib/transporte";
import { inscribirPasajeroAsistido } from "@/server/transporte/acciones";

export function PasajerosChofer({
  pasajeros,
  hoy,
  horariosDisponibles,
  paradas,
  dialogoAbierto,
  alCambiarDialogo,
  alRecargarPasajeros,
}: {
  pasajeros: PasajeroViaje[];
  hoy: string;
  horariosDisponibles: TransporteHorario[];
  paradas: TransporteParada[];
  dialogoAbierto: boolean;
  alCambiarDialogo: (abierto: boolean) => void;
  alRecargarPasajeros: () => void;
}) {
  const t = useTranslations("transport");
  const [busqueda, setBusqueda] = useState("");
  const [paradaFiltro, setParadaFiltro] = useState("todas");

  const paradasUnicas = useMemo(() => {
    const mapa = new Set<string>();
    for (const p of pasajeros) {
      if (p.parada_abordaje_nombre) mapa.add(p.parada_abordaje_nombre);
    }
    return [...mapa];
  }, [pasajeros]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pasajeros.filter((p) => {
      if (paradaFiltro !== "todas" && p.parada_abordaje_nombre !== paradaFiltro) return false;
      if (q && !p.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pasajeros, busqueda, paradaFiltro]);

  const serieParadas = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const p of pasajeros) {
      const nombre = p.parada_abordaje_nombre || "—";
      conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
    }
    return [...conteo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([nombre, valor], idx) => ({
        nombre: nombre.length > 20 ? `${nombre.slice(0, 19)}…` : nombre,
        valor,
        color: idx === 0 ? AZUL_OSCURO : AZUL,
      }));
  }, [pasajeros]);

  const recurrentesCount = pasajeros.filter((p) => p.tipo === "recurrente").length;
  const serieTipos = [
    { nombre: t("recurring"), valor: recurrentesCount, color: AZUL },
    { nombre: t("singleDay"), valor: pasajeros.length - recurrentesCount, color: AZUL_OSCURO },
  ];

  return (
    <>
      {pasajeros.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t("chartStopsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <GraficaBarras datos={serieParadas} vacio={t("chartEmpty")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t("chartTypesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid items-center gap-3 sm:grid-cols-2">
                <GraficaAnillo
                  datos={serieTipos}
                  total={pasajeros.length}
                  etiquetaTotal=""
                  vacio={t("chartEmpty")}
                />
                <ul className="divide-y divide-linea">
                  {serieTipos.map((fila) => (
                    <li key={fila.nombre} className="flex items-center gap-2 py-1.5 text-xs">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: fila.color }}
                      />
                      <span className="flex-1 text-tinta-2">{fila.nombre}</span>
                      <span className="font-semibold text-tinta tabular-nums">{fila.valor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linea pb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-tinta">
            <Users className="size-4 text-marca-500" />
            {t("expectedPassengers")}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-tinta-2">
              {t("passengerCount", { count: visibles.length })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => alCambiarDialogo(true)}
            >
              <UserPlus className="size-4" />
              {t("addPassenger")}
            </Button>
          </div>
        </div>

        {pasajeros.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-44 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-3" />
              <Input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={t("searchPassenger")}
                className="h-9 pl-8 text-xs"
              />
            </div>
            <select
              aria-label={t("allStops")}
              value={paradaFiltro}
              onChange={(e) => setParadaFiltro(e.target.value)}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-card px-2.5 text-xs shadow-xs outline-none focus-visible:ring-[3px]"
            >
              <option value="todas">{t("allStops")}</option>
              {paradasUnicas.map((parada) => (
                <option key={parada} value={parada}>
                  {parada}
                </option>
              ))}
            </select>
          </div>
        )}

        {pasajeros.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("noPassengersEnrolled")}
            className="mt-3 border-0 py-8"
            action={
              <Button type="button" variant="secondary" size="lg" onClick={() => alCambiarDialogo(true)}>
                <UserPlus aria-hidden />
                {t("addPassenger")}
              </Button>
            }
          />
        ) : visibles.length === 0 ? (
          <p className="py-6 text-center text-xs text-tinta-3">
            {t("noPassengersEnrolled")}
          </p>
        ) : (
          <ul className="divide-y divide-linea">
            {visibles.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between py-2.5 text-xs"
              >
                <div>
                  <p className="font-semibold text-tinta">{p.nombre}</p>
                  <p className="text-tinta-2">
                    <MapPin className="mr-0.5 inline size-3 text-marca-500" />
                    {p.parada_abordaje_nombre} → {p.parada_destino_nombre}
                  </p>
                </div>
                <Badge variant={p.tipo === "recurrente" ? "marca" : "neutra"}>
                  {t(p.tipo === "recurrente" ? "recurring" : "singleDay")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={dialogoAbierto} onOpenChange={alCambiarDialogo}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addPassenger")}</DialogTitle>
          </DialogHeader>
          <FormularioPuntual
            sinTarjeta
            conFecha
            hoy={hoy}
            horarios={horariosDisponibles}
            paradas={paradas}
            enviar={inscribirPasajeroAsistido}
            alTerminar={alRecargarPasajeros}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
