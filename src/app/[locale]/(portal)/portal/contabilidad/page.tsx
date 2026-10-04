import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  HandCoins,
  Receipt,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AccesosPortal, BannerPortal } from "@/components/layout/banner-portal";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { montoUsd } from "@/lib/finanzas";
import { MOVIMIENTO, TARJETA, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  resumenDelMesEnCurso,
  ultimosMovimientos,
} from "@/server/finanzas/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("accountingPortal.title") };
}

/**
 * Portal de contabilidad: el mes en curso y lo último que se movió.
 *
 * Ya no lleva cifras vacías. El esqueleto que había aquí las omitía a propósito
 * —"un balance a cero en la pantalla de quien lleva las cuentas no es un dato
 * neutro, es un dato equivocado"— y esa decisión sigue en pie: ahora las
 * cifras salen de `transaccion`, así que un cero en pantalla significa que
 * este mes no se ha registrado nada, que es información y no relleno.
 *
 * El mes lo decide la base (`date_trunc('month', CURRENT_DATE)`), no el reloj
 * del navegador ni el del servidor: ver la cabecera de
 * `resumenDelMesEnCurso()`.
 *
 * `requerirRol` y no `requerirPermiso('finanzas.leer')`: esto es la puerta de
 * entrada de un rol, igual que los otros cinco portales, y `super_admin` entra
 * a todos. Las pantallas de dentro sí cierran por permiso.
 */
export default async function PortalContabilidad({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  await requerirRol(["contabilidad", "super_admin"]);

  const [t, tm, tf, mes, ultimos] = await Promise.all([
    getTranslations({ locale, namespace: "accountingPortal" }),
    getTranslations({ locale, namespace: "modules" }),
    getTranslations({ locale, namespace: "finance" }),
    resumenDelMesEnCurso(),
    ultimosMovimientos(6),
  ]);

  return (
    <div className="space-y-6">
      <BannerPortal
        rol="contabilidad"
        icono={DollarSign}
        insignia={t("eyebrow")}
        titulo={tm("accountingPortal.title")}
        subtitulo={t("summary")}
        kpis={[
          // Sin decimales en el banner: son cifras de un vistazo, y los
          // centavos se leen en la tabla de movimientos, que es donde
          // significan algo.
          { valor: montoUsd(mes.ingresos, 0), etiqueta: t("kpi.income") },
          { valor: montoUsd(mes.egresos, 0), etiqueta: t("kpi.expense") },
          { valor: montoUsd(mes.balance, 0), etiqueta: t("kpi.balance") },
          { valor: String(mes.movimientos), etiqueta: t("kpi.entries") },
        ]}
      />

      <p className="text-muted-foreground text-xs">{t("monthHint")}</p>

      <AccesosPortal
        accesos={[
          {
            href: "/contabilidad",
            icono: DollarSign,
            color: "bg-[#2096BA]/10 text-[#187a99]",
            titulo: tm("accounting.title"),
            texto: tm("accounting.desc"),
          },
          {
            href: "/reportes",
            icono: BarChart3,
            color: "bg-[#2096BA]/10 text-[#187a99]",
            titulo: tm("reports.title"),
            texto: tm("reports.desc"),
          },
          {
            href: "/patrocinadores",
            icono: HandCoins,
            color: "bg-[#2096BA]/10 text-[#187a99]",
            titulo: tm("sponsors.title"),
            texto: tm("sponsors.desc"),
          },
        ]}
      />

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{t("recent.title")}</p>
              <p className="text-muted-foreground text-xs">
                {t("recent.hint")}
              </p>
            </div>

            <Link
              href="/contabilidad"
              className="shrink-0 text-xs font-medium text-[#187a99] hover:underline"
            >
              {t("recent.all")}
            </Link>
          </div>

          {ultimos.length === 0 ? (
            <div className={VACIO.contenedor}>
              <span className={VACIO.icono}>
                <Receipt className="size-6" />
              </span>
              <p className={VACIO.titulo}>{t("recent.empty")}</p>
              <p className={VACIO.descripcion}>{t("recent.emptyHint")}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {ultimos.map((fila) => {
                const entra = fila.tipo === "ingreso";
                const estilo = MOVIMIENTO[entra ? "ingreso" : "egreso"];
                const Flecha = entra ? ArrowUpRight : ArrowDownRight;

                return (
                  <li key={fila.id} className={TARJETA.fila}>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        estilo.cuadro,
                      )}
                    >
                      <Flecha className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {fila.concepto}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {tf(`category.${fila.categoria}` as never)} ·{" "}
                        {fila.fecha}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 text-sm font-bold tabular-nums",
                        estilo.texto,
                      )}
                    >
                      {estilo.signo}
                      {montoUsd(fila.monto)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
