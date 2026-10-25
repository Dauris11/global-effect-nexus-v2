"use client";

import { useState } from "react";
import { FileCheck } from "lucide-react";
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
import { emitirComprobanteRetencion } from "@/server/contabilidad/retenciones/acciones";

export function DialogoRetencion({
  facturasConRetencion,
}: {
  facturasConRetencion: {
    id: string;
    numero: number;
    proveedorNombre: string;
    ncf: string | null;
    retencionIsr: number;
    retencionItbis: number;
  }[];
}) {
  const t = useTranslations("contab.retenciones");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [facturaId, setFacturaId] = useState(facturasConRetencion[0]?.id ?? "");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0, 10));
  const [concepto, setConcepto] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await emitirComprobanteRetencion({
      facturaId,
      fechaEmision,
      concepto: concepto || undefined,
    });

    setCargando(false);

    if (!res.ok) {
      setError(res.error || t("errorGuardar"));
      return;
    }

    setAbierto(false);
    setConcepto("");
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <FileCheck className="mr-2 size-4" />
          {t("emitirComprobante")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("emitirComprobanteRetencion")}</DialogTitle>
            <DialogDescription>{t("descripcionRetencion")}</DialogDescription>
          </DialogHeader>

          {error && <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm font-medium text-tinta">{error}</div>}

          {facturasConRetencion.length === 0 ? (
            <div className="rounded-md border border-linea bg-muted p-3 text-sm text-tinta-2">
              {t("noHayFacturasConRetencion")}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>{t("facturaProveedor")}</Label>
                <Select value={facturaId} onValueChange={setFacturaId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {facturasConRetencion.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        FP-{String(f.numero).padStart(5, "0")} — {f.proveedorNombre} ({f.ncf || "Sin NCF"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("fechaEmision")}</Label>
                <Input
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("conceptoConstancia")}</Label>
                <Input
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder={t("placeholderConcepto")}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={cargando || facturasConRetencion.length === 0}>
              {cargando ? t("emitiendo") : t("emitir")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
