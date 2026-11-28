import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { ListaDePrioridades } from "@/components/prioridades/lista-prioridades";
import { variantesBoton } from "@/components/ui/button-variantes";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { formatearMonto } from "@/lib/contabilidad/formato";
import type { ListaPrioridades } from "@/lib/prioridades/types";
import { cn } from "@/lib/utils";
import { cifrasContables } from "@/server/prioridades/inicio";
import { prioridadesDe } from "@/server/prioridades/motor";
import { proveedorContabilidad } from "@/server/prioridades/providers/contabilidad";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });

  return { title: t("m.accounting") };
}

/**
 * Inicio contable: la primera pestaña del módulo Contabilidad. Antes `/contabilidad` redirigía a `/inicio`
 * (enlaces viejos), pero el módulo necesita su propia entrada: lo que contabilidad tiene que hacer y las tres
 * cifras que mueven el día. Las prioridades salen del mismo motor que `/inicio`, recortadas a los tipos que
 * emite el proveedor de contabilidad, para no repetir aquí las tareas o solicitudes de otras áreas.
 */
export default async function PaginaContabilidad({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tn, completa, cifras, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "priorities" }),
    getTranslations({ locale, namespace: "nav" }),
    prioridadesDe(usuario),
    cifrasContables(),
    mensajesCliente(["priorities", "estados"]),
  ]);

  const tipos = new Set<string>(proveedorContabilidad.tipos);
  const solo = <T extends { tipo: string }>(items: readonly T[]) => items.filter((i) => tipos.has(i.tipo));
  const lista: ListaPrioridades = {
    grupos: {
      vencido: solo(completa.grupos.vencido),
      hoy: solo(completa.grupos.hoy),
      semana: solo(completa.grupos.semana),
      adelante: solo(completa.grupos.adelante),
    },
    esperando: [],
    total: 0,
  };
  lista.total = Object.values(lista.grupos).reduce((n, g) => n + g.length, 0);

  return (
    <PageContainer className="max-w-[1100px] space-y-6">
      <PageHeader title={tn("m.accounting")} />

      <dl className="grid grid-cols-3 gap-4 border-y border-linea py-3">
        {[
          [t("figures.bank"), cifras.saldoBancos],
          [t("figures.payable"), cifras.porPagar7],
          [t("figures.income"), cifras.ingresosMes],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta as string}>
            <dt className="text-meta">{etiqueta as string}</dt>
            <dd className={cn("text-section tabular-nums", (valor as number) < 0 && "text-status-danger-fg")}>{formatearMonto(valor as number, "DOP")}</dd>
          </div>
        ))}
      </dl>

      <NextIntlClientProvider messages={mensajes}>
        {lista.total === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t("accountingUpToDate")}
            action={
              <Link href="/contabilidad/recibos" className={variantesBoton({ variant: "secondary" })}>
                {t("accountingUpToDateAction")}
              </Link>
            }
          />
        ) : (
          <ListaDePrioridades lista={lista} />
        )}
      </NextIntlClientProvider>
    </PageContainer>
  );
}
