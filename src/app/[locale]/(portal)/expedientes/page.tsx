import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  FiltrosExpedientes,
  SelectorVista,
} from "@/components/expedientes/filtros-expedientes";
import { FormularioExpediente } from "@/components/expedientes/formulario-expediente";
import { ListaExpedientes } from "@/components/expedientes/lista-expedientes";
import { TarjetasExpedientes } from "@/components/expedientes/tarjetas-expedientes";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requerirPermiso } from "@/lib/auth";
import {
  ASISTIO_REUNION,
  BANO,
  CASA_PROPIA,
  ENVIO_CORREO,
  ESTADOS_ESTUDIANTE,
  GENEROS,
  PARENTESCOS,
} from "@/lib/expedientes";
import {
  enlaceExpedientes,
  hayFiltros,
  leerConsultaExpedientes,
} from "@/lib/filtros-expedientes";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  cifrasExpedientes,
  contarExpedientes,
  listaExpedientes,
  universidadesDeExpedientes,
} from "@/server/expedientes/consultas";

/** Filas por página. */
const POR_PAGINA = 20;

/** Las seis secciones del formulario, en el orden en que se recorren. */
const SECCIONES = [
  "identity",
  "academic",
  "family",
  "housing",
  "health",
  "social",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "records" });

  return { title: t("title") };
}

/**
 * Expedientes: la lista y el formulario de alta.
 *
 * Filtros, orden, vista (tarjetas o lista) y página viven en la URL
 * (`lib/filtros-expedientes.ts`); la foto de cada estudiante se ve en las dos
 * vistas.
 *
 * Entra quien tenga `expedientes.leer`: administración y `super_admin`. El
 * permiso se comprueba aquí y no por rol: si otro rol gana la lectura, se le
 * da en la base y aquí no hay que tocar nada.
 */
