import type { Metadata } from "next";
import { Building2, Globe, HandCoins, Search, Users, X } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { GestionPatrocinadores } from "@/components/patrocinadores/gestion-patrocinadores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import {
  directorioPatrocinadores,
  hayMasPatrocinadores,
  recortarPatrocinadores,
  resumenDePatrocinio,
} from "@/server/patrocinadores/consultas";

const TIPOS = ["persona", "empresa", "iglesia", "ong", "otro"] as const;
const ESTADOS = ["activo", "inactivo"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sponsors" });

  return { title: t("title") };
}

/**
 * Directorio de patrocinadores.
 *
 * `patrocinadores.leer` para entrar, `patrocinadores.escribir` para tocar.
 * `contabilidad` tiene el primero y no el segundo: ve el directorio y los
 * aportes comprometidos —los necesita para cuadrar— pero no cambia con quién
 * tiene la Fundación un acuerdo.
 *
 * Los filtros van en la URL, como en el resto del sistema: el enlace se
 * comparte, se recarga sin perder lo que se miraba, y la lista se recorta en
 * SQL en vez de traerla entera para esconder la mayoría.
 *
 * Las cifras de cabecera salen de una consulta agregada aparte y no de contar
 * las filas visibles: la lista está topada en 200 y un "aporte mensual" sumado
 * sobre las 200 primeras por orden alfabético no sería el aporte de nadie.
 */
export default async function PaginaPatrocinadores({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string }>;
}) {
  const { locale } = await params;
  const { q, tipo, estado } = await searchParams;

  const usuario = await requerirPermiso("patrocinadores.leer");

  const busqueda = (q ?? "").trim().slice(0, 80);
  // Los desplegables se pueden manipular en la URL: lo que no esté en la lista
  // se ignora en vez de llegar al SQL.
  const tipoOk = TIPOS.includes(tipo as (typeof TIPOS)[number]) ? tipo! : null;
  const estadoOk = ESTADOS.includes(estado as (typeof ESTADOS)[number])
    ? estado!
    : null;

  const filtros = { busqueda, tipo: tipoOk, estado: estadoOk };

  const [t, filas, resumen, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "sponsors" }),
    directorioPatrocinadores(filtros),
    resumenDePatrocinio(filtros),
    mensajesCliente(["sponsors"]),
  ]);

  const hayFiltro = Boolean(busqueda || tipoOk || estadoOk);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <HandCoins className="size-5 text-[#2096BA]" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={resumen.total}
          etiqueta={t("stats.total")}
          icono={Building2}
        />
        <CifraAcademica
          valor={resumen.activos}
          etiqueta={t("stats.active")}
          icono={Users}
        />
        <CifraAcademica
          valor={resumen.paises}
          etiqueta={t("stats.countries")}
          icono={Globe}
        />
        <CifraAcademica
          valor={new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(resumen.aporte)}
          etiqueta={t("stats.monthly")}
          icono={HandCoins}
          acento
        />
      </div>

      <p className="text-muted-foreground text-xs">{t("monthlyHint")}</p>

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
            placeholder={t("searchPlaceholder")}
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
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
          >
            <option value="">{t("allTypes")}</option>
            {TIPOS.map((valor) => (
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
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
          >
            <option value="">{t("allStates")}</option>
            {ESTADOS.map((valor) => (
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
            <Link href="/patrocinadores">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      <NextIntlClientProvider messages={mensajes}>
        <GestionPatrocinadores
          patrocinadores={recortarPatrocinadores(filas)}
          puedeEscribir={tienePermiso(usuario.rol, "patrocinadores.escribir")}
          hayMas={hayMasPatrocinadores(filas)}
          hayFiltro={hayFiltro}
        />
      </NextIntlClientProvider>
    </div>
  );
}
