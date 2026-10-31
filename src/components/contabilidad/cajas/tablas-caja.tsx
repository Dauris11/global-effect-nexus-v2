import { AlertCircle, CheckCircle2, FileText, Receipt, Scale } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import type {
  ArqueoCaja,
  CategoriaGastoCaja,
  MovimientoCaja,
} from "@/server/contabilidad/cajas/consultas";
import { BotonAprobarArqueo, DialogoLiquidarVale } from "./acciones-caja";

const TIPO = { gasto: "tipoGasto", vale: "tipoVale", reposicion: "tipoReposicion", ajuste: "tipoAjuste" } as const;

function claveEstado(m: MovimientoCaja) {
  if (m.estado === "anulado") return "estadoAnulado";
  if (m.tipo === "vale") return m.estado === "pendiente" ? "estadoPorLiquidar" : "estadoLiquidado";
  if (m.tipo === "gasto") return m.estado === "pendiente" ? "estadoPorReponer" : "estadoRepuesto";
  return "estadoRecibida";
}

/**
 * Movimientos de la caja: tabla en escritorio, tarjetas en el móvil. La
 * reposición lleva "+" y el resto "−": el signo es la única señal que
 * sobrevive en gris.
 */
export function TablaMovimientos({
  movimientos,
  moneda,
  categorias,
  hoy,
  puedeRegistrar,
}: {
  movimientos: MovimientoCaja[];
  moneda: "DOP" | "USD";
  categorias: CategoriaGastoCaja[];
  hoy: string;
  puedeRegistrar: boolean;
}) {
  const t = useTranslations("contab.cajas");
  // El comprobante se descarga con un <a> y no con Link: es una ruta que
  // redirige a un enlace firmado, no una página.
  const locale = useLocale();
  if (movimientos.length === 0) {
    return <EstadoVacio icono={Receipt} titulo={t("sinMovimientos")} />;
  }

  const signo = (m: MovimientoCaja) => (m.tipo === "reposicion" ? "+" : "−");
  const acciones = (m: MovimientoCaja) => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {m.tieneAdjunto && (
        <a
          href={`/${locale}/contabilidad/cajas/${m.cajaId}/adjunto/${m.id}`}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline"
        >
          <FileText className="size-4" />
          <span className="sr-only md:not-sr-only">{t("verAdjunto")}</span>
        </a>
      )}
      {m.asientoId && (
        <Link
          href={`/contabilidad/asientos/${m.asientoId}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-marca-600 hover:underline"
        >
          {t("verAsiento")}
        </Link>
      )}
      {puedeRegistrar && m.tipo === "vale" && m.estado === "pendiente" && (
        <DialogoLiquidarVale
          movimientoId={m.id}
          monto={m.monto}
          moneda={moneda}
          categorias={categorias}
          hoy={hoy}
        />
      )}
    </div>
  );

  return (
    <>
      <div className={`${TARJETA.contenido} hidden overflow-x-auto md:block`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-2">
            <tr>
              <th className="px-4 py-3 font-medium">{t("colNumero")}</th>
              <th className="px-4 py-3 font-medium">{t("colFecha")}</th>
              <th className="px-4 py-3 font-medium">{t("colTipo")}</th>
              <th className="px-4 py-3 font-medium">{t("colConcepto")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("colMonto")}</th>
              <th className="px-4 py-3 font-medium">{t("colEstado")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {movimientos.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-mono text-xs text-tinta-2">CJ-{m.numero}</td>
                <td className="whitespace-nowrap px-4 py-3 text-tinta">{m.fecha}</td>
                <td className="px-4 py-3 text-tinta">{t(TIPO[m.tipo])}</td>
                <td className="max-w-xs px-4 py-3">
                  <p className="truncate text-tinta">{m.concepto}</p>
                  <p className="texto-meta truncate">{m.cuentaGasto ?? m.personaNombre ?? ""}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-tinta">
                  {signo(m)}
                  {formatearMonto(m.monto, moneda)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="neutra">{t(claveEstado(m))}</Badge>
                </td>
                <td className="px-4 py-2">{acciones(m)}</td>
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
                <p className="texto-meta">
                  {t(TIPO[m.tipo])} · {m.fecha}
                </p>
              </div>
              <p className="whitespace-nowrap font-mono font-semibold text-tinta">
                {signo(m)}
                {formatearMonto(m.monto, moneda)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="neutra">{t(claveEstado(m))}</Badge>
              {acciones(m)}
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
            <div className="flex items-center gap-2">
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
