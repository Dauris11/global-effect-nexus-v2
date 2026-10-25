"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { registrarDebidaDiligencia } from "@/server/contabilidad/terceros/acciones";

export function DialogoDebidaDiligencia({
  terceroId,
  nombreTercero,
}: {
  terceroId: string;
  nombreTercero: string;
}) {
  const t = useTranslations("contab.terceros");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [origenFondos, setOrigenFondos] = useState("");
  const [verificacionPep, setVerificacionPep] = useState(false);
  const [verificacionListas, setVerificacionListas] = useState(true);
  const [resultado, setResultado] = useState<"aprobado" | "observado" | "rechazado">("aprobado");
  const [observaciones, setObservaciones] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await registrarDebidaDiligencia({
      terceroId,
      origenFondosDeclarado: origenFondos,
      verificacionPep,
      verificacionListas,
      resultado,
      observaciones: observaciones || undefined,
    });

    setCargando(false);

    if (!res.ok) {
      setError(res.error || t("errorGuardar"));
      return;
    }

    setAbierto(false);
    setOrigenFondos("");
    setObservaciones("");
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <ShieldAlert className="mr-1 size-3.5" />
          {t("debidaDiligencia")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("evaluacionLey155")}</DialogTitle>
            <DialogDescription>
              {nombreTercero} — {t("cumplimientoPrevencion")}
            </DialogDescription>
          </DialogHeader>

          {error && <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm text-tinta">{error}</div>}

          <div className="space-y-1.5">
            <Label>{t("origenFondos")}</Label>
            <Textarea
              value={origenFondos}
              onChange={(e) => setOrigenFondos(e.target.value)}
              placeholder={t("placeholderOrigenFondos")}
              required
              rows={2}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-linea p-3 text-sm dark:border-slate-800">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={verificacionPep}
                onChange={(e) => setVerificacionPep(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>{t("personaExpuestaPoliticamente")}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={verificacionListas}
                onChange={(e) => setVerificacionListas(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>{t("verificacionListasInternacionales")}</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>{t("dictamenFinal")}</Label>
            <Select value={resultado} onValueChange={(v: "aprobado" | "observado" | "rechazado") => setResultado(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aprobado">{t("aprobadoConforme")}</SelectItem>
                <SelectItem value="observado">{t("observadoBajoRevision")}</SelectItem>
                <SelectItem value="rechazado">{t("rechazadoRiesgoAlto")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("observacionesOficial")}</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={cargando}>
              {cargando ? t("guardando") : t("guardarDictamen")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
