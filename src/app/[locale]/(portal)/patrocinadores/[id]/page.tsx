import type { Metadata } from "next";
import { ChevronLeft, FileQuestion, Mail, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { InsigniaCarta } from "@/components/expedientes/detalle/insignia-carta";
import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { Badge } from "@/components/ui/badge";
import { variantesBoton } from "@/components/ui/button-variantes";
import { Card, CardContent } from "@/components/ui/card";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { MenuExportar } from "@/components/compartido/menu-exportar";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { ultimosDoceMeses } from "@/server/bienestar/consultas";
import { becadosDelPatrocinador, patrocinadorPorId } from "@/server/patrocinadores/detalle";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "sponsors" });
  const p = UUID.test(id) ? await patrocinadorPorId(id) : null;

  return { title: p ? p.nombre : t("detail.notFound") };
}

/**
 * Ficha de un patrocinador: quién es, cuánto aporta y, sobre todo, a QUÉ
 * ESTUDIANTES patrocina, con el enlace a cada expediente y el estado de su carta
 * de este mes. Es el eslabón que unía la lista de patrocinadores, las becas y los
 * expedientes, que hasta ahora no se llevaban entre sí.
 */
export default async function PaginaPatrocinador({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const usuario = await requerirPermiso("patrocinadores.leer");
  const [t, te, idiomaCrudo] = await Promise.all([getTranslations({ locale, namespace: "sponsors" }), getTranslations({ locale, namespace: "export" }), getLocale()]);
  const idioma = idiomaCrudo === "en" ? "en" : "es";

  const patrocinador = UUID.test(id) ? await patrocinadorPorId(id) : null;

  const volver = (
    <Link
      href="/patrocinadores"
      className={variantesBoton({ variant: "outline", size: "sm", className: "transition-transform hover:-translate-x-0.5" })}
    >
      <ChevronLeft className="size-4" />
      {t("detail.back")}
    </Link>
  );

  if (!patrocinador) {
    return (
      <div className="animate-entrada space-y-6">
        {volver}
        <EstadoVacio icono={FileQuestion} titulo={t("detail.notFound")} />
      </div>
    );
  }

  // El mes lo decide la base, no el reloj del servidor (que corre en UTC).
  const mes = (await ultimosDoceMeses())[0] ?? "";
  const becados = await becadosDelPatrocinador(patrocinador.id, mes);
  const vigentes = becados.filter((b) => b.activa);
  const dinero = new Intl.NumberFormat(idioma === "en" ? "en-US" : "es-DO", { style: "currency", currency: "USD" });
  const puedeCartas = usuarioTienePermiso(usuario, "patrocinadores.escribir");

  return (
    <div className="animate-entrada space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {volver}
        {puedeCartas && (
          <Link
            href="/patrocinadores/correos"
            className={variantesBoton({ variant: "outline", size: "sm" })}
          >
            <Mail className="size-4" />
            {t("detail.letters")}
          </Link>
        )}
      </div>

      <EncabezadoPagina
        titulo={patrocinador.nombre}
        acciones={usuarioTienePermiso(usuario, "expedientes.leer") ? <MenuExportar documentos={[{ tipo: "estudiantes-patrocinador", etiqueta: te("docs.sponsorStudents"), params: { id: patrocinador.id } }]} /> : undefined}
      />

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={patrocinador.estado === "activo" ? "marca" : "neutra"}>
              {t(`state.${patrocinador.estado}` as never)}
            </Badge>
            <Badge variant="neutra">{t(`type.${patrocinador.tipo}` as never)}</Badge>
            {patrocinador.pais && <Badge variant="neutra">{patrocinador.pais}</Badge>}
            <Badge variant="neutra">{patrocinador.idioma === "en" ? t("detail.langEn") : t("detail.langEs")}</Badge>
          </div>

          <FilaDatos>
            {patrocinador.email && <Dato icono={Mail}>{patrocinador.email}</Dato>}
            {patrocinador.telefono && <Dato icono={Phone}>{patrocinador.telefono}</Dato>}
          </FilaDatos>

          <p className="text-2xl font-bold">
            {dinero.format(patrocinador.monto_mensual)}{" "}
            <span className="texto-meta font-normal">{t("detail.perMonth")}</span>
          </p>

          {patrocinador.notas && <p className="texto-meta whitespace-pre-wrap">{patrocinador.notas}</p>}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("detail.students", { count: vigentes.length })}</p>

        {becados.length === 0 ? (
          <EstadoVacio icono={FileQuestion} titulo={t("detail.noStudents")} />
        ) : (
          <ul className="space-y-3">
            {becados.map((b) => (
              <li key={`${b.estudiante_id}-${b.desde}`}>
                <Card className={TARJETA.contenido}>
                  <CardContent className="flex flex-wrap items-center gap-4 pt-5">
                    <FotoEstudiante
                      nombre={b.nombre}
                      url={urlDeAvatar(b.foto_url)}
                      className="size-14 rounded-full"
                      aviso="punto"
                      textoSinFoto=""
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/expedientes/${b.estudiante_id}`}
                        className="text-marca-700 hover:text-marca-600 text-[15px] font-semibold break-words"
                      >
                        {b.nombre}
                      </Link>
                      <p className="texto-meta">
                        {[b.programa, b.universidad].filter(Boolean).join(" · ") || "—"}
                        {b.grupo ? ` · ${t("detail.group", { n: b.grupo })}` : ""}
                      </p>
                      <p className="texto-meta">
                        {dinero.format(b.monto)} · {t("detail.since", { date: fechaCorta(b.desde, idioma) })}
                        {b.hasta ? ` · ${t("detail.until", { date: fechaCorta(b.hasta, idioma) })}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant={b.activa ? "marca" : "neutra"}>
                        {b.activa ? t("detail.current") : t("detail.ended")}
                      </Badge>
                      {b.activa && (
                        <div className="flex items-center gap-1.5">
                          <span className="texto-meta">{t("detail.letterOf", { month: mes })}</span>
                          <InsigniaCarta estado={b.carta} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
