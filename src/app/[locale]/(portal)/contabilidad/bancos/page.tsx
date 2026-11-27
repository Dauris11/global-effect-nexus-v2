import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { DialogoTasaBcrd, DialogoTransferencia } from "@/components/contabilidad/bancos/formularios-banco";
import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { cuentasConSaldo, tasaVigente } from "@/server/contabilidad/bancos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.bancos" });
  return { title: t("titulo") };
}

/**
 * Cuentas bancarias (§4.2): vista en lista con saldo conciliado, saldo sin
 * conciliar, última actividad de conciliación y balance actual. La tasa BCRD
 * se configura desde la tuerca junto al título.
 */
export default async function PaginaBancos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, cuentas, tasa, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.bancos" }),
    cuentasConSaldo(),
    tasaVigente(),
    mensajesCliente(["contab"]),
  ]);
  const activas = cuentas.filter((c) => c.estado === "activa");
  const hoy = claveDia();
  const puedeEditarTasa = usuarioTienePermiso(usuario, "contabilidad.registrar");

  return (
    <NextIntlClientProvider messages={mensajes}>
      <div className="mx-auto max-w-7xl space-y-6 animate-entrada">
        <EncabezadoPagina
          titulo={
            <span className="inline-flex items-center gap-2">
              <span>{t("titulo")}</span>
              <DialogoTasaBcrd hoy={hoy} tasa={tasa} puedeEditar={puedeEditarTasa} />
            </span>
          }
          acciones={
            usuarioTienePermiso(usuario, "contabilidad.aprobar") && activas.length > 1 ? (
              <DialogoTransferencia
                cuentas={activas.map((c) => ({
                  id: c.id,
                  nombre: c.nombre,
                  moneda: c.moneda,
                  tasa_compra: c.tasa_compra,
                  tasa_venta: c.tasa_venta,
                  tarifa: c.tarifa,
                }))}
                tasaBcrd={tasa}
                hoy={hoy}
              />
            ) : null
          }
        />

        {cuentas.length === 0 ? (
          <EstadoVacio icono={Landmark} titulo={t("vacio")} />
        ) : (
          <>
            {/* Vista de tabla para escritorio */}
            <div className={`${TARJETA.contenido} hidden overflow-x-auto md:block`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-3">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("columnas.banco")}</th>
                    <th className="px-4 py-3 font-medium">{t("columnas.auxiliar")}</th>
                    <th className="px-4 py-3 font-medium">{t("columnas.numero")}</th>
                    <th className="px-4 py-3 font-medium">{t("columnas.moneda")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("columnas.saldoConciliado")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("columnas.saldoSinConciliar")}</th>
                    <th className="px-4 py-3 text-center font-medium">{t("columnas.ultimaActividad")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("columnas.balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((cuenta) => (
                    <tr
                      key={cuenta.id}
                      className="border-b border-linea transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/contabilidad/bancos/${cuenta.id}`}
                            className="font-medium text-marca-600 hover:underline"
                          >
                            {cuenta.nombre}
                          </Link>
                          {cuenta.estado === "cerrada" && (
                            <Badge variant="neutra">{t("cerrada")}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-tinta-2">{cuenta.cuenta_contable}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-tinta">
                        {cuenta.numero}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <Badge variant="marca">{cuenta.moneda}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums text-[#1E9E6A]">
                        <Monto valor={cuenta.saldo_conciliado} moneda={cuenta.moneda} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums text-[#B4342B]">
                        <Monto valor={cuenta.saldo_sin_conciliar} moneda={cuenta.moneda} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center tabular-nums text-tinta-2">
                        {cuenta.ultima_conciliacion ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-tinta">
                        <Monto valor={cuenta.saldo} moneda={cuenta.moneda} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vista compacta para móvil */}
            <ul className="space-y-3 md:hidden">
              {cuentas.map((cuenta) => (
                <li key={cuenta.id}>
                  <Link
                    href={`/contabilidad/bancos/${cuenta.id}`}
                    className={`${TARJETA.interactiva} block space-y-3 p-4`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-tinta">{cuenta.nombre}</p>
                        <p className="truncate text-xs text-tinta-2">{cuenta.cuenta_contable}</p>
                        <p className="font-mono text-xs text-tinta-3">{cuenta.numero}</p>
                      </div>
                      <Badge variant="marca">{cuenta.moneda}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-linea pt-2.5 text-xs">
                      <div>
                        <p className="text-tinta-3">{t("columnas.saldoConciliado")}</p>
                        <p className="font-medium tabular-nums text-[#1E9E6A]">
                          <Monto valor={cuenta.saldo_conciliado} moneda={cuenta.moneda} />
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-tinta-3">{t("columnas.saldoSinConciliar")}</p>
                        <p className="font-medium tabular-nums text-[#B4342B]">
                          <Monto valor={cuenta.saldo_sin_conciliar} moneda={cuenta.moneda} />
                        </p>
                      </div>
                      <div>
                        <p className="text-tinta-3">{t("columnas.ultimaActividad")}</p>
                        <p className="tabular-nums text-tinta-2">
                          {cuenta.ultima_conciliacion ?? "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-tinta-3">{t("columnas.balance")}</p>
                        <p className="font-semibold tabular-nums text-tinta">
                          <Monto valor={cuenta.saldo} moneda={cuenta.moneda} />
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </NextIntlClientProvider>
  );
}
