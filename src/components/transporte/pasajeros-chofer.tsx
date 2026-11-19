"use client";

import { MapPin, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormularioPuntual } from "@/components/transporte/formulario-puntual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-linea pb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-tinta">
            <Users className="size-4 text-marca-500" />
            {t("expectedPassengers")}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-tinta-2">
              {t("passengerCount", { count: pasajeros.length })}
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

        {pasajeros.length === 0 ? (
          <p className="py-6 text-center text-xs text-tinta-3">
            {t("noPassengersEnrolled")}
          </p>
        ) : (
          <ul className="divide-y divide-linea">
            {pasajeros.map((p) => (
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
            <DialogDescription className="sr-only">
              {t("addPassenger")}
            </DialogDescription>
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
