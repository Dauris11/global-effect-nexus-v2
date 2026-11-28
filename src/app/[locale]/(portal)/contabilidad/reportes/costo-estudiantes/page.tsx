import type { Metadata } from "next";
import { Download, GraduationCap, PackagePlus, Users, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { TablaCostoCarreras } from "@/components/costos/tabla-costo-carreras";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import { costoPorCarrera } from "@/server/costos/consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "costs" });

  return { title: t("title") };
}

/**
 * Reporte comparativo del costo de un becado por carrera y universidad: la
 * cifra para la Junta y para captar donantes. Entra quien tenga
 * `expedientes.costos.leer` (owner, contabilidad y admin).
 */
export default async function PaginaCostoEstudiantes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const usuario = await requerirPermiso("expedientes.costos.leer");
  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");

  const [t, filas] = await Promise.all([getTranslations({ locale, namespace: "costs" }), costoPorCarrera()]);

  const totalInvertido = filas.reduce((s, f) => s + f.total_invertido, 0);
  const conCosto = filas.reduce((s, f) => s + f.con_costo, 0);
  const graduados = filas.reduce((s, f) => s + f.graduados, 0);

  return (
    <div className="animate-entrada space-y-6">
      <EncabezadoPagina
        titulo={t("title")}
        acciones={
          <>
            {puedeRegistrar && (
              <Button asChild>
                <Link href="/contabilidad/reportes/costo-estudiantes/registro">
                  <PackagePlus className="size-4" />
                  {t("register.link")}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <a href="/api/costos/exportar?vista=carreras" download>
                <Download className="size-4" />
                {t("exportCareers")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/costos/exportar?vista=estudiantes" download>
                <Download className="size-4" />
                {t("exportStudents")}
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icono={Wallet} acento etiqueta={t("kpi.total")} valor={formatearMonto(totalInvertido, "DOP")} />
        <StatCard icono={Users} etiqueta={t("kpi.withCost")} valor={conCosto} />
        <StatCard icono={GraduationCap} etiqueta={t("kpi.graduates")} valor={graduados} />
      </div>

      <TablaCostoCarreras filas={filas} />
    </div>
  );
}
