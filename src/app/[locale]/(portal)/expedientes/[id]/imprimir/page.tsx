import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { BotonImprimir } from "@/components/compartido/boton-imprimir";
import { textoAntiguedad } from "@/components/expedientes/detalle/antiguedad-texto";
import { Filas, Seccion, Vacio } from "@/components/expedientes/detalle/ficha";
import { FichaFamilia, FichaInformacion, FichaPerfil, FichaSalud } from "@/components/expedientes/detalle/fichas";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { registrar } from "@/lib/auditoria";
import { requerirPermiso } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { indiceDelEstudiante } from "@/server/academico/indice";
import { obtenerExpediente } from "@/server/expedientes/consultas";
import { catalogoDelEstudiante, recordNativoDelEstudiante } from "@/server/universidades/consultas";
import { FileQuestion } from "lucide-react";

const HOJAS = ["ficha", "record", "avance"] as const;

type Hoja = (typeof HOJAS)[number];

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const [t, e] = await Promise.all([getTranslations({ locale, namespace: "export" }), obtenerExpediente(id)]);

  return { title: e ? `${t("sheetsTitle")} · ${e.nombre}` : t("sheetsTitle") };
}

/**
 * Hojas para imprimir o guardar en PDF de un expediente: la ficha completa, el récord de
 * notas por cuatrimestre y el avance en el plan de estudios. La pantalla es la misma que
 * se imprime: el menú y los botones no salen en el papel (`no-imprimir`) y la hoja lleva
 * logo, nombre y fecha.
 */
