import type { Metadata } from "next";
import { Library, Search, X } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionMaterias } from "@/components/academico/gestion-materias";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import {
  docentesAsignables,
  hayMasQueElTope,
  materiasGestionadas,
  periodosSimples,
  recortarAlTope,
} from "@/server/academico/consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("academicSubjects.title") };
}

/**
 * Catálogo de materias universitarias.
 *
 * El filtro y la búsqueda viven en la URL (`?q=` y `?periodo=`) y no en estado
 * de cliente, igual que en las calificaciones del estudiante: así la pantalla
 * sigue siendo de servidor, el enlace se puede compartir o recargar sin perder
 * lo que se estaba mirando, y la lista se recorta en SQL en vez de traerse el
 * catálogo entero para esconder la mayoría.
 *
 * La barra de filtros es un `form method="get"` de toda la vida: funciona sin
 * JavaScript y el navegador ya sabe componer la URL. No hace falta nada más.
 *
 * El `periodo` de la URL se valida como UUID antes de llegar al SQL. No es solo
 * por seguridad —va parametrizado— sino porque `$1::uuid` con una cadena que no
 * lo es revienta la consulta, y un enlace viejo o mal copiado no debe tumbar la
 * pantalla: se ignora el filtro y se enseña el catálogo entero.
 */
export default async function PaginaAcademicoMaterias({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; periodo?: string }>;
}) {
  const { locale } = await params;
  const { q, periodo } = await searchParams;

  const usuario = await requerirPermiso("academico.leer");

  const busqueda = (q ?? "").trim().slice(0, 80);
  const periodoId = UUID.test(periodo ?? "") ? periodo! : null;

  const [t, filas, periodos, docentes, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "academic" }),
    materiasGestionadas({ periodoId, busqueda }),
    periodosSimples(),
    docentesAsignables(),
    mensajesCliente(["academic"]),
  ]);

  const hayFiltro = Boolean(busqueda) || Boolean(periodoId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Library className="size-5 text-[#2096BA]" />
          {t("subjects.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("subjects.description")}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1.5">
          <label
            htmlFor="q"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("search")}
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder={t("subjects.searchPlaceholder")}
            maxLength={80}
          />
        </div>

        <div className="min-w-44 space-y-1.5">
          <label
            htmlFor="periodo"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("subject.term")}
          </label>
          <select
            id="periodo"
            name="periodo"
            defaultValue={periodoId ?? ""}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
          >
            <option value="">{t("allTerms")}</option>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="submit"
          className="transition-transform duration-150 active:scale-95"
        >
          <Search className="size-4" />
          {t("apply")}
        </Button>

        {hayFiltro && (
          <Button asChild variant="ghost">
            <Link href="/academico/materias">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      <NextIntlClientProvider messages={mensajes}>
        <GestionMaterias
          materias={recortarAlTope(filas)}
          periodos={periodos}
          docentes={docentes}
          puedeEscribir={tienePermiso(usuario.rol, "academico.escribir")}
          hayMas={hayMasQueElTope(filas)}
          hayFiltro={hayFiltro}
        />
      </NextIntlClientProvider>
    </div>
  );
}
