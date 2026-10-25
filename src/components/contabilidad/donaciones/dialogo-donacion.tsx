"use client";

import { useState } from "react";
import { HeartHandshake } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { registrarDonacion } from "@/server/contabilidad/donaciones/acciones";

export function DialogoDonacion({
  donantes,
  fondos,
  cuentasBancarias,
}: {
  donantes: { id: string; nombre: string; identificacion: string }[];
  fondos: { id: string; nombre: string }[];
  cuentasBancarias: { id: string; nombre: string; moneda: string }[];
}) {
  const t = useTranslations("contab.donaciones");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [terceroId, setTerceroId] = useState(donantes[0]?.id ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [clase, setClase] = useState<"efectivo" | "especie">("efectivo");
  const [tratamiento, setTratamiento] = useState<"exento" | "gravado">("exento");
  const [moneda, setMoneda] = useState<"DOP" | "USD">("DOP");
  const [tasa, setTasa] = useState("60.00");
  const [monto, setMonto] = useState("");
  const [descripcionEspecie, setDescripcionEspecie] = useState("");
  const [fondoId, setFondoId] = useState(fondos[0]?.id ?? "");
  const [cuentaBancariaId, setCuentaBancariaId] = useState(cuentasBancarias[0]?.id ?? "");
  const [notas, setNotas] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await registrarDonacion({
      terceroId,
      fecha,
      clase,
      tratamiento,
      moneda,
      tasa: moneda === "USD" ? Number(tasa) : undefined,
      monto: Number(monto),
      descripcionEspecie: clase === "especie" ? descripcionEspecie : undefined,
      valorEstimadoTasacion: clase === "especie" ? Number(monto) : undefined,
      fondoId,
      cuentaBancariaId: clase === "efectivo" ? cuentaBancariaId : undefined,
      notas: notas || undefined,
    });

    setCargando(false);

    if (!res.ok) {
      setError(res.error || t("errorGuardar"));
      return;
    }

    setAbierto(false);
    setMonto("");
    setDescripcionEspecie("");
    setNotas("");
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <HeartHandshake className="mr-2 size-4" />
          {t("nuevaDonacion")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("registrarDonacion")}</DialogTitle>
            <DialogDescription>{t("descripcionDonacion")}</DialogDescription>
          </DialogHeader>

          {error && <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm text-tinta">{error}</div>}

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
              <Label>{t("fecha")}</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t("claseDonacion")}</Label>
              <Select value={clase} onValueChange={(v: "efectivo" | "especie") => setClase(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">{t("efectivo")}</SelectItem>
                  <SelectItem value="especie">{t("especieBienes")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("tratamientoFiscal")}</Label>
              <Select value={tratamiento} onValueChange={(v: "exento" | "gravado") => setTratamiento(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exento">{t("exentoLey122")}</SelectItem>
                  <SelectItem value="gravado">{t("gravadoComercial")}</SelectItem>
                </SelectContent>
              </Select>
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
              <Label>{clase === "especie" ? t("valorTasado") : t("monto")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            {moneda === "USD" ? (
              <div className="space-y-1.5">
                <Label>{t("tasaCambio")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={tasa}
                  onChange={(e) => setTasa(e.target.value)}
                  required
                />
              </div>
            ) : (
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
            )}
          </div>

          {clase === "efectivo" ? (
            <div className="space-y-1.5">
              <Label>{t("cuentaBancariaReceptora")}</Label>
              <Select value={cuentaBancariaId} onValueChange={setCuentaBancariaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cuentasBancarias.map((cb) => (
                    <SelectItem key={cb.id} value={cb.id}>
                      {cb.nombre} ({cb.moneda})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t("descripcionBienesEspecie")}</Label>
              <Textarea
                value={descripcionEspecie}
                onChange={(e) => setDescripcionEspecie(e.target.value)}
                placeholder={t("placeholderBienes")}
                required
                rows={2}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("notasOpcionales")}</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={cargando}>
              {cargando ? t("guardando") : t("confirmarDonacion")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
