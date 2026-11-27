import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Avance360 } from "@/components/estudiante/clases/avance-360";
import { TarjetaClase } from "@/components/estudiante/clases/tarjeta-clase";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { claveDeClase } from "@/lib/clases";
import { clasesDelEstudiante } from "@/server/estudiantes/clases";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { tareasDelEstudiante } from "@/server/estudiantes/tareas";
import { avanceEn360, iniciarInscripcionesVigentes, ventanaVigente } from "@/server/global360/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentClasses" });

  return { title: t("classes.title") };
}

/**
 * Mis clases: une las materias de la carrera, el aula virtual y Global Effect
 * 360 en una sola pantalla (antes eran tres, y el estudiante no sabía cuál era
 * cuál). Las clases salen de las matrículas, no de las tareas, para que una
 * clase sin tareas todavía tenga su tarjeta.
 */
export default async function PaginaMisClases({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  // Antes de leer: así «cursando» y «prematriculada» ya son los de hoy.
  await iniciarInscripcionesVigentes();

  const [t, clases, tareas, avance, ventana] = await Promise.all([
    getTranslations({ locale, namespace: "studentClasses" }),
    clasesDelEstudiante(estudiante.id),
    tareasDelEstudiante(estudiante.id, idioma),
    avanceEn360(estudiante.id),
    ventanaVigente(),
  ]);

  const prematriculaAbierta = ventana?.abierta ?? false;
  const elegir = (
    <Button asChild>
      <Link href="/portal/estudiante/prematricula">{t("classes.chooseSubjects")}</Link>
    </Button>
  );

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader title={t("classes.title")} primaryAction={clases.length > 0 && prematriculaAbierta ? elegir : undefined} />

      <Avance360 avance={avance} />

      {clases.length === 0 ? (
        prematriculaAbierta ? (
          <EmptyState
            icon={BookOpen}
            title={t("classes.emptyTitle")}
            description={t("classes.emptyOpen")}
            action={elegir}
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title={t("classes.emptyTitle")}
            description={t("classes.emptyClosed")}
            action={
              <Button asChild variant="secondary">
                <Link href="/portal/estudiante/solicitudes">{t("classes.askAdmin")}</Link>
              </Button>
            }
          />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clases.map((clase) => {
            const clave = claveDeClase(clase.origen, clase.id);

            return (
              <li key={clave}>
                <TarjetaClase clase={clase} tareas={tareas.filter((x) => x.claveClase === clave)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
