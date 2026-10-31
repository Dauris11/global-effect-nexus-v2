"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, HandCoins, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redondear } from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { aprobarArqueoAction, liquidarValeAction } from "@/server/contabilidad/cajas/acciones";
import type { CategoriaGastoCaja } from "@/server/contabilidad/cajas/consultas";

/** Firma del supervisor: aplica la diferencia y la contabiliza. */
export function BotonAprobarArqueo({ arqueoId }: { arqueoId: string }) {
  const t = useTranslations("contab.cajas");
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const res = await aprobarArqueoAction(arqueoId);
            setError(res.exito ? null : t(`errores.${res.error}`));
          })
        }
      >
        {pendiente ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {t("aprobar")}
      </Button>
      {error && <p className="texto-meta text-tinta">{error}</p>}
    </div>
  );
}

/** Liquidar un vale: lo gastado pasa a gasto y el resto vuelve a la caja. */
export function DialogoLiquidarVale({
  movimientoId,
  monto,
  moneda,
  categorias,
  hoy,
}: {
  movimientoId: string;
  monto: string;
  moneda: "DOP" | "USD";
  categorias: CategoriaGastoCaja[];
  hoy: string;
}) {
  const t = useTranslations("contab.cajas");
  const [abierto, setAbierto] = useState(false);
  const [gastado, setGastado] = useState(monto);
  const [categoriaId, setCategoriaId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const devuelto = Math.max(0, redondear(Number(monto) - (Number(gastado) || 0)));

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    iniciar(async () => {
      const res = await liquidarValeAction({
        movimientoId,
        fecha,
        montoGastado: Number(gastado) || 0,
        categoriaId: categoriaId || null,
      });
      if (res.exito) setAbierto(false);
      else setError(t(`errores.${res.error}`));
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <HandCoins className="size-4" />
          {t("liquidar")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("liquidarTitulo")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`liq-monto-${movimientoId}`}>{t("montoGastado")}</Label>
              <Input
                id={`liq-monto-${movimientoId}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max={monto}
                required
                value={gastado}
                onChange={(e) => setGastado(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`liq-fecha-${movimientoId}`}>{t("fecha")}</Label>
              <Input id={`liq-fecha-${movimientoId}`} type="date" required max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          {Number(gastado) > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor={`liq-cat-${movimientoId}`}>{t("categoria")}</Label>
              <select
                id={`liq-cat-${movimientoId}`}
                className={SELECT}
                required
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
              >
                <option value="" disabled>
                  {t("elegirCategoria")}
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} · {c.cuenta}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="texto-meta">{t("devolucion", { monto: formatearMonto(devuelto.toFixed(2), moneda) })}</p>
          {error && <AvisoError>{error}</AvisoError>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("registrar")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
