"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { crearFondo } from "@/server/contabilidad/fondos/acciones";

export function DialogoFondo({ donantes }: { donantes: { id: string; nombre: string }[] }) {
  const t = useTranslations("contab.fondos");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tipoRestriccion, setTipoRestriccion] = useState<
    "no_restringido" | "temporalmente_restringido" | "permanentemente_restringido"
  >("no_restringido");
  const [donanteId, setDonanteId] = useState("");
  const [montoOriginal, setMontoOriginal] = useState("");
  const [proposito, setProposito] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const res = await crearFondo({
      nombre,
      codigo: codigo || undefined,
      tipoRestriccion,
      donanteId: donanteId || undefined,
      montoRestringidoOriginal: montoOriginal ? Number(montoOriginal) : undefined,
      propositoRestringido: proposito || undefined,
    });

    setGuardando(false);
    if (res.ok) {
      setAbierto(false);
      setNombre("");
      setCodigo("");
      setMontoOriginal("");
      setProposito("");
      setDonanteId("");
    } else {
      setError(res.error || "Error");
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          {t("nuevo")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("nuevo")}</DialogTitle>
            <DialogDescription>{t("subtitulo")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm font-medium text-tinta">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("nombre")}</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                placeholder="FND-XXX"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("tipoRestriccion")}</Label>
            <Select
              value={tipoRestriccion}
              onValueChange={(v: "no_restringido" | "temporalmente_restringido" | "permanentemente_restringido") => setTipoRestriccion(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_restringido">{t("no_restringido")}</SelectItem>
                <SelectItem value="temporalmente_restringido">{t("temporalmente_restringido")}</SelectItem>
                <SelectItem value="permanentemente_restringido">{t("permanentemente_restringido")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoRestriccion !== "no_restringido" && (
            <>
              <div className="space-y-1.5">
                <Label>{t("donante")}</Label>
                <Select value={donanteId} onValueChange={setDonanteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione donante patrocinador" />
                  </SelectTrigger>
                  <SelectContent>
                    {donantes.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("montoOriginal")} (RD$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={montoOriginal}
                  onChange={(e) => setMontoOriginal(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("proposito")}</Label>
                <Textarea
                  rows={2}
                  value={proposito}
                  onChange={(e) => setProposito(e.target.value)}
                  placeholder="Finalidad convenida por el donante..."
                />
              </div>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAbierto(false)}
            >
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? t("procesando") : t("guardar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
