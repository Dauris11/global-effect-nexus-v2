import { AlertCircle, CheckCircle2, Receipt, Scale } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import type { ArqueoCaja, MovimientoCaja } from "@/server/contabilidad/cajas/consultas";
import { BotonAprobarArqueo } from "./acciones-caja";
import { AsientoArqueo } from "./botones-asiento-caja";

function formatearFechaDdMmYyyy(iso: string): string {
  const partes = iso.split("-");
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * Movimientos de la caja: tabla con No., Fecha (DD/MM/YYYY), Comprobante,
 * Concepto (solo el concepto), Entregado a, Categoría de gasto y Monto.
 */
export function TablaMovimientos({
  movimientos,
  moneda,
}: {
  movimientos: MovimientoCaja[];
  moneda: "DOP" | "USD";
}) {
  const t = useTranslations("contab.cajas");
  if (movimientos.length === 0) {
    return <EstadoVacio icono={Receipt} titulo={t("sinMovimientos")} />;
  }

  const signo = (m: MovimientoCaja) => (m.tipo === "reposicion" ? "+" : "−");

  return (
    <>
      <div className={`${TARJETA.contenido} hidden overflow-x-auto md:block`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-xs text-tinta-2">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colNumero")}</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colFecha")}</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colComprobante")}</th>
              <th className="px-4 py-3 font-medium">{t("colConcepto")}</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colEntregadoA")}</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">{t("colCategoriaGasto")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t("colMonto")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {movimientos.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-tinta-2">
                  CJ-{m.numero}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-tinta">
                  {formatearFechaDdMmYyyy(m.fecha)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-tinta-2">
                  {m.comprobanteNumero || "—"}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-tinta" title={m.concepto}>
                  {m.concepto}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-tinta">
                  {m.entregadoA ?? m.personaNombre ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-tinta-2">
                  {m.cuentaGasto ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-tinta">
                  {signo(m)}
                  {formatearMonto(m.monto, moneda)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {movimientos.map((m) => (
          <li key={m.id} className={`${TARJETA.contenido} space-y-2 p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-tinta">{m.concepto}</p>
                <p className="texto-meta font-mono tabular-nums">
                  CJ-{m.numero} · {formatearFechaDdMmYyyy(m.fecha)}
                  {m.comprobanteNumero && ` · ${m.comprobanteNumero}`}
                </p>
              </div>
              <p className="whitespace-nowrap font-mono font-semibold text-tinta">
                {signo(m)}
                {formatearMonto(m.monto, moneda)}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tinta-2">
              <span>{m.entregadoA ?? m.personaNombre ?? "—"}</span>
              <span>{m.cuentaGasto ?? "—"}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Historial de arqueos con quién contó y quién aprobó. */
export function TablaArqueos({
  arqueos,
  moneda,
  usuarioId,
  puedeAprobar,
}: {
  arqueos: ArqueoCaja[];
  moneda: "DOP" | "USD";
  usuarioId: string;
  puedeAprobar: boolean;
}) {
  const t = useTranslations("contab.cajas");
  if (arqueos.length === 0) {
    return <EstadoVacio icono={Scale} titulo={t("sinArqueos")} />;
  }

  return (
    <ul className="space-y-3">
      {arqueos.map((a) => {
        const dif = Number(a.diferencia);
        return (
          <li key={a.id} className={`${TARJETA.contenido} flex flex-col gap-3 p-4 md:flex-row md:items-center`}>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-tinta">
                <span className="font-mono text-xs text-tinta-2">AR-{a.numero}</span>
                {a.fecha}
                {dif === 0 ? (
                  <Badge className={INSIGNIA_SEMAFORO.dentro}>
                    <CheckCircle2 className="size-3.5" />
                    {t("exacto")}
                  </Badge>
                ) : (
                  <Badge className={INSIGNIA_SEMAFORO.alerta}>
                    <AlertCircle className="size-3.5" />
                    {dif > 0 ? t("sobrante") : t("faltante")} {formatearMonto(Math.abs(dif).toFixed(2), moneda)}
                  </Badge>
                )}
              </p>
              <p className="texto-meta">
                {t("colSistema")} {formatearMonto(a.saldoSistema, moneda)} · {t("colContado")}{" "}
                {formatearMonto(a.saldoContado, moneda)}
              </p>
              {a.justificacion && <p className="texto-meta truncate">{a.justificacion}</p>}
              <p className="texto-meta">
                {t("colContadoPor")}: {a.creadoPorNombre}
                {a.revisadoPorNombre && ` · ${t("colSupervisor")}: ${a.revisadoPorNombre}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Sin diferencia no hay asiento que ver. */}
              {dif !== 0 && <AsientoArqueo arqueoId={a.id} />}
              {a.estado === "aprobado" ? (
                <>
                  <Badge variant="neutra">{t("aprobado")}</Badge>
                  {a.asientoId && (
                    <Link
                      href={`/contabilidad/asientos/${a.asientoId}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-marca-600 hover:underline"
                    >
                      {t("verAsiento")}
                    </Link>
                  )}
                </>
              ) : puedeAprobar && a.creadoPorId !== usuarioId ? (
                <BotonAprobarArqueo arqueoId={a.id} />
              ) : (
                <Badge variant="neutra">{t("pendienteAprobacion")}</Badge>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
