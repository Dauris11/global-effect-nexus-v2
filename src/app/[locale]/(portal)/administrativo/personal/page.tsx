import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type ChipEstado } from "@/components/app/filter-bar";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { InvitarPersona } from "@/components/personal/invitar-persona";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { fechaConHora } from "@/lib/fechas";
import { ROLES_ASIGNABLES } from "@/lib/rbac";
import { equipo } from "@/server/personal/consultas";
import { Users } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "staff" });

  return { title: t("title") };
}

type Estado = "activas" | "sin_acceso" | "inactivas";

/**
 * Personal (patrón Lista): la tabla de personas con lo que importa —rol, estado de la cuenta, último acceso
 * y cuánto tienen abierto—, chips que filtran al instante y «Invitar persona» como única acción primaria.
 * Los donuts «Estado de cuentas» y «Reparto por rol» viven ahora en `/reportes/personal`. El detalle de
 * cada persona (cuenta y «Qué atiende») está en `/administrativo/personal/[id]`.
 */
export default async function PaginaPersonal({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const [{ locale }, { estado, q }] = await Promise.all([params, searchParams]);
  await requerirPermiso("usuarios.administrar");

  const [t, tRoles, gente, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "staff" }),
    getTranslations({ locale, namespace: "roles" }),
    equipo(),
    mensajesCliente(["staff"]),
  ]);

  const estadoDe = (p: (typeof gente)[number]): Estado => (!p.activo ? "inactivas" : p.ultimo_acceso === null ? "sin_acceso" : "activas");
  const cuenta = (e: Estado) => gente.filter((p) => estadoDe(p) === e).length;
  const chips: ChipEstado[] = [
    { value: "activas", label: t("filters.active"), count: cuenta("activas") },
    { value: "sin_acceso", label: t("filters.never"), count: cuenta("sin_acceso") },
    { value: "inactivas", label: t("filters.inactive"), count: cuenta("inactivas") },
  ];
  const texto = (q ?? "").trim().toLowerCase();
  const visibles = gente.filter((p) => {
    if (estado && estado !== "todos" && estadoDe(p) !== estado) return false;

    return !texto || p.nombre.toLowerCase().includes(texto) || p.email.toLowerCase().includes(texto);
  });
  const etiquetaEstado: Record<Estado, { status: string; label: string }> = {
    activas: { status: "activo", label: t("accountState.active") },
    sin_acceso: { status: "pendiente", label: t("accountState.never") },
    inactivas: { status: "inactivo", label: t("accountState.inactive") },
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("title")}
        primaryAction={
          <NextIntlClientProvider messages={mensajes}>
            <InvitarPersona roles={ROLES_ASIGNABLES} />
          </NextIntlClientProvider>
        }
        secondaryActions={
          <Link href="/reportes/personal" className="text-label text-marca-700 hover:underline">
            {t("reportsLink")}
          </Link>
        }
      />

      <Suspense fallback={null}>
        <FilterBar chips={chips} totalChips={gente.length} placeholder={t("searchPlaceholder")} chipParam="estado" />
      </Suspense>

      {visibles.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} description={t("inviteHint")} readOnly />
      ) : (
        <div className="overflow-x-auto rounded-card border border-linea bg-card">
          <table className="w-full text-sm">
            <thead className="text-meta border-b border-linea text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t("column.person")}</th>
                <th className="px-4 py-3 font-medium">{t("column.role")}</th>
                <th className="px-4 py-3 font-medium">{t("column.status")}</th>
                <th className="px-4 py-3 font-medium">{t("column.lastAccess")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("col.priorities")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {visibles.map((p) => {
                const e = etiquetaEstado[estadoDe(p)];

                return (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/administrativo/personal/${p.id}`} className="block font-semibold hover:underline">
                        {p.nombre}
                      </Link>
                      <span className="text-meta block">{p.email}</span>
                    </td>
                    <td className="px-4 py-2.5">{tRoles(p.rol)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={e.status} label={e.label} />
                    </td>
                    <td className="text-meta px-4 py-2.5">{p.ultimo_acceso ? fechaConHora(p.ultimo_acceso, null, locale === "en" ? "en" : "es") : t("never")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.prioridades_abiertas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
