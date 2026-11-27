import type { Metadata } from "next";
import { ChevronLeft, BookOpen } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ArchivosAcademicos } from "@/components/universidades/archivos-academicos";
import { LogoUniversidad } from "@/components/universidades/logo-universidad";
import {
  BotonQuitarMateria,
  FormCargaMaterias,
  FormCarrera,
  FormPensum,
} from "@/components/universidades/formularios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MenuExportar } from "@/components/compartido/menu-exportar";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { usuarioTienePermiso } from "@/lib/rbac";
import { archivosAcademicos, carreraPorId, materiasDePensum, pensumsDeCarrera } from "@/server/universidades/consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = UUID.test(id) ? await carreraPorId(id) : null;

  return { title: c?.nombre ?? "—" };
}

/**
 * Una carrera: sus pénsums y, del elegido (`?pensum=`, por defecto el primero
 * vigente), la tabla de materias con créditos, período y prerrequisitos. Las
 * materias se cargan pegando una lista; el OCR de PDF llega en la fase 4 y
 * escribirá por esta misma vía, siempre tras revisión.
 */
export default async function PaginaCarrera({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ pensum?: string }>;
}) {
  const { locale, id } = await params;
  const { pensum: pensumElegido } = await searchParams;
  const usuario = await requerirPermiso("catalogo.leer");
  const carrera = UUID.test(id) ? await carreraPorId(id) : null;

  if (!carrera) notFound();

  const [t, te, pensums, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "export" }),
    pensumsDeCarrera(id),
    mensajesCliente(["catalog"]),
  ]);
  const puedeEscribir = usuarioTienePermiso(usuario, "catalogo.escribir");
  const actual = pensums.find((p) => p.id === pensumElegido) ?? pensums[0] ?? null;
  const [materias, archivos] = actual
    ? await Promise.all([materiasDePensum(actual.id), archivosAcademicos("pensum", actual.id)])
    : [[], []];

  return (
    <div className="animate-entrada space-y-6">
      <EncabezadoPagina
        titulo={
          <span className="inline-flex items-center gap-3">
            <LogoUniversidad siglas={carrera.siglas} url={carrera.logo} className="size-10" />
            {carrera.siglas} · {carrera.nombre}
          </span>
        }
        acciones={
          <>
            {actual && <MenuExportar documentos={[{ tipo: "plan-estudios", etiqueta: te("docs.studyPlan"), params: { id: actual.id } }]} />}
          <Button asChild variant="outline" size="sm">
            <Link href={`/academico/universidades/${carrera.universidad_id}`}>
              <ChevronLeft className="size-4" />
              {t("back")}
            </Link>
          </Button>
          </>
        }
      />

      <NextIntlClientProvider messages={mensajes}>
        {puedeEscribir && (
          <div className="flex flex-wrap gap-2">
            <FormPensum carreraId={id} />
            <FormCarrera universidadId={carrera.universidad_id} carrera={carrera} />
          </div>
        )}

        {pensums.length === 0 ? (
          <EstadoVacio icono={BookOpen} titulo={t("pensum.empty")} />
        ) : (
          <>
            <nav aria-label={t("pensum.title")} className="flex flex-wrap gap-2">
              {pensums.map((p) => (
                <Link
                  key={p.id}
                  href={`/academico/universidades/carreras/${id}?pensum=${p.id}`}
                  aria-current={p.id === actual?.id ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium",
                    p.id === actual?.id ? "border-tinta bg-tinta text-background" : "border-linea-fuerte text-tinta-2 hover:bg-muted",
                  )}
                >
                  {t("pensum.versionLabel", { version: p.version })}
                  {!p.vigente && ` · ${t("pensum.old")}`}
                </Link>
              ))}
            </nav>

            {actual && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="texto-meta">
                    {t("pensum.totals", { subjects: actual.materias, credits: actual.creditos, students: actual.estudiantes })}
                  </p>
                  {puedeEscribir && <FormPensum carreraId={id} pensum={actual} />}
                </div>

                {materias.length === 0 ? (
                  <EstadoVacio icono={BookOpen} titulo={t("pensum.noSubjects")} />
                ) : (
                  <div className="overflow-x-auto rounded-card border border-linea bg-card">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-linea text-left text-xs text-tinta-3">
                          <th className="p-3 font-medium">{t("pensum.period")}</th>
                          <th className="p-3 font-medium">{t("pensum.code")}</th>
                          <th className="p-3 font-medium">{t("pensum.subject")}</th>
                          <th className="p-3 text-right font-medium">{t("pensum.creditsShort")}</th>
                          <th className="p-3 font-medium">{t("pensum.prereq")}</th>
                          {puedeEscribir && <th className="w-12 p-3" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-linea">
                        {materias.map((m) => (
                          <tr key={m.id}>
                            <td className="p-3 tabular-nums">{m.periodo_sugerido ?? "—"}</td>
                            <td className="p-3 font-medium">{m.codigo}</td>
                            <td className="p-3">{m.nombre}</td>
                            <td className="p-3 text-right tabular-nums">{m.creditos}</td>
                            <td className="p-3 text-tinta-3">{m.prerrequisitos.length ? m.prerrequisitos.join(", ") : t("pensum.none")}</td>
                            {puedeEscribir && (
                              <td className="p-3">
                                <BotonQuitarMateria id={m.id} nombre={m.nombre} />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {puedeEscribir && <FormCargaMaterias pensumId={actual.id} />}

                <h2 className="texto-titulo-seccion">{t("files.pensumTitle")}</h2>
                <ArchivosAcademicos destino="pensum" id={actual.id} archivos={archivos} tipos={["pensum_pdf"]} puedeEscribir={puedeEscribir} />
              </section>
            )}
          </>
        )}
      </NextIntlClientProvider>
    </div>
  );
}
