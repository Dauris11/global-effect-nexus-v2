import type { Metadata } from "next";
import { ArrowRight, Info, Landmark, Plus, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { InsigniaEstadoRecibo, Monto } from "@/components/contabilidad/comun";
import { ListaRecibos } from "@/components/contabilidad/recibos/lista-recibos";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { formatearMonto, numeroDocumento, SERIE_RECIBO, sumarMontos } from "@/lib/contabilidad/formato";
import { claveDia, fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { cuentasConSaldo, tasaVigente } from "@/server/contabilidad/bancos/consultas";
import { vencenEn } from "@/server/contabilidad/cxp/consultas";
import {
  borradoresPendientes,
  leerFiltroRecibos,
  recibos,
} from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.inicio" });
  return { title: t("antetitulo") };
}

/**
 * Inicio del portal de contabilidad (§4.1), con saldos por cuenta, la tasa del
 * día, cuentas por pagar por vencer, lo que espera ser contabilizado y lo
 * último registrado.
 *
 * La puerta es `contabilidad.leer`, no el rol: `super_admin` entra a mirar
 * (auditoría) y no ve ningún botón que escriba.
 */
export default async function PortalContabilidad({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tc, tcxp, cuentas, tasa, pendientes, recientes, vencen30] = await Promise.all([
    getTranslations({ locale, namespace: "contab.inicio" }),
    getTranslations({ locale, namespace: "contab" }),
    getTranslations({ locale, namespace: "contab.cxp" }),
    cuentasConSaldo(),
    tasaVigente(),
    borradoresPendientes(),
    recibos(leerFiltroRecibos({}), 5),
    vencenEn(30),
  ]);

  const activas = cuentas.filter((c) => c.estado === "activa");
  // El total en pesos solo si TODAS las cuentas tienen equivalente: un
  // total que omite en silencio la cuenta en dólares sería falso.
  const totalDop = activas.every((c) => c.saldo_dop !== null)
    ? sumarMontos(activas.map((c) => c.saldo_dop ?? "0"))
    : null;
  const tasaVieja = tasa && tasa.fecha < claveDia();

  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <EncabezadoPagina
        antetitulo={t("antetitulo")}
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
        acciones={
          usuarioTienePermiso(usuario, "contabilidad.registrar") ? (
            <Button asChild>
              <Link href="/contabilidad/recibos/nuevo">
                <Plus className="size-4" />
                {t("nuevoRecibo")}
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="texto-titulo-seccion">{t("saldos")}</h2>
          {totalDop && (
            <p className="text-right">
              <span className="texto-meta block">{t("totalDop")}</span>
              <span className="text-lg font-semibold text-tinta">{formatearMonto(totalDop, "DOP")}</span>
            </p>
          )}
        </div>
        {activas.length === 0 ? (
          <EstadoVacio icono={Landmark} titulo={tc("bancos.vacio")} texto={tc("bancos.vacioTexto")} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activas.map((cuenta) => (
              <li key={cuenta.id} className="min-w-0">
                <Link href={`/contabilidad/bancos/${cuenta.id}`} className={`${TARJETA.interactiva} block p-5`}>
                  <p className="texto-meta">{cuenta.nombre}</p>
                  <p className="mt-1 text-2xl font-semibold text-tinta">
                    <Monto valor={cuenta.saldo} moneda={cuenta.moneda} />
                  </p>
                  {cuenta.moneda === "USD" && (
                    <p className="texto-meta">
                      {cuenta.saldo_dop
                        ? t("equivalente", { monto: formatearMonto(cuenta.saldo_dop, "DOP") })
                        : t("sinTasa")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-start gap-2 text-sm text-tinta-2">
          <Info className="mt-0.5 size-4 shrink-0 text-marca-600" />
          {tasa
            ? tasaVieja
              ? t("tasaVieja", { fecha: fechaCorta(tasa.fecha, idioma) })
              : t("tasaDe", { compra: tasa.compra, venta: tasa.venta, fuente: tasa.fuente, fecha: fechaCorta(tasa.fecha, idioma) })
            : t("tasaVacia")}
        </p>
      </section>

      {/* Cuentas por pagar por vencer */}
      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="texto-titulo-seccion">{tcxp("titulo")}</h2>
            <p className="texto-meta">{tcxp("subtitulo")}</p>
          </div>
          <Link
            href="/contabilidad/cuentas-por-pagar"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline"
          >
            {t("verTodos")}
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {vencen30.length === 0 ? (
          <div className="rounded-tarjeta border border-linea bg-background p-6 text-sm text-tinta-2">
            No hay cuentas por pagar que venzan en los próximos 30 días.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {vencen30.map((v) => (
              <Link
                key={v.moneda}
                href="/contabilidad/cuentas-por-pagar"
                className={`${TARJETA.interactiva} block p-5`}
              >
                <p className="texto-meta">Vencen en 30 días ({v.moneda})</p>
                <p className="mt-1 text-2xl font-bold text-tinta">
                  <Monto valor={v.total} moneda={v.moneda} />
                </p>
                <p className="texto-meta mt-1">
                  {v.cantidad} {v.cantidad === 1 ? "cuenta por pagar" : "cuentas por pagar"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <h2 className="texto-titulo-seccion">{t("pendientes")}</h2>
        {pendientes.length === 0 ? (
          <EstadoVacio icono={ReceiptText} titulo={t("pendientesVacio")} texto={t("pendientesTexto")} />
        ) : (
          <ul className={TARJETA.contenido}>
            {pendientes.map((fila) => (
              <li key={fila.id} className="border-b border-linea last:border-b-0">
                <Link href={`/contabilidad/recibos/${fila.id}`} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-tinta">
                      {numeroDocumento(SERIE_RECIBO[fila.tipo], fila.numero)} · {fila.concepto}
                    </span>
                    <span className="texto-meta block">
                      {fechaCorta(fila.fecha, idioma)} · {fila.creado_por}
                    </span>
                  </span>
                  <Monto valor={fila.monto} moneda={fila.moneda} className="font-medium" />
                  <InsigniaEstadoRecibo estado={fila.estado} etiqueta={tc(`estado.${fila.estado}`)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="texto-titulo-seccion">{t("recientes")}</h2>
          <Link href="/contabilidad/recibos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline">
            {t("verTodos")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {recientes.length > 0 && <ListaRecibos filas={recientes.slice(0, 5)} idioma={idioma} />}
      </section>

      <p className="texto-meta">{t("proximamente")}</p>
    </div>
  );
}
