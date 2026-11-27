import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { TarjetaClaseDocente } from "@/components/profesor/clase/tarjeta-clase-docente";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirDocencia } from "@/lib/auth";
import { claveDeClase } from "@/lib/clases";
import { usuarioTienePermiso } from "@/lib/rbac";
import { clasesDelDocente } from "@/server/profesor/clases";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "teacherClasses" });

  return { title: t("title") };
}

/**
 * Mis clases del docente: las de Global Effect 360 y las materias de la carrera
 * en UNA lista (antes «Clases de 360» y «Asignación de materias»). Coordinación
 * ve todas; el docente, solo las suyas (`docenteId`).
 */
export default async function PaginaClasesDocente({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";

  const usuario = await requerirDocencia();
  const docenteId = usuarioTienePermiso(usuario, "academico.escribir") ? null : usuario.id;

  const [t, clases] = await Promise.all([
    getTranslations({ locale, namespace: "teacherClasses" }),
    clasesDelDocente(docenteId),
  ]);

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader title={t("title")} />

      {clases.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("emptyTitle")}
          description={t("emptyHint")}
          action={
            <Button asChild>
              <Link href="/administrativo/solicitudes?nuevo=1">{t("writeCoordination")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clases.map((clase) => (
            <li key={claveDeClase(clase.origen, clase.id)}>
              <TarjetaClaseDocente clase={clase} idioma={idioma} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
