import type { Metadata } from "next";
import { ChevronLeft, HeartHandshake, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { MenuExportar } from "@/components/compartido/menu-exportar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { estudiantesEnRiesgo, type EstudianteEnRiesgo } from "@/server/academico/riesgo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "risk" });

  return { title: t("title") };
}

/** WhatsApp pide solo dígitos y el código de país: a un número de 10 dígitos se le antepone el 1 (RD). */
function enlaceWhatsapp(telefono: string | null): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");

  if (digitos.length < 10) return null;

  return `https://wa.me/${digitos.length === 10 ? `1${digitos}` : digitos}`;
}

/**
 * Estudiantes en riesgo: los activos que hoy necesitan una conversación, ordenados de más
 * a menos urgentes, cada uno con su motivo en palabras y el botón para contactarlo.
 */
export default async function PaginaRiesgo({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  await requerirPermiso("expedientes.leer");

  const [t, te, filas] = await Promise.all([getTranslations({ locale, namespace: "risk" }), getTranslations({ locale, namespace: "export" }), estudiantesEnRiesgo()]);
  const nota = (n: number | null) => (n === null ? "—" : n.toFixed(2));

  const motivos = (f: EstudianteEnRiesgo) =>
    f.motivos.map((m) =>
      m === "acumulado"
        ? t("reason.cumulative", { indice: nota(f.indice), minimo: nota(f.umbralAcumulado) })
        : m === "periodo"
          ? t("reason.period", { periodo: f.periodo ?? "", indice: nota(f.indicePeriodo), minimo: nota(f.umbralPeriodo) })
          : t("reason.failed", { count: f.reprobadas }),
    );

  const contacto = (f: EstudianteEnRiesgo) => {
    const wa = enlaceWhatsapp(f.telefono);

    return (
      <div className="flex flex-wrap gap-2">
        {wa && (
          <Button asChild variant="outline" size="sm">
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" />
              {t("whatsapp")}
            </a>
          </Button>
        )}
        {f.email && (
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${f.email}`}>
              <Mail className="size-4" />
              {t("email")}
            </a>
          </Button>
        )}
        {!wa && !f.email && <span className="texto-meta">{t("noContact")}</span>}
      </div>
    );
  };

  return (
    <div className="animate-entrada space-y-6">

      <div>
        <Button asChild variant="outline" size="sm" className="transition-transform hover:-translate-x-0.5">
          <Link href="/expedientes">
            <ChevronLeft className="size-4" />
            {t("back")}
          </Link>
        </Button>
      </div>

      <div>
        <EncabezadoPagina
          titulo={t("title")}
          acciones={
            <MenuExportar documentos={[{ tipo: "riesgo", etiqueta: te("docs.riesgo") }]} />
          }
        />
      </div>

      {filas.length === 0 ? (
        <EstadoVacio icono={ShieldCheck} titulo={t("emptyTitle")} texto={t("emptyText")} />
      ) : (
        <>
          <p className="texto-meta flex items-center gap-2">
            <HeartHandshake className="size-4" />
            {t("count", { count: filas.length })}
          </p>

          <ul className="space-y-3">
            {filas.map((f) => (
              <li key={f.id} className="rounded-card border border-linea bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/expedientes/${f.id}`} className="font-semibold hover:underline">
                      {f.nombre}
                    </Link>
                    <p className="texto-meta mt-0.5">{[f.universidad, f.carrera].filter(Boolean).join(" · ") || t("noCatalog")}</p>
                  </div>
                  <Badge variant="solida">{t("urgency", { count: f.motivos.length })}</Badge>
                </div>

                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {motivos(f).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  {contacto(f)}
                  <Button asChild size="sm">
                    <Link href={`/expedientes/${f.id}?seccion=academic`}>{t("openRecord")}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
