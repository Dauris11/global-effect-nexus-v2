import type { Metadata } from "next";
import { ChevronRight, Landmark } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { DialogoTransferencia, FormularioTasa } from "@/components/contabilidad/bancos/formularios-banco";
import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { enmascararCuenta, formatearMonto } from "@/lib/contabilidad/formato";
import { claveDia, fechaCorta } from "@/lib/fechas";
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
 * Cuentas bancarias (§4.2): una tarjeta por libro, con su saldo en su
 * moneda y, si es en dólares, su equivalente en pesos con la tasa del día.
 * Agregar un banco o una cuenta es Configuración (Fase 9), no código.
 */
export default async function PaginaBancos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tc, ti, cuentas, tasa, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.bancos" }),
    getTranslations({ locale, namespace: "contab" }),
    getTranslations({ locale, namespace: "contab.inicio" }),
    cuentasConSaldo(),
    tasaVigente(),
    mensajesCliente(["contab"]),
  ]);
  const activas = cuentas.filter((c) => c.estado === "activa");
  const hoy = claveDia();

  return (
    <NextIntlClientProvider messages={mensajes}>
      <div className="mx-auto max-w-5xl space-y-8">
        <EncabezadoPagina
          titulo={t("titulo")}
          acciones={
            usuarioTienePermiso(usuario, "contabilidad.aprobar") && activas.length > 1 ? (
              <DialogoTransferencia
                cuentas={activas.map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda }))}
                hoy={hoy}
              />
            ) : null
          }
        />

        {cuentas.length === 0 ? (
          <EstadoVacio icono={Landmark} titulo={t("vacio")} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cuentas.map((cuenta) => (
              <li key={cuenta.id} className="min-w-0">
                <Link href={`/contabilidad/bancos/${cuenta.id}`} className={`${TARJETA.interactiva} block p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="texto-titulo-tarjeta truncate">{cuenta.nombre}</p>
                      <p className="texto-meta truncate">
                        {cuenta.banco} · {tc(`tipoCuenta.${cuenta.tipo}`)} · {enmascararCuenta(cuenta.numero)}
                      </p>
                    </div>
                    {cuenta.estado === "cerrada" ? (
                      <Badge variant="neutra">{t("cerrada")}</Badge>
                    ) : (
                      <Badge variant="marca">{cuenta.moneda}</Badge>
                    )}
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-tinta">
                    <Monto valor={cuenta.saldo} moneda={cuenta.moneda} />
                  </p>
                  {cuenta.moneda === "USD" && (
                    <p className="texto-meta">
                      {cuenta.saldo_dop
                        ? ti("equivalente", { monto: formatearMonto(cuenta.saldo_dop, "DOP") })
                        : ti("sinTasa")}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-linea pt-3 text-sm text-tinta-2">
                    <span>
                      {t("movimientos", { n: cuenta.movimientos })} ·{" "}
                      {cuenta.ultima_conciliacion
                        ? t("conciliadaHasta", { fecha: fechaCorta(cuenta.ultima_conciliacion, idioma) })
                        : t("sinConciliar")}
                    </span>
                    <ChevronRight className="size-4 shrink-0" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="space-y-4 border-t border-linea pt-6">
          <div>
            <h2 className="texto-titulo-seccion">{ti("tasa")}</h2>
            <p className="texto-meta">
              {tasa
                ? ti("tasaDe", { compra: tasa.compra, venta: tasa.venta, fuente: tasa.fuente, fecha: fechaCorta(tasa.fecha, idioma) })
                : ti("tasaVacia")}
            </p>
          </div>
          {usuarioTienePermiso(usuario, "contabilidad.registrar") && <FormularioTasa hoy={hoy} />}
        </section>
      </div>
    </NextIntlClientProvider>
  );
}