export default async function PaginaExpedientes({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const consulta = leerConsultaExpedientes(await searchParams);
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirPermiso("expedientes.leer");
  const puedeEscribir = usuarioTienePermiso(usuario, "expedientes.escribir");
  const t = await getTranslations({ locale, namespace: "records" });

  const filtros = {
    busqueda: consulta.busqueda,
    estado: consulta.estado,
    universidad: consulta.universidad,
    situacion: consulta.situacion,
  };

  const [cifras, filas, total, universidades] = await Promise.all([
    cifrasExpedientes(),
    listaExpedientes({
      ...filtros,
      orden: consulta.orden,
      pagina: consulta.pagina,
      porPagina: POR_PAGINA,
    }),
    contarExpedientes(filtros),
    universidadesDeExpedientes(),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="animate-entrada space-y-6">
      <EncabezadoPagina
        titulo={t("title")}
        acciones={
          puedeEscribir && (
            <FormularioExpediente
              textos={{
                nuevo: t("new"),
                titulo: t("form.title"),
                guardar: t("form.save"),
                guardando: t("form.saving"),
                error: t("form.error"),
                faltaNombre: t("form.faltaNombreSeccion"),
                cancelar: t("form.cancel"),
                opcional: t("field.optional"),
                pestanas: Object.fromEntries(
                  SECCIONES.map((clave) => [clave, t(`tab.${clave}`)]),
                ),
                campos: {
                  name: t("field.name"),
                  idCard: t("field.idCard"),
                  email: t("field.email"),
                  phone: t("field.phone"),
                  birthDate: t("field.birthDate"),
                  birthPlace: t("field.birthPlace"),
                  nationality: t("field.nationality"),
                  gender: t("field.gender"),
                  sexDocument: t("field.sexDocument"),
                  religion: t("field.religion"),
                  status: t("field.status"),
                  program: t("field.program"),
                  whereStudies: t("field.whereStudies"),
                  university: t("field.university"),
                  entryDate: t("field.entryDate"),
                  school: t("field.school"),
                  schoolDirector: t("field.schoolDirector"),
                  facilitator: t("field.facilitator"),
                  habitudesStory: t("field.habitudesStory"),
                  livesWith: t("field.livesWith"),
                  whyLivesWith: t("field.whyLivesWith"),
                  siblings: t("field.siblings"),
                  ownHouse: t("field.ownHouse"),
                  houseType: t("field.houseType"),
                  bathroom: t("field.bathroom"),
                  rooms: t("field.rooms"),
                  beds: t("field.beds"),
                  whoSleeps: t("field.whoSleeps"),
                  address: t("field.address"),
                  community: t("field.community"),
                  city: t("field.city"),
                  illnesses: t("field.illnesses"),
                  allergies: t("field.allergies"),
                  emergencyName: t("field.emergencyName"),
                  emergencyPhone: t("field.emergencyPhone"),
                  lifeStory: t("field.lifeStory"),
                  familySituation: t("field.familySituation"),
                  economicSituation: t("field.economicSituation"),
                  scholarshipReason: t("field.scholarshipReason"),
                  academicGoals: t("field.academicGoals"),
                  sponsorEmail: t("field.sponsorEmail"),
                  monthlyMeeting: t("field.monthlyMeeting"),
                  warnings: t("field.warnings"),
                  pendingRequests: t("field.pendingRequests"),
                  notes: t("field.notes"),
                },
                familia: {
                  name: t("family.name"),
                  age: t("family.age"),
                  phone: t("family.phone"),
                  occupation: t("family.occupation"),
                },
                parentescos: Object.fromEntries(
                  PARENTESCOS.map((clave) => [clave, t(`relation.${clave}`)]),
                ),
                estados: Object.fromEntries(
                  ESTADOS_ESTUDIANTE.map((clave) => [
                    clave,
                    t(`status.${clave}`),
                  ]),
                ),
                generos: Object.fromEntries(
                  GENEROS.map((clave) => [clave, t(`gender.${clave}`)]),
                ),
                casa: Object.fromEntries(
                  CASA_PROPIA.map((clave) => [clave, t(`house.${clave}`)]),
                ),
                bano: Object.fromEntries(
                  BANO.map((clave) => [clave, t(`bathroom.${clave}`)]),
                ),
                seguimiento: Object.fromEntries(
                  [...new Set([...ENVIO_CORREO, ...ASISTIO_REUNION])].map(
                    (clave) => [clave, t(`followUp.${clave}`)],
                  ),
                ),
                ocr: {
                  title: t("ocr.title"),
                  upload: t("ocr.upload"),
                  processing: t("ocr.processing"),
                  extracted: t("ocr.extracted"),
                  confidence: t("ocr.confidence"),
                  reviewHint: t("ocr.reviewHint"),
                  replaceHint: t("ocr.replaceHint"),
                  notFound: t("ocr.notFound"),
                  unsupported: t("ocr.unsupported"),
                  fileTooLarge: t("ocr.fileTooLarge"),
                  noKey: t("ocr.noKey"),
                  error: t("ocr.error"),
                },
              }}
            />
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard variant="centrada" valor={cifras.total} etiqueta={t("stats.total")} />
        <StatCard variant="centrada" valor={cifras.activos} etiqueta={t("stats.active")} acento />
        <StatCard variant="centrada" valor={cifras.en_proceso} etiqueta={t("stats.inProcess")} />
        <StatCard variant="centrada" valor={cifras.graduados} etiqueta={t("stats.graduated")} />
      </div>

      <FiltrosExpedientes
        consulta={consulta}
        universidades={universidades}
        rutaBusqueda={idioma === "en" ? "/en/expedientes" : "/expedientes"}
      />

      {filas.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo={hayFiltros(consulta) ? t("noMatches") : t("empty")}
        />
      ) : (
        <>
          {/* Vista y paginación van arriba, no al final: es lo primero que se
              quiere cambiar al llegar, no lo último que se ve tras desplazar
              toda la lista. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="texto-meta">{t("count", { count: total })}</p>

            <div className="flex flex-wrap items-center gap-3">
              <SelectorVista consulta={consulta} />

              {totalPaginas > 1 && (
                <div className="flex items-center gap-2">
                  <PaginaBoton
                    href={enlaceExpedientes(consulta, { pagina: consulta.pagina - 1 })}
                    deshabilitado={consulta.pagina <= 1}
                    icono={ChevronLeft}
                    etiqueta={t("pagination.previous")}
                  />
                  <span className="texto-meta whitespace-nowrap">
                    {t("pagination.page", { current: consulta.pagina, total: totalPaginas })}
                  </span>
                  <PaginaBoton
                    href={enlaceExpedientes(consulta, { pagina: consulta.pagina + 1 })}
                    deshabilitado={consulta.pagina >= totalPaginas}
                    icono={ChevronRight}
                    etiqueta={t("pagination.next")}
                  />
                </div>
              )}
            </div>
          </div>

          {consulta.vista === "tarjetas" ? (
            <TarjetasExpedientes filas={filas} idioma={idioma} puedeEscribir={puedeEscribir} />
          ) : (
            <ListaExpedientes filas={filas} idioma={idioma} puedeEscribir={puedeEscribir} />
          )}
        </>
      )}
    </div>
  );
}

/** Flecha de paginación. Sin JavaScript: si está deshabilitada, ni siquiera es un enlace. */
function PaginaBoton({
  href,
  deshabilitado,
  icono: Icono,
  etiqueta,
}: {
  href: string;
  deshabilitado: boolean;
  icono: React.ComponentType<{ className?: string }>;
  etiqueta: string;
}) {
  if (deshabilitado) {
    return (
      <span className="flex size-11 items-center justify-center rounded-control border border-linea text-tinta-3/50">
        <Icono className="size-4" />
        <span className="sr-only">{etiqueta}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={etiqueta}
      className="flex size-11 items-center justify-center rounded-control border border-linea transition-colors hover:bg-muted"
    >
      <Icono className="size-4" />
    </Link>
  );
}
