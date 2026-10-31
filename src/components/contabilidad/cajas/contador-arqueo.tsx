"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import {
  JUSTIFICACION_MINIMA,
  denominacionesDe,
  redondear,
  totalContado,
} from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import { realizarArqueoAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";

/**
 * Conteo físico por denominación. El total y la diferencia se recalculan con
 * cada cifra para que quien cuenta vea el descuadre antes de firmar; el
 * servidor vuelve a calcular todo con la misma función (`totalContado`).
 */
export function ContadorArqueo({
  caja,
  hoy,
  contador,
}: {
  caja: CajaResumen;
  hoy: string;
  contador: string;
}) {
  const t = useTranslations("contab.cajas");
  const router = useRouter();
  const denominaciones = denominacionesDe(caja.moneda);

  const [fecha, setFecha] = useState(hoy);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [justificacion, setJustificacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conteos = denominaciones.map((d) => ({
    denominacion: d.valor,
    cantidad: cantidades[String(d.valor)] ?? 0,
  }));
  const sistema = Number(caja.saldoActual);
  const contado = totalContado(conteos);
  const diferencia = redondear(contado - sistema);
  const cuadra = diferencia === 0;
  const m = (n: number) => formatearMonto(n.toFixed(2), caja.moneda);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    const res = await realizarArqueoAction({
      cajaId: caja.id,
      fecha,
      conteos: conteos.filter((c) => c.cantidad > 0),
      justificacion: cuadra ? undefined : justificacion,
    });
    setGuardando(false);
    if (res.exito) {
      router.push(`/contabilidad/cajas/${caja.id}`);
      router.refresh();
    } else {
      setError(t(`errores.${res.error}`));
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <dl className={`${TARJETA.contenido} grid gap-4 p-5 sm:grid-cols-3`}>
        <div>
          <dt className="texto-meta">{t("saldoSistema")}</dt>
          <dd className="text-xl font-semibold text-tinta">{m(sistema)}</dd>
        </div>
        <div>
          <dt className="texto-meta">{t("saldoContado")}</dt>
          <dd className="text-xl font-semibold text-marca-700">{m(contado)}</dd>
        </div>
        <div>
          <dt className="texto-meta">{t("diferencia")}</dt>
          <dd className="mt-1" aria-live="polite">
            {cuadra ? (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${INSIGNIA_SEMAFORO.dentro}`}>
                <CheckCircle2 className="size-4" />
                {t("exacto")}
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${INSIGNIA_SEMAFORO.alerta}`}>
                <AlertCircle className="size-4" />
                {diferencia > 0 ? t("sobrante") : t("faltante")} {m(Math.abs(diferencia))}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="arq-fecha">{t("fechaArqueo")}</Label>
        <Input id="arq-fecha" type="date" required max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      <fieldset className={`${TARJETA.contenido} overflow-hidden`}>
        <legend className="sr-only">{t("denominaciones")}</legend>
        <div className="grid grid-cols-3 gap-3 border-b border-linea px-4 py-3 text-sm font-medium text-tinta-2">
          <span>{t("denominaciones")}</span>
          <span className="text-right">{t("cantidad")}</span>
          <span className="text-right">{t("subtotal")}</span>
        </div>
        {denominaciones.map((d) => {
          const clave = String(d.valor);
          const cantidad = cantidades[clave] ?? 0;
          return (
            <div key={clave} className="grid grid-cols-3 items-center gap-3 border-b border-linea px-4 py-2 last:border-b-0">
              <label htmlFor={`den-${clave}`} className="text-sm font-medium text-tinta">
                {m(d.valor)}
                <span className="texto-meta block">{d.tipo === "billete" ? t("billetes") : t("monedas")}</span>
              </label>
              <Input
                id={`den-${clave}`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={cantidad === 0 ? "" : cantidad}
                onChange={(e) => {
                  const valor = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                  setCantidades((previo) => ({ ...previo, [clave]: valor }));
                }}
                className="text-right font-mono"
              />
              <span className="text-right font-mono text-sm text-tinta">{m(d.valor * cantidad)}</span>
            </div>
          );
        })}
        <div className="grid grid-cols-3 gap-3 bg-muted/60 px-4 py-3 text-sm font-semibold text-tinta">
          <span>{t("totalContado")}</span>
          <span />
          <span className="text-right font-mono">{m(contado)}</span>
        </div>
      </fieldset>

      {!cuadra && (
        <div className="space-y-1.5">
          <Label htmlFor="arq-justificacion">{t("justificacion")}</Label>
          <Textarea
            id="arq-justificacion"
            required
            minLength={JUSTIFICACION_MINIMA}
            maxLength={500}
            rows={2}
            placeholder={t("justificacionAyuda")}
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
          />
        </div>
      )}

      <p className="texto-meta">{t("firmaConteo", { nombre: contador })}</p>
      {error && <AvisoError>{error}</AvisoError>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={guardando}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("guardarArqueo")}
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/contabilidad/cajas/${caja.id}`}>{t("cancelar")}</Link>
        </Button>
      </div>
    </form>
  );
}
