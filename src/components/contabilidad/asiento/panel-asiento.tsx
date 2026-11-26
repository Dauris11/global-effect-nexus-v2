import { CheckCircle2, CircleAlert, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Monto } from "@/components/contabilidad/comun";
import { Link } from "@/i18n/navigation";
import { descuadreDe, type LineaVista, type VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { TARJETA } from "@/lib/paleta";

const DOP = "DOP" as const;
const pesos = (n: number) => n.toFixed(2);

/**
 * Dibuja una `VistaAsiento`: encabezado, tabla (tarjetas en móvil), totales,
 * banda de cuadre y lista de problemas. Es de presentación pura: no carga
 * nada, así que sirve igual dentro de `BotonAsiento` que en una página.
 *
 * El estado se dice con icono y texto, no solo con color: «Cuadra» en el
 * acento y «Descuadrado» en tinta sólida (la norma no admite rojo en banners).
 */
export function PanelAsiento({ vista }: { vista: VistaAsiento }) {
  const t = useTranslations("contab.asiento");
  const diferencia = descuadreDe(vista);

  return (
    <div className="space-y-4">
      <header className="space-y-0.5">
        <h3 className="texto-titulo-tarjeta">
          {vista.estado === "contabilizado" ? t("contabilizado", { numero: vista.numero ?? "" }) : t("previo")}
        </h3>
        {(vista.fecha || vista.descripcion) && (
          <p className="texto-meta">{[vista.fecha, vista.descripcion].filter(Boolean).join(" · ")}</p>
        )}
      </header>

      <div className={`${TARJETA.contenido} hidden overflow-x-auto md:block`}>
        <table className="w-full text-sm">
          <caption className="sr-only">{t("tablaDescripcion")}</caption>
          <thead className="texto-meta border-b border-linea text-left">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">{t("cuenta")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">{t("debe")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">{t("haber")}</th>
            </tr>
          </thead>
          <tbody>
            {vista.lineas.map((l, i) => (
              <tr key={i} className="border-b border-linea align-top last:border-0">
                <th scope="row" className="px-4 py-2 text-left font-normal"><Cuenta linea={l} /></th>
                <td className="px-4 py-2 text-right">{l.debe > 0 && <Monto valor={pesos(l.debe)} moneda={DOP} />}</td>
                <td className="px-4 py-2 text-right">{l.haber > 0 && <Monto valor={pesos(l.haber)} moneda={DOP} />}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-linea font-semibold">
            <tr>
              <th scope="row" className="px-4 py-2.5 text-left">{t("totales")}</th>
              <td className="px-4 py-2.5 text-right"><Monto valor={pesos(vista.totalDebe)} moneda={DOP} /></td>
              <td className="px-4 py-2.5 text-right"><Monto valor={pesos(vista.totalHaber)} moneda={DOP} /></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-2 md:hidden" aria-label={t("tablaDescripcion")}>
        {vista.lineas.map((l, i) => (
          <li key={i} className={`${TARJETA.contenido} space-y-1.5 p-3 text-sm`}>
            <Cuenta linea={l} />
            <dl className="flex justify-between gap-4 tabular-nums">
              <div>
                <dt className="texto-meta">{t("debe")}</dt>
                <dd>{l.debe > 0 ? <Monto valor={pesos(l.debe)} moneda={DOP} /> : "—"}</dd>
              </div>
              <div className="text-right">
                <dt className="texto-meta">{t("haber")}</dt>
                <dd>{l.haber > 0 ? <Monto valor={pesos(l.haber)} moneda={DOP} /> : "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
        <li className={`${TARJETA.contenido} flex justify-between gap-4 p-3 text-sm font-semibold tabular-nums`}>
          <span>{t("debe")} <Monto valor={pesos(vista.totalDebe)} moneda={DOP} /></span>
          <span>{t("haber")} <Monto valor={pesos(vista.totalHaber)} moneda={DOP} /></span>
        </li>
      </ul>

      <p
        role="status"
        className={`flex items-center gap-2 rounded-control p-3 text-sm font-medium ${
          vista.cuadra ? "bg-marca-50 text-marca-700" : "bg-tinta text-background"
        }`}
      >
        {vista.cuadra ? <CheckCircle2 className="size-5 shrink-0" /> : <CircleAlert className="size-5 shrink-0" />}
        {vista.cuadra
          ? t("cuadra")
          : t("descuadrado", { monto: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(diferencia) })}
      </p>

      {vista.problemas.length > 0 && (
        <section aria-labelledby="problemas-asiento" className="space-y-2">
          <h4 id="problemas-asiento" className="text-sm font-semibold text-tinta">{t("problemas")}</h4>
          <ul className="space-y-2">
            {vista.problemas.map((p, i) => (
              <li key={`${p.clave}-${p.codigo ?? i}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-control border border-linea p-3 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-tinta-2" />
                <span className="min-w-0 flex-1">
                  {p.clave === "otro" && p.detalle
                    ? p.detalle
                    : t(`problema.${p.clave}`, { codigo: p.codigo ?? "", detalle: p.detalle ?? "" })}
                </span>
                {p.codigo && p.clave !== "monto_invalido" && (
                  <Link
                    href="/contabilidad/configuracion?tab=codigos"
                    className="inline-flex min-h-11 items-center gap-1.5 text-marca-600 underline underline-offset-4 hover:text-marca-700"
                  >
                    <Settings2 className="size-4" />
                    {t("irACodigos")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Cuenta({ linea }: { linea: LineaVista }) {
  const t = useTranslations("contab.asiento");
  return (
    <span className="block">
      {linea.cuentaCodigo ? (
        <>
          <span className="font-mono text-xs text-tinta-2">{linea.cuentaCodigo}</span>{" "}
          <span className="text-tinta">{linea.cuentaNombre}</span>
        </>
      ) : (
        <span className="text-tinta-2">{t("sinCuenta")}</span>
      )}
      {linea.descripcion && <span className="texto-meta block">{linea.descripcion}</span>}
    </span>
  );
}
