import type { Metadata } from "next";
import {
  CalendarClock,
  Library,
  Presentation,
  Search,
  Users,
  X,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { GestionProgramas } from "@/components/academias/gestion-programas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import {
  esEstadoAcademia,
  esTipoAcademia,
  ESTADOS_ACADEMIA,
  TIPOS_ACADEMIA,
} from "@/lib/academias";
import { requerirPermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import {
  catalogoAcademias,
  resumenAcademias,
} from "@/server/academias/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("academyPrograms.title") };
}

/**
 * Programas de academia: liderazgo, habilidades para la vida y lo que venga.
 *
 * `academico.leer` para entrar y `academico.escribir` para tocar, que son los
 * mismos permisos del catálogo académico. El docente tiene el primero y no el
 * segundo: consulta los programas y se descarga sus materiales, pero no cambia
 * el programa de nadie.
 *
 * Los filtros van en la URL, como en el resto del sistema, y la lista se
 * recorta en SQL.
 *
 * Las cifras salen de una consulta agregada aparte: la de participantes suma
 * solo los programas ACTIVOS, porque los de un programa que terminó son su
 * histórico y no gente a la que haya que dar clase esta semana.
 */
export default async function PaginaAcademiasProgramas({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string }>;
}) {
  const { locale } = await params;
  const { q, tipo, estado } = await searchParams;

  const usuario = await requerirPermiso("academico.leer");

  const busqueda = (q ?? "").trim().slice(0, 80);
  // Los desplegables se pueden reescribir en la URL: lo que no esté en la lista
  // se ignora en vez de llegar al SQL.
  const tipoOk = tipo && esTipoAcademia(tipo) ? tipo : null;
  const estadoOk = estado && esEstadoAcademia(estado) ? estado : null;

  const filtro = { busqueda, tipo: tipoOk, estado: estadoOk };

  const [t, academias, resumen, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "academies" }),
    catalogoAcademias(filtro),
    resumenAcademias(filtro),
    mensajesCliente(["academies"]),
  ]);

  const hayFiltro = Boolean(busqueda || tipoOk || estadoOk);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Presentation className="size-5 text-[#2096BA]" />
          {t("programs.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("programs.description")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={resumen.total}
          etiqueta={t("programs.stats.total")}
          icono={Presentation}
        />
        <CifraAcademica
          valor={resumen.activas}
          etiqueta={t("programs.stats.active")}
          icono={Library}
          acento
        />
        <CifraAcademica
          valor={resumen.planificadas}
          etiqueta={t("programs.stats.planned")}
          icono={CalendarClock}
        />
        <CifraAcademica
          valor={resumen.participantes}
          etiqueta={t("programs.stats.participants")}
          icono={Users}
        />
      </div>

      {/* Se dice en la pantalla y no solo en el código: los participantes son un
          número que alguien teclea. No hay tabla de inscripción a una academia,
          así que no hay de dónde contarlos, y una cifra que parece calculada y
          no lo es acaba usándose para decidir. */}
      <p className="text-muted-foreground text-xs">
        {t("programs.participantsWarning")}
      </p>

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
            placeholder={t("programs.searchPlaceholder")}
            maxLength={80}
          />
        </div>

        <div className="min-w-36 space-y-1.5">
          <label
            htmlFor="tipo"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.type")}
          </label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={tipoOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allTypes")}</option>
            {TIPOS_ACADEMIA.map((valor) => (
              <option key={valor} value={valor}>
                {t(`type.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-36 space-y-1.5">
          <label
            htmlFor="estado"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.state")}
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={estadoOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allStates")}</option>
            {ESTADOS_ACADEMIA.map((valor) => (
              <option key={valor} value={valor}>
                {t(`state.${valor}`)}
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
            <Link href="/academias/programas">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      <NextIntlClientProvider messages={mensajes}>
        <GestionProgramas
          academias={academias}
          puedeEscribir={tienePermiso(usuario.rol, "academico.escribir")}
          hayFiltro={hayFiltro}
        />
      </NextIntlClientProvider>
    </div>
  );
}
