import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { AccionesCarga, AsignarEstudiante } from "@/components/universidades/carga-calificaciones/acciones-revision";
import { Badge } from "@/components/ui/badge";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { cargaPorId, estudiantesDeUniversidad, type CargaFila } from "@/server/universidades/carga-consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.upload.review" });

  return { title: t("title") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bloquea = (f: CargaFila) => f.problemas.some((p) => p !== "confianza_baja");

/** Revisión de una carga: qué se leyó, a quién y a qué materia se asignó, y qué falta por resolver antes de confirmar. */
export default async function PaginaRevisionCarga({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;

  await requerirPermiso("expedientes.escribir");

  if (!UUID.test(id)) notFound();

  const carga = await cargaPorId(id);

  if (!carga) notFound();

  const abierta = carga.estado === "borrador";
  const [t, estudiantes, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "catalog.upload" }),
    abierta ? estudiantesDeUniversidad(carga.universidad.id) : Promise.resolve([]),
    mensajesCliente(["catalog"]),
  ]);

  const ordenadas = [...carga.filas].sort((a, b) => (a.estudiante_nombre ?? "").localeCompare(b.estudiante_nombre ?? "") || a.orden - b.orden);
  const conProblemas = carga.filas.filter(bloquea).length;
  const nEstudiantes = new Set(carga.filas.flatMap((f) => (f.estudiante_id ? [f.estudiante_id] : []))).size;

  const estadoDe = (f: CargaFila) => (
    <div className="space-y-1">
      {f.problemas.length === 0 ? (
        <Badge variant="marca"><CheckCircle2 className="size-3.5" />{t("review.ok")}</Badge>
      ) : (
        <ul className="space-y-0.5">
          {f.problemas.map((p) => (
            <li key={p} className="flex items-start gap-1.5 text-sm text-tinta">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {t(`problems.${p as "sin_estudiante"}`)}
            </li>
          ))}
        </ul>
      )}
      {f.emparejado_por && <p className="texto-meta">{t(`review.matchedBy.${f.emparejado_por}`)}</p>}
    </div>
  );

  const leido = (f: CargaFila) => (
    <p className="texto-meta">
      {t("review.read", { name: f.nombre_leido ?? "", id: f.matricula ?? "" })}
      {f.confianza !== null && ` · ${t("review.confidence", { value: f.confianza })}`}
    </p>
  );

  const estudianteCelda = (f: CargaFila) =>
    f.estudiante_id ? (
      <div>
        <p className="font-medium">{f.estudiante_nombre}</p>
        {leido(f)}
      </div>
    ) : (
      <div className="space-y-2">
        <p className="font-medium">{t("review.unmatched")}</p>
        {leido(f)}
        {abierta && (
          <NextIntlClientProvider messages={mensajes}>
            <AsignarEstudiante cargaId={carga.id} filaId={f.id} estudiantes={estudiantes} />
          </NextIntlClientProvider>
        )}
      </div>
    );

  const materiaCelda = (f: CargaFila) => (
    <div>
      <p>{f.codigo ? `${f.codigo} ${f.materia ?? ""}` : (f.codigo_leido ?? f.materia_leida ?? "")}</p>
    </div>
  );

  const notaCelda = (f: CargaFila) => `${f.letra ?? ""}${f.nota ? ` · ${Number(f.nota)}` : ""}`;

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina titulo={`${t("review.title")} · ${carga.universidad.siglas}`} />

      <p className="texto-meta">
        {t("review.period", { year: carga.anio, round: carga.ronda })} · {t("review.summary", { rows: carga.filas.length, students: nEstudiantes, issues: conProblemas })}
      </p>

      {/* ≥ md: tabla */}
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card md:block">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-linea text-sm text-tinta-3">
            <tr>
              <th className="p-3 font-medium">{t("review.student")}</th>
              <th className="p-3 font-medium">{t("review.subject")}</th>
              <th className="p-3 font-medium">{t("review.grade")}</th>
              <th className="p-3 font-medium">{t("review.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {ordenadas.map((f) => (
              <tr key={f.id} className="align-top">
                <td className="p-3">{estudianteCelda(f)}</td>
                <td className="p-3">{materiaCelda(f)}</td>
                <td className="p-3 whitespace-nowrap">{notaCelda(f)}</td>
                <td className="p-3">{estadoDe(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < md: tarjetas */}
      <ul className="space-y-3 md:hidden">
        {ordenadas.map((f) => (
          <li key={f.id} className="space-y-2 rounded-card border border-linea bg-card p-4 shadow-card">
            {estudianteCelda(f)}
            <p>{materiaCelda(f)} · {notaCelda(f)}</p>
            {estadoDe(f)}
          </li>
        ))}
      </ul>

      {abierta ? (
        <NextIntlClientProvider messages={mensajes}>
          <AccionesCarga cargaId={carga.id} hayProblemas={conProblemas > 0} />
        </NextIntlClientProvider>
      ) : (
        <p className="texto-meta">{t(`review.closed.${carga.estado as "confirmada"}`)}</p>
      )}

      <Link href="/academico/universidades/calificaciones" className="text-sm font-medium text-marca-700 hover:underline">
        {t("review.back")}
      </Link>
    </div>
  );
}
