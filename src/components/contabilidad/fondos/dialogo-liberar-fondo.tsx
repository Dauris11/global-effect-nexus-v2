"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
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
import { liberarFondoRestringido } from "@/server/contabilidad/fondos/acciones";
import type { FondoItem } from "@/server/contabilidad/fondos/consultas";

export function DialogoLiberarFondo({ fondos }: { fondos: FondoItem[] }) {
  const t = useTranslations("contab.fondos");
  const [abierto, setAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fondosRestringidosConSaldo = fondos.filter(
    (f) => f.tipoRestriccion !== "no_restringido" && f.saldoRestringidoDisponible > 0
  );

  const [fondoId, setFondoId] = useState(fondosRestringidosConSaldo[0]?.id ?? "");
  const [monto, setMonto] = useState("");
  const [documentoReferencia, setDocumentoReferencia] = useState("");
  const [justificacion, setJustificacion] = useState("");

  const fondoSeleccionado = fondos.find((f) => f.id === fondoId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProcesando(true);

    const res = await liberarFondoRestringido({
      fondoId,
      monto: Number(monto),
      documentoReferencia: documentoReferencia || undefined,
      justificacion,
    });

    setProcesando(false);
    if (res.ok) {
      setAbierto(false);
      setMonto("");
      setDocumentoReferencia("");
      setJustificacion("");
    } else {
      setError(res.error || "Error al liberar");
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowUpRight className="mr-2 size-4 text-marca-600" />
          {t("liberar")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("modalLiberarTitulo")}</DialogTitle>
            <DialogDescription>{t("modalLiberarDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm font-medium text-tinta">
              {error}
            </div>
          )}

          {fondosRestringidosConSaldo.length === 0 ? (
            <div className="rounded-md border border-linea bg-muted p-4 text-center text-sm text-tinta-2">
              No hay fondos restringidos con saldo disponible para liberar.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>{t("nombre")}</Label>
                <Select value={fondoId} onValueChange={setFondoId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fondosRestringidosConSaldo.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre} (Disp: RD$ {f.saldoRestringidoDisponible.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fondoSeleccionado?.propositoRestringido && (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    Condición: {fondoSeleccionado.propositoRestringido}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>{t("montoALiberar")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  max={fondoSeleccionado?.saldoRestringidoDisponible}
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("soporte")}</Label>
                <Input
                  placeholder="Ej. B-001 / Factura B150000001"
                  value={documentoReferencia}
                  onChange={(e) => setDocumentoReferencia(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("justificacion")}</Label>
                <Textarea
                  rows={3}
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  placeholder={t("justificacionPlaceholder")}
                  required
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAbierto(false)}
                >
                  {t("cancelar")}
                </Button>
                <Button type="submit" disabled={procesando}>
                  {procesando ? t("procesando") : t("confirmarLiberacion")}
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
