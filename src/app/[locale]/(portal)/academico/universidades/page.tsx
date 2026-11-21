import type { Metadata } from "next";
import { ChevronRight, Landmark, ScanSearch } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { LogoUniversidad } from "@/components/universidades/logo-universidad";
import { FormUniversidad } from "@/components/universidades/formularios";
import { Badge } from "@/components/ui/badge";
import { variantesBoton } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { universidadesCatalogo } from "@/server/universidades/consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });

  return { title: t("title") };
}

/**
 * Catálogo de universidades. Entra quien lee lo académico; crea y edita quien
 * tiene `catalogo.escribir`. Es la raíz de universidad → carrera → pénsum.
 */
export default async function PaginaUniversidades({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const usuario = await requerirPermiso("catalogo.leer");
  const [t, universidades, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "catalog" }),
    universidadesCatalogo(),
    mensajesCliente(["catalog"]),
  ]);
  const puedeEscribir = usuarioTienePermiso(usuario, "catalogo.escribir");

  return (
    <div className="animate-entrada mx-auto max-w-4xl space-y-6">
      <EncabezadoPagina
        titulo={t("title")}
        acciones={
          usuarioTienePermiso(usuario, "expedientes.escribir") ? (
            <Link href="/academico/universidades/calificaciones" className={variantesBoton({ size: "sm" })}>
              <ScanSearch className="size-4" />
              {t("upload.open")}
            </Link>
          ) : undefined
        }
      />

      {puedeEscribir && (
        <NextIntlClientProvider messages={mensajes}>
          <FormUniversidad />
        </NextIntlClientProvider>
      )}

      {universidades.length === 0 ? (
        <EstadoVacio icono={Landmark} titulo={t("university.empty")} />
      ) : (
        <ul className="divide-y divide-linea rounded-card border border-linea bg-card">
          {universidades.map((u) => (
            <li key={u.id}>
              <Link href={`/academico/universidades/${u.id}`} className="flex items-center gap-3 p-4 hover:bg-muted">
                <LogoUniversidad siglas={u.siglas} url={u.logo} className="size-12" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{u.siglas}</span>
                  <span className="texto-meta block truncate">{u.nombre}</span>
                </span>
                <span className="texto-meta hidden sm:block">
                  {t("university.counts", { careers: u.carreras, students: u.estudiantes })}
                </span>
                <Badge variant="neutra">{t(`regime.${u.regimen}`)}</Badge>
                {!u.activa && <Badge variant="neutra">{t("status.inactive")}</Badge>}
                <ChevronRight className="size-4 shrink-0 text-tinta-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
