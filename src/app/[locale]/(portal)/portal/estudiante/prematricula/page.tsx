import type { Metadata } from "next";
import { CalendarClock, Info } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { AvisoMinimoCuatrimestral } from "@/components/estudiante/aviso-minimo-cuatrimestral";
import { PrematriculaPasos } from "@/components/estudiante/prematricula/pasos";
import { Button } from "@/components/ui/button";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { textoDeFechaLocal } from "@/lib/clases";
import { topeCreditosDeUniversidad } from "@/lib/reglas-academicas";
import { materiasOfertadas } from "@/server/estudiantes/academico";
import { cumplimientoCuatrimestralEstudiante, estudianteDeUsuario } from "@/server/estudiantes/portal";
import { iniciarInscripcionesVigentes, tandasDelEstudiante, ventanaVigente } from "@/server/global360/consultas";
import { catalogoMatricula360 } from "@/server/moodle/consultas";
import { parametros } from "@/server/parametros/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentClasses" });

  return { title: t("enroll.title") };
}

/**
 * Prematrícula: un flujo de tres pasos (tanda → materia → confirmar) con el plazo
 * siempre a la vista. Es la ventana de prematrícula de coordinación, la MISMA
 * para la carrera y para Global Effect 360: un cuatrimestre tiene una sola.
 *
 * Fuera de la ventana no hay nada que elegir y la pantalla lo dice con un
 * vacío; ya no mezcla la matrícula histórica, el avance ni gráficos (eso es
 * «Mis clases» y «Calificaciones»).
 */
export default async function PaginaPrematricula({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  // Antes de leer: así el estado de cada inscripción ya es el de hoy.
  await iniciarInscripcionesVigentes();

  const [t, ventana, valoresParametros] = await Promise.all([
    getTranslations({ locale, namespace: "studentClasses" }),
    ventanaVigente(),
    parametros(),
  ]);

  if (!ventana) {
    return (
      <div className="animate-entrada space-y-6">
        <PageHeader title={t("enroll.title")} />
        <EmptyState
          icon={CalendarClock}
          title={t("enroll.closedTitle")}
          description={t("enroll.closedHint")}
          action={
            <Button asChild variant="secondary">
              <Link href="/portal/estudiante/clases">{t("enroll.seeClasses")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const [oferta, materias360, tandas, cumplimiento, mensajes] = await Promise.all([
    materiasOfertadas({ periodoId: ventana.periodo_id, estudianteId: estudiante.id }),
    catalogoMatricula360(estudiante.id),
    tandasDelEstudiante(estudiante.id, ventana.periodo_id),
    cumplimientoCuatrimestralEstudiante(estudiante.id, estudiante.esUniversitario, ventana.periodo_id),
    mensajesCliente(["studentClasses"]),
  ]);

  const pauta = topeCreditosDeUniversidad(estudiante.universidad, valoresParametros);
  const cierra = textoDeFechaLocal(ventana.cierra, idioma);
  const abre = textoDeFechaLocal(ventana.abre, idioma);

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader title={t("enroll.title")} subtitle={t("enroll.subtitle", { periodo: ventana.periodo })} />

      <div role="status" className="flex items-start gap-3 rounded-control bg-marca-50 p-4 text-marca-700">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">
            {ventana.abierta
              ? t("enroll.deadline", { fecha: cierra.fecha, hora: cierra.hora })
              : t("enroll.opensOn", { fecha: abre.fecha, hora: abre.hora })}
          </p>
          {ventana.mensaje && <p className="text-sm">{ventana.mensaje}</p>}
        </div>
      </div>

      <AvisoMinimoCuatrimestral cumplimiento={cumplimiento} />

      <NextIntlClientProvider messages={mensajes}>
        <PrematriculaPasos
          datos={{
            periodo: ventana.periodo,
            ronda: ventana.ronda,
            abierta: ventana.abierta,
            plazo: t("enroll.deadline", { fecha: cierra.fecha, hora: cierra.hora }),
            mensaje: ventana.mensaje,
            tandas,
            materias360,
            oferta,
            topeCreditos: pauta.tope,
            universidadPauta: pauta.etiquetaUniversidad,
          }}
        />
      </NextIntlClientProvider>
    </div>
  );
}
