"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, DollarSign, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { realizarArqueoAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";

const DENOMINACIONES_DOP = [
  { valor: 2000, tipo: "billete" as const, etiqueta: "RD$ 2,000" },
  { valor: 1000, tipo: "billete" as const, etiqueta: "RD$ 1,000" },
  { valor: 500, tipo: "billete" as const, etiqueta: "RD$ 500" },
  { valor: 200, tipo: "billete" as const, etiqueta: "RD$ 200" },
  { valor: 100, tipo: "billete" as const, etiqueta: "RD$ 100" },
  { valor: 50, tipo: "billete" as const, etiqueta: "RD$ 50" },
  { valor: 25, tipo: "moneda" as const, etiqueta: "RD$ 25" },
  { valor: 10, tipo: "moneda" as const, etiqueta: "RD$ 10" },
  { valor: 5, tipo: "moneda" as const, etiqueta: "RD$ 5" },
  { valor: 1, tipo: "moneda" as const, etiqueta: "RD$ 1" },
];

const DENOMINACIONES_USD = [
  { valor: 100, tipo: "billete" as const, etiqueta: "$100" },
  { valor: 50, tipo: "billete" as const, etiqueta: "$50" },
  { valor: 20, tipo: "billete" as const, etiqueta: "$20" },
  { valor: 10, tipo: "billete" as const, etiqueta: "$10" },
  { valor: 5, tipo: "billete" as const, etiqueta: "$5" },
  { valor: 1, tipo: "billete" as const, etiqueta: "$1" },
];

export function ContadorArqueo({
  caja,
  hoy,
}: {
  caja: CajaResumen;
  hoy: string;
}) {
  const t = useTranslations("contab.cajas");
  const router = useRouter();

  const listaDenoms = caja.moneda === "USD" ? DENOMINACIONES_USD : DENOMINACIONES_DOP;

  const [fecha, setFecha] = useState(hoy);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [justificacion, setJustificacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saldoSistema = parseFloat(caja.saldoActual);

  // Calcular saldo físico contado
  let saldoContado = 0;
  for (const d of listaDenoms) {
    const cant = cantidades[d.valor] || 0;
    saldoContado += d.valor * cant;
  }
  saldoContado = Math.round(saldoContado * 100) / 100;

  const diferencia = Math.round((saldoContado - saldoSistema) * 100) / 100;
  const hayDiferencia = Math.abs(diferencia) > 0;

  function actualizarCantidad(denominacion: number, valorStr: string) {
    const cant = parseInt(valorStr, 10);
    setCantidades((prev) => ({
      ...prev,
      [denominacion]: isNaN(cant) || cant < 0 ? 0 : cant,
    }));
  }

  async function onGuardarArqueo(e: React.FormEvent) {
    e.preventDefault();
    if (hayDiferencia && justificacion.trim().length < 5) {
      setError("Existe una diferencia en caja. Debes indicar la justificación correspondiente.");
      return;
    }

    setGuardando(true);
    setError(null);

    const conteos = listaDenoms.map((d) => ({
      denominacion: d.valor,
      tipo: d.tipo,
      cantidad: cantidades[d.valor] || 0,
    }));

    try {
      const res = await realizarArqueoAction({
        cajaId: caja.id,
        fecha,
        conteos,
        justificacion: hayDiferencia ? justificacion : undefined,
      });

      if (res.exito) {
        router.push(`/contabilidad/cajas/${caja.id}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Error al registrar el arqueo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={onGuardarArqueo} className="space-y-6">
      {/* Resumen superior interactivo */}
      <div className="grid gap-4 sm:grid-cols-3 rounded-tarjeta border border-linea bg-superficie/60 p-5 text-sm">
        <div>
          <span className="texto-meta block">{t("saldoSistema")}</span>
          <span className="text-xl font-bold text-tinta">
            {formatearMonto(saldoSistema.toFixed(2), caja.moneda)}
          </span>
        </div>
        <div>
          <span className="texto-meta block">{t("saldoContado")}</span>
          <span className="text-xl font-bold text-marca-700">
            {formatearMonto(saldoContado.toFixed(2), caja.moneda)}
          </span>
        </div>
        <div>
          <span className="texto-meta block">{t("diferencia")}</span>
          <div className="flex items-center gap-2 mt-0.5">
            {!hayDiferencia ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-semaforo-dentro/15 px-2.5 py-0.5 text-xs font-semibold text-semaforo-dentro">
                <CheckCircle2 className="size-3.5" />
                {t("cuadrada")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-semaforo-alerta/15 px-2.5 py-0.5 text-xs font-semibold text-semaforo-alerta">
                <AlertCircle className="size-3.5" />
                {diferencia > 0 ? "+" : ""}
                {formatearMonto(diferencia.toFixed(2), caja.moneda)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fecha">{t("movimientos")} · Fecha del arqueo</Label>
          <Input
            id="fecha"
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla de Conteo Físico por Denominación */}
      <div className="rounded-tarjeta border border-linea bg-background overflow-hidden">
        <div className="border-b border-linea bg-superficie/40 px-4 py-3">
          <h3 className="text-sm font-semibold text-tinta">{t("denominaciones")}</h3>
        </div>

        <div className="divide-y divide-linea">
          {listaDenoms.map((d) => {
            const cant = cantidades[d.valor] || 0;
            const sub = d.valor * cant;
            return (
              <div
                key={d.valor}
                className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 text-sm hover:bg-superficie/30"
              >
                <div className="col-span-4 sm:col-span-3 font-semibold text-tinta">
                  {d.etiqueta}
                </div>
                <div className="col-span-2 text-xs text-tinta-2 uppercase hidden sm:block">
                  {d.tipo === "billete" ? t("billetes") : t("monedas")}
                </div>
                <div className="col-span-4 sm:col-span-4">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={cant === 0 ? "" : cant}
                    onChange={(e) => actualizarCantidad(d.valor, e.target.value)}
                    className="h-8 text-right font-mono"
                  />
                </div>
                <div className="col-span-4 sm:col-span-3 text-right font-mono font-medium text-tinta">
                  {formatearMonto(sub.toFixed(2), caja.moneda)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Justificación obligatoria en caso de descuadre */}
      {hayDiferencia && (
        <div className="rounded-tarjeta border border-semaforo-alerta/30 bg-semaforo-alerta/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-semaforo-alerta">
            <AlertCircle className="size-4" />
            <span>{t("justificacion")} (Obligatoria por descuadre)</span>
          </div>
          <Textarea
            required
            minLength={5}
            rows={2}
            placeholder="Explica el motivo del faltante o sobrante detectado en el arqueo físico..."
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
          />
        </div>
      )}

      {error && (
        <div className="rounded-control bg-semaforo-alerta/15 p-3 text-sm text-semaforo-alerta">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={guardando}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span>{t("guardarArqueo")}</span>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/contabilidad/cajas/${caja.id}`}>{t("volverCajas")}</Link>
        </Button>
      </div>
    </form>
  );
}
