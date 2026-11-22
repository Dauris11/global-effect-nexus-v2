import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LogoUniversidad } from "@/components/universidades/logo-universidad";
import { FormCarrera, FormUniversidad } from "@/components/universidades/formularios";
import { MenuExportar } from "@/components/compartido/menu-exportar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { textoDePuntos } from "@/lib/indice-academico";
import { usuarioTienePermiso } from "@/lib/rbac";
import { carrerasDeUniversidad, universidadPorId } from "@/server/universidades/consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const u = UUID.test(id) ? await universidadPorId(id) : null;

  return { title: u?.siglas ?? "—" };
}

/** Una universidad: su régimen y sus carreras. Cada carrera lleva a sus pénsums. */
export default async function PaginaUniversidad({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const usuario = await requerirPermiso("catalogo.leer");
  const universidad = UUID.test(id) ? await universidadPorId(id) : null;

  if (!universidad) notFound();

  const [t, te, carreras, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "export" }),
    carrerasDeUniversidad(id),
    mensajesCliente(["catalog"]),
  ]);
  const puedeEscribir = usuarioTienePermiso(usuario, "catalogo.escribir");

  return (
    <div className="animate-entrada mx-auto max-w-4xl space-y-6">
      <EncabezadoPagina
        titulo={`${universidad.siglas} · ${universidad.nombre}`}
        acciones={
          <>
            {usuarioTienePermiso(usuario, "expedientes.leer") && (
              <MenuExportar
                documentos={[
                  { tipo: "estudiantes-universidad", etiqueta: te("docs.studentsUniversity"), params: { id: universidad.id } },
                  { tipo: "notas-universidad", etiqueta: te("docs.gradesUniversity"), params: { id: universidad.id } },
                ]}
              />
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/academico/universidades">
                <ChevronLeft className="size-4" />
                {t("back")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <LogoUniversidad siglas={universidad.siglas} url={universidad.logo} className="size-14" />
        <Badge variant="neutra">{t(`regime.${universidad.regimen}`)}</Badge>
        {!universidad.activa && <Badge variant="neutra">{t("status.inactive")}</Badge>}
        <Badge variant={universidad.reglas_confirmadas ? "marca" : "neutra"}>
          {universidad.reglas_confirmadas ? t("rules.confirmedBadge") : t("rules.pendingBadge")}
        </Badge>
      </div>

      <p className="texto-meta">
        {t("rules.summary", {
          points: textoDePuntos(universidad.puntos_por_letra),
          min: universidad.letra_minima_aprobar,
          withdrawn: universidad.retirada_cuenta_en_divisor ? t("rules.withdrawnYes") : t("rules.withdrawnNo"),
          rounding: universidad.redondeo_indice === "truncar" ? t("rules.truncate") : t("rules.round"),
        })}
      </p>

      {puedeEscribir && (
        <NextIntlClientProvider messages={mensajes}>
          <div className="flex flex-wrap gap-2">
            <FormCarrera universidadId={id} />
            <FormUniversidad universidad={universidad} />
          </div>
        </NextIntlClientProvider>
      )}

      <h2 className="texto-titulo-seccion">{t("career.title")}</h2>
      {carreras.length === 0 ? (
        <EstadoVacio icono={GraduationCap} titulo={t("career.empty")} />
      ) : (
        <ul className="divide-y divide-linea rounded-card border border-linea bg-card">
          {carreras.map((c) => (
            <li key={c.id}>
              <Link href={`/academico/universidades/carreras/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-muted">
                <span className="min-w-0 flex-1 font-semibold">{c.nombre}</span>
                <span className="texto-meta hidden sm:block">
                  {t("career.counts", { pensums: c.pensums, students: c.estudiantes })}
                </span>
                {!c.activa && <Badge variant="neutra">{t("status.inactive")}</Badge>}
                <ChevronRight className="size-4 shrink-0 text-tinta-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
