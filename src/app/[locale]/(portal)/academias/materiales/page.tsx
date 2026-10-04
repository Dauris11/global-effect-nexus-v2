import type { Metadata } from "next";
import { FileText, Library, Link2, Presentation, Search, X } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { GestionMateriales } from "@/components/academias/gestion-materiales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import {
  esTipoMaterialAcademia,
  TIPOS_MATERIAL_ACADEMIA,
} from "@/lib/academias";
import { requerirPermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import {
  academiasParaSelector,
  materialesDeAcademias,
  resumenMateriales,
} from "@/server/academias/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("academyMaterials.title") };
}

/**
 * Materiales de las academias: guías, presentaciones, vídeos y enlaces.
 *
 * `academico.leer` para entrar y `academico.escribir` para subir o borrar. El
 * docente tiene el primero: se descarga el material de la academia que va a
 * dar, y no lo cambia.
 *
 * Los archivos viven en el bucket **privado** (`documentos`), el mismo de las
 * entregas y las fichas escaneadas. Por eso no hay URL que se pueda guardar ni
 * pintar: la descarga es un botón que firma un enlace de diez minutos al
 * pulsarlo, y comprueba el permiso en ese momento. Ver `descargarMaterial`.
 *
 * No hay tope de página como en otras listas: la consulta trae 300 y punto. Un
 * repositorio de materiales se recorre entero por programa, y una paginación
 * sobre un catálogo agrupado escondería medio programa sin decirlo.
 */
export default async function PaginaAcademiasMateriales({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; academia?: string; tipo?: string }>;
}) {
  const { locale } = await params;
  const { q, academia, tipo } = await searchParams;

  const usuario = await requerirPermiso("academico.leer");

  const busqueda = (q ?? "").trim().slice(0, 80);
  // Un id que no sea un UUID se ignora en vez de llegar al SQL, donde el
  // `::uuid` daría un error de sintaxis y una página en blanco.
  const academiaOk = academia && UUID.test(academia) ? academia : null;
  const tipoOk = tipo && esTipoMaterialAcademia(tipo) ? tipo : null;

  const filtro = { busqueda, academiaId: academiaOk, tipo: tipoOk };

  const [t, materiales, resumen, academias, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "academies" }),
    materialesDeAcademias(filtro),
    resumenMateriales(filtro),
    academiasParaSelector(),
    mensajesCliente(["academies"]),
  ]);

  const hayFiltro = Boolean(busqueda || academiaOk || tipoOk);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Library className="size-5 text-[#2096BA]" />
          {t("materials.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("materials.description")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={resumen.total}
          etiqueta={t("materials.stats.total")}
          icono={Library}
          acento
        />
        <CifraAcademica
          valor={resumen.archivos}
          etiqueta={t("materials.stats.files")}
          icono={FileText}
        />
        <CifraAcademica
          valor={resumen.enlaces}
          etiqueta={t("materials.stats.links")}
          icono={Link2}
        />
        <CifraAcademica
          valor={resumen.academias}
          etiqueta={t("materials.stats.programs")}
          icono={Presentation}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        {t("materials.privacyHint")}
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
            placeholder={t("materials.searchPlaceholder")}
            maxLength={80}
          />
        </div>

        <div className="min-w-40 space-y-1.5">
          <label
            htmlFor="academia"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.program")}
          </label>
          <select
            id="academia"
            name="academia"
            defaultValue={academiaOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allPrograms")}</option>
            {academias.map((fila) => (
              <option key={fila.id} value={fila.id}>
                {fila.nombre}
              </option>
            ))}
          </select>
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
            {TIPOS_MATERIAL_ACADEMIA.map((valor) => (
              <option key={valor} value={valor}>
                {t(`materialType.${valor}`)}
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
            <Link href="/academias/materiales">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      <NextIntlClientProvider messages={mensajes}>
        <GestionMateriales
          materiales={materiales}
          academias={academias}
          puedeEscribir={tienePermiso(usuario.rol, "academico.escribir")}
          hayFiltro={hayFiltro}
        />
      </NextIntlClientProvider>
    </div>
  );
}
