"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearPromesaDonacion } from "@/server/contabilidad/donaciones/acciones";

export function DialogoPromesa({
  donantes,
  fondos,
}: {
  donantes: { id: string; nombre: string; identificacion: string }[];
  fondos: { id: string; nombre: string }[];
}) {
  const t = useTranslations("contab.donaciones");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [terceroId, setTerceroId] = useState(donantes[0]?.id ?? "");
  const [montoTotal, setMontoTotal] = useState("");
  const [moneda, setMoneda] = useState<"DOP" | "USD">("DOP");
  const [frecuencia, setFrecuencia] = useState<"unica" | "mensual" | "trimestral" | "semestral" | "anual">("mensual");
  const [cuotasCantidad, setCuotasCantidad] = useState("12");
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fondoId, setFondoId] = useState(fondos[0]?.id ?? "");
  const [notas, setNotas] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await crearPromesaDonacion({
      terceroId,
      montoTotal: Number(montoTotal),
      moneda,
      frecuencia,
      cuotasCantidad: Number(cuotasCantidad),
      fechaInicio,
      fondoId,
      notas: notas || undefined,
    });

    setCargando(false);

    if (!res.ok) {
      setError(res.error || t("errorGuardar"));
      return;
    }

    setAbierto(false);
    setMontoTotal("");
    setNotas("");
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarClock className="mr-2 size-4" />
          {t("nuevaPromesa")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("registrarPromesaCompromiso")}</DialogTitle>
            <DialogDescription>{t("descripcionPromesa")}</DialogDescription>
          </DialogHeader>

          {error && <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm font-medium text-tinta">{error}</div>}

          <div className="space-y-1.5">
            <Label>{t("donante")}</Label>
            <Select value={terceroId} onValueChange={setTerceroId}>
              <SelectTrigger>
                <SelectValue placeholder={t("seleccioneDonante")} />
              </SelectTrigger>
              <SelectContent>
                {donantes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nombre} ({d.identificacion})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("montoTotalCompromiso")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("moneda")}</Label>
              <Select value={moneda} onValueChange={(v: "DOP" | "USD") => setMoneda(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOP">DOP (RD$)</SelectItem>
                  <SelectItem value="USD">USD (US$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("frecuenciaCobro")}</Label>
              <Select value={frecuencia} onValueChange={(v: "unica" | "mensual" | "trimestral" | "semestral" | "anual") => setFrecuencia(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">{t("mensual")}</SelectItem>
                  <SelectItem value="trimestral">{t("trimestral")}</SelectItem>
                  <SelectItem value="semestral">{t("semestral")}</SelectItem>
                  <SelectItem value="anual">{t("anual")}</SelectItem>
                  <SelectItem value="unica">{t("unica")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("numeroCuotas")}</Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={cuotasCantidad}
                onChange={(e) => setCuotasCantidad(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("fechaInicioCobro")}</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fondoDestino")}</Label>
              <Select value={fondoId} onValueChange={setFondoId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fondos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("notasOpcionales")}</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={cargando}>
              {cargando ? t("guardando") : t("generarCalendario")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
