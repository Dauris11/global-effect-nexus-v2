import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { GraficasPersonal } from "@/components/personal/graficas-personal";
import { requerirPermiso } from "@/lib/auth";
import { cifrasEquipo, repartoPorRol } from "@/server/personal/consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "staff" });

  return { title: t("title") };
}

/** Reportes del equipo: los donuts «Estado de cuentas» y «Reparto por rol» que salieron de la pantalla de Personal. */
export default async function ReportesPersonal({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requerirPermiso("usuarios.administrar");
  const [t, tRoles, cifras, reparto] = await Promise.all([
    getTranslations({ locale, namespace: "staff" }),
    getTranslations({ locale, namespace: "roles" }),
    cifrasEquipo(),
    repartoPorRol(),
  ]);

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t("title")} />
      <GraficasPersonal
        cuentas={{
          conAcceso: Math.max(0, cifras.activas - cifras.sin_entrar),
          sinAcceso: cifras.sin_entrar,
          inactivas: cifras.inactivas,
          total: cifras.total,
        }}
        roles={reparto.map((fila) => ({ nombre: tRoles(fila.rol), valor: fila.total }))}
        etiquetas={{
          tituloCuentas: t("chartAccountsTitle"),
          conAcceso: t("chartActiveWithLogin"),
          sinAcceso: t("stats.neverSignedIn"),
          inactivas: t("stats.inactive"),
          tituloRoles: t("roles"),
          vacio: t("chartEmpty"),
        }}
      />
    </PageContainer>
  );
}
