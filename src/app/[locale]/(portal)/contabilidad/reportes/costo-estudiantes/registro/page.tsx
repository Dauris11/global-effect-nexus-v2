import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PanelRegistroCostos } from "@/components/costos/panel-registro-costos";
import { SelectorEstudianteCosto } from "@/components/costos/selector-estudiante-costo";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { requerirPermiso } from "@/lib/auth";
import { esUuid } from "@/lib/contabilidad/formato";
import { Link } from "@/i18n/navigation";
import { usuarioTienePermiso } from "@/lib/rbac";
import { datosRegistroCostos, estudiantesParaCosto } from "@/server/costos/consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "costs.register" });

  return { title: t("title") };
}

/**
 * Registro manual de los materiales entregados y del transporte por
 * cuatrimestre de un becado. Vive aquí y no solo en el expediente porque el
 * rol contabilidad no abre expedientes (no tiene `expedientes.leer`).
 * Ver exige `expedientes.costos.leer`; guardar o anular, además
 * `contabilidad.registrar` (lo vuelven a comprobar las acciones).
 */
export default async function PaginaRegistroCostos({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estudiante?: string }>;
}) {
  const { locale } = await params;
  const { estudiante } = await searchParams;

  const usuario = await requerirPermiso("expedientes.costos.leer");
  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");

  const [t, estudiantes] = await Promise.all([
    getTranslations({ locale, namespace: "costs.register" }),
    estudiantesParaCosto(),
  ]);

  const elegido = esUuid(estudiante) && estudiantes.some((e) => e.id === estudiante) ? estudiante : null;
  const datos = elegido ? await datosRegistroCostos(elegido) : null;

  return (
    <div className="animate-entrada space-y-6">
      <EncabezadoPagina
        titulo={t("title")}
        acciones={
          <Button asChild variant="outline">
            <Link href="/contabilidad/reportes/costo-estudiantes">
              <ArrowLeft className="size-4" />
              {t("back")}
            </Link>
          </Button>
        }
      />

      <SelectorEstudianteCosto estudiantes={estudiantes} seleccionado={elegido} />

      {datos && puedeRegistrar && <PanelRegistroCostos datos={datos} />}
    </div>
  );
}