export default async function PaginaImprimirExpediente({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ hoja?: string }>;
}) {
  const { locale, id } = await params;
  const { hoja: pedida } = await searchParams;
  const usuario = await requerirPermiso("expedientes.leer");
  const [t, idiomaCrudo] = await Promise.all([getTranslations({ locale, namespace: "export" }), getLocale()]);
  const tr = await getTranslations({ locale, namespace: "records" });
  const idioma = idiomaCrudo === "en" ? "en" : "es";
  const e = await obtenerExpediente(id);

  if (!e) {
    return <EstadoVacio icono={FileQuestion} titulo={tr("detail.notFound")} />;
  }

  const hoja: Hoja = (HOJAS as readonly string[]).includes(pedida ?? "") ? (pedida as Hoja) : "ficha";
  const [catalogo, record, indice] = await Promise.all([catalogoDelEstudiante(id), recordNativoDelEstudiante(id), indiceDelEstudiante(id)]);
  const nota = (n: number | null) => (n === null ? "—" : n.toFixed(2));

  await registrar({ usuarioId: usuario.id, accion: "expediente.impreso", entidad: "estudiante", entidadId: e.id, datos: { hoja } });

  const datosAcademicos = (
    <Seccion titulo={t("student")}>
      <Filas
        filas={[
          { etiqueta: tr("field.name"), valor: e.nombre },
          { etiqueta: tr("field.idCard"), valor: e.cedula },
          { etiqueta: t("university"), valor: catalogo.universidad?.nombre },
          { etiqueta: t("career"), valor: catalogo.carrera?.nombre },
          { etiqueta: t("matricula"), valor: catalogo.matricula },
          { etiqueta: t("status"), valor: tr(`status.${e.estado}` as never) },
        ]}
      />
    </Seccion>
  );

  return (
    <div className="animate-entrada space-y-6">
      <h1 className="solo-imprimir text-xl font-semibold">{`${t(`sheet.${hoja}`)} · ${e.nombre}`}</h1>

      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/expedientes/${e.id}`}>
            <ArrowLeft className="size-4" />
            {t("backToRecord")}
          </Link>
        </Button>
        <BotonImprimir />
      </div>

      <nav aria-label={t("sheetsTitle")} className="no-imprimir flex flex-wrap gap-2">
        {HOJAS.map((h) => (
          <Link
            key={h}
            href={`/expedientes/${e.id}/imprimir?hoja=${h}`}
            aria-current={h === hoja ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              h === hoja ? "border-marca-500 bg-marca-50 text-marca-700" : "border-linea text-tinta-2 hover:bg-muted",
            )}
          >
            {t(`sheet.${h}`)}
          </Link>
        ))}
      </nav>

      {hoja === "ficha" && (
        <>
          <FichaInformacion e={e} tiempo={textoAntiguedad(e.fecha_ingreso, (k, v) => tr(k as never, v as never), idioma)} />
          <FichaPerfil e={e} />
          <FichaFamilia e={e} />
          <FichaSalud e={e} />
        </>
      )}

      {hoja === "record" && (
        <>
          {datosAcademicos}
          {record ? (
            <>
              <p className="text-sm font-medium">
                {t("cumulativeIndex")}: {nota(indice)}
              </p>
              {[...record.periodos].reverse().map((p) => (
                <section key={p.periodo} className="no-partir space-y-2">
                  <h2 className="text-base font-semibold">
                    {p.periodo} <span className="texto-meta font-normal">· {t("periodIndex")}: {nota(p.indice)} · {t("credits")}: {p.creditos}</span>
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-linea text-left text-xs text-tinta-3">
                        <th className="w-24 py-1.5 font-medium">{t("code")}</th>
                        <th className="py-1.5 font-medium">{t("subject")}</th>
                        <th className="w-16 py-1.5 text-right font-medium">{t("credits")}</th>
                        <th className="w-16 py-1.5 text-center font-medium">{t("grade")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-linea">
                      {p.intentos.map((i) => (
                        <tr key={i.id}>
                          <td className="py-1.5 tabular-nums">{i.codigo}</td>
                          <td className="py-1.5 pr-2">{i.nombre}</td>
                          <td className="py-1.5 text-right tabular-nums">{i.creditos}</td>
                          <td className="py-1.5 text-center font-medium">{i.letra}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </>
          ) : (
            <Vacio>{t("noRecord")}</Vacio>
          )}
        </>
      )}

      {hoja === "avance" && (
        <>
          {datosAcademicos}
          {catalogo.pensum ? (
            <>
              <p className="text-sm font-medium">
                {t("progressSummary", {
                  approved: catalogo.creditosAprobados,
                  total: catalogo.creditosTotales,
                  percent: catalogo.creditosTotales > 0 ? Math.round((catalogo.creditosAprobados / catalogo.creditosTotales) * 100) : 0,
                })}
                {indice !== null && ` · ${t("cumulativeIndex")}: ${nota(indice)}`}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-linea text-left text-xs text-tinta-3">
                    <th className="w-12 py-1.5 font-medium">{t("period")}</th>
                    <th className="w-24 py-1.5 font-medium">{t("code")}</th>
                    <th className="py-1.5 font-medium">{t("subject")}</th>
                    <th className="w-14 py-1.5 text-right font-medium">{t("credits")}</th>
                    <th className="w-14 py-1.5 text-center font-medium">{t("grade")}</th>
                    <th className="w-24 py-1.5 font-medium">{t("state")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {[...catalogo.materias]
                    .sort((a, b) => (a.periodo_sugerido ?? 99) - (b.periodo_sugerido ?? 99) || a.codigo.localeCompare(b.codigo))
                    .map((m) => (
                      <tr key={m.id} className="no-partir">
                        <td className="py-1.5 tabular-nums">{m.periodo_sugerido ?? "—"}</td>
                        <td className="py-1.5 tabular-nums">{m.codigo}</td>
                        <td className="py-1.5 pr-2">{m.nombre}</td>
                        <td className="py-1.5 text-right tabular-nums">{m.creditos}</td>
                        <td className="py-1.5 text-center font-medium">{m.letra ?? "—"}</td>
                        <td className="py-1.5">{t(`subjectState.${m.estado}`)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          ) : (
            <Vacio>{t("noPlan")}</Vacio>
          )}
        </>
      )}
    </div>
  );
}
