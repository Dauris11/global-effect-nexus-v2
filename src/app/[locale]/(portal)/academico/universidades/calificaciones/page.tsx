import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioCarga } from "@/components/universidades/carga-calificaciones/formulario-carga";
import { Badge } from "@/components/ui/badge";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { cargasRecientes, universidadesParaCarga } from "@/server/universidades/carga-consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.upload" });

  return { title: t("title") };
}

/** Subir las calificaciones de una universidad: asistente guiado, con lectura por IA y revisión humana. */
export default async function PaginaSubirCalificaciones({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  await requerirPermiso("expedientes.escribir");

  const [t, universidades, recientes, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "catalog.upload" }),
    universidadesParaCarga(),
    cargasRecientes(),
    mensajesCliente(["catalog", "common"]),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-3xl space-y-6">
      <EncabezadoPagina titulo={t("title")} />

      <section className="rounded-card border border-linea bg-card p-4">
        <h2 className="texto-titulo-tarjeta">{t("intro.title")}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px]">
          <li>{t("intro.step1")}</li>
          <li>{t("intro.step2")}</li>
          <li>{t("intro.step3")}</li>
        </ol>
      </section>

      <NextIntlClientProvider messages={mensajes}>
        <FormularioCarga universidades={universidades} anioInicial={new Date().getFullYear()} />
      </NextIntlClientProvider>

      {recientes.length > 0 && (
        <section className="space-y-2">
          <h2 className="texto-titulo-seccion">{t("review.recent")}</h2>
          <ul className="divide-y divide-linea rounded-card border border-linea bg-card">
            {recientes.map((c) => (
              <li key={c.id}>
                <Link href={`/academico/universidades/calificaciones/${c.id}`} className="flex min-h-11 items-center gap-3 p-3 hover:bg-muted">
                  <span className="min-w-0 flex-1 font-medium">{c.siglas} · {c.anio}-{c.ronda}</span>
                  <Badge variant={c.estado === "confirmada" ? "marca" : "neutra"}>{t(`review.state.${c.estado as "borrador"}`)}</Badge>
                  <ChevronRight className="size-4 shrink-0 text-tinta-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
