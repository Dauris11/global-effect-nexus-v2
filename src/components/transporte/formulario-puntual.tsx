"use client";

import { useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransporteHorario, TransporteParada } from "@/lib/transporte";
import { inscribirPuntualDiaria } from "@/server/transporte/acciones";

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
      const res = await inscribirPuntualDiaria({
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
    <Card className="p-5">
      <div className="border-b border-linea pb-3">
        <h3 className="texto-titulo-tarjeta">{t("quickEnrollTitle")}</h3>
        <p className="texto-meta">{t("quickEnrollSubtitle")}</p>
      </div>

      {completado ? (
        <div className="py-6 text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-marca-50 text-marca-600">
            <Check className="size-6" />
          </div>
          <p className="font-bold text-sm text-tinta">{t("enrollmentSuccess")}</p>
          <p className="text-xs text-tinta-2">{t("enrollmentSuccessHint")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompletado(false)}
            className="mt-3"
          >
            {t("enrollAnother")}
          </Button>
        </div>
      ) : (
        <form onSubmit={manejarEnvio} className="mt-4 space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label>
              {t("fullNameLabel")} *
            </Label>
            <Input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
             
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("idOrPhoneLabel")}
            </Label>
            <Input
              value={matriculaOTelefono}
              onChange={(e) => setMatriculaOTelefono(e.target.value)}
              placeholder={t("idOrPhonePlaceholder")}
             
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("tripShift")} *
            </Label>
            <Select value={horarioId} onValueChange={setHorarioId}>
              <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label>
                {t("pickupStop")} *
              </Label>
              <Select
                value={paradaAbordajeId}
                onValueChange={setParadaAbordajeId}
              >
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label>
                {t("dropoffStop")} *
              </Label>
              <Select
                value={paradaDestinoId}
                onValueChange={setParadaDestinoId}
              >
                <SelectTrigger>
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
            className="w-full gap-2 font-semibold"
          >
            <Send className="size-4" />
            {t("submitQuickEnroll")}
          </Button>
        </form>
      )}
    </Card>
  );
}
