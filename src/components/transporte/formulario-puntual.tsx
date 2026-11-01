"use client";

import { useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransporteHorario, TransporteParada } from "@/lib/transporte";
import { inscribirPuntualDiariaAction } from "@/server/transporte/acciones";

export function FormularioPuntual({
  horarios,
  paradas,
}: {
  horarios: TransporteHorario[];
  paradas: TransporteParada[];
}) {
  const t = useTranslations("transport");
  const [cargando, iniciarTransicion] = useTransition();

  const [nombre, setNombre] = useState("");
  const [matriculaOTelefono, setMatriculaOTelefono] = useState("");
  const [horarioId, setHorarioId] = useState(horarios[0]?.id ?? "");
  const [paradaAbordajeId, setParadaAbordajeId] = useState(paradas[0]?.id ?? "");
  const [paradaDestinoId, setParadaDestinoId] = useState(
    paradas[paradas.length - 1]?.id ?? "",
  );

  const [completado, setCompletado] = useState(false);

  const manejarEnvio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !horarioId || !paradaAbordajeId || !paradaDestinoId) {
      return;
    }

    iniciarTransicion(async () => {
      const res = await inscribirPuntualDiariaAction({
        nombre,
        matriculaOTelefono,
        horarioId,
        paradaAbordajeId,
        paradaDestinoId,
      });

      if (res.ok) {
        setCompletado(true);
        setNombre("");
        setMatriculaOTelefono("");
      }
    });
  };

  return (
    <Card className="border-linea p-5 shadow-sm">
      <div className="border-b border-linea pb-3">
        <h3 className="text-base font-bold text-tinta">
          {t("quickEnrollTitle")}
        </h3>
        <p className="text-xs text-tinta-2">
          {t("quickEnrollSubtitle")}
        </p>
      </div>

      {completado ? (
        <div className="py-6 text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#1E9E6A]/10 text-[#1E9E6A]">
            <Check className="size-6" />
          </div>
          <p className="font-bold text-sm text-tinta">{t("enrollmentSuccess")}</p>
          <p className="text-xs text-tinta-2">{t("enrollmentSuccessHint")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompletado(false)}
            className="mt-3 text-xs"
          >
            {t("enrollAnother")}
          </Button>
        </div>
      ) : (
        <form onSubmit={manejarEnvio} className="mt-4 space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-tinta">
              {t("fullNameLabel")} *
            </label>
            <Input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-tinta">
              {t("idOrPhoneLabel")}
            </label>
            <Input
              value={matriculaOTelefono}
              onChange={(e) => setMatriculaOTelefono(e.target.value)}
              placeholder={t("idOrPhonePlaceholder")}
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-tinta">
              {t("tripShift")} *
            </label>
            <Select value={horarioId} onValueChange={setHorarioId}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {horarios.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.nombre} ({h.hora_salida})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="font-semibold text-tinta">
                {t("pickupStop")} *
              </label>
              <Select
                value={paradaAbordajeId}
                onValueChange={setParadaAbordajeId}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paradas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.orden}. {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-tinta">
                {t("dropoffStop")} *
              </label>
              <Select
                value={paradaDestinoId}
                onValueChange={setParadaDestinoId}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paradas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.orden}. {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={cargando || !nombre.trim()}
            className="w-full gap-2 font-semibold shadow-sm"
          >
            <Send className="size-4" />
            {t("submitQuickEnroll")}
          </Button>
        </form>
      )}
    </Card>
  );
}
