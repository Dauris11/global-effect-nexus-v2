import type { Metadata } from "next";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
  PencilLine,
  Search,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FormularioExpediente } from "@/components/expedientes/formulario-expediente";
import { PrevisualizarExpediente } from "@/components/expedientes/previsualizar-expediente";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requerirPermiso } from "@/lib/auth";
import {
  esEstadoEstudiante,
  ESTADOS_ESTUDIANTE,
  GENEROS,
  PARENTESCOS,
  visualDeEstado,
  ASISTIO_REUNION,
  BANO,
  CASA_PROPIA,
  ENVIO_CORREO,
} from "@/lib/expedientes";
import { usuarioTienePermiso } from "@/lib/rbac";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { cn } from "@/lib/utils";
import {
  cifrasExpedientes,
  contarExpedientes,
  listaExpedientes,
  type FilaExpediente,
} from "@/server/expedientes/consultas";

/** Filas por página. */
const POR_PAGINA = 20;

const VISTAS = ["tarjetas", "lista"] as const;
type Vista = (typeof VISTAS)[number];

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
 * La lista consulta de verdad. El formulario es la pantalla completa —seis
 * secciones, unos setenta campos y la zona de OCR— pero todavía no guarda: una
 * sola alta escribe en seis tablas (`estudiante` y los cinco perfiles) y esa
 * transacción es el trabajo de S5. La pantalla lo dice antes de que nadie empiece
 * a rellenar.
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
  searchParams: Promise<{
    q?: string;
    estado?: string;
    vista?: string;
    pagina?: string;
  }>;
}) {
  const { locale } = await params;
  const {
    q,
    estado: estadoPedido,
    vista: vistaPedida,
    pagina: paginaPedida,
  } = await searchParams;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirPermiso("expedientes.leer");
  const puedeEscribir = usuarioTienePermiso(usuario, "expedientes.escribir");
  const t = await getTranslations({ locale, namespace: "records" });

  // Un valor desconocido en la URL se ignora: llega de un enlace que puede
  // haberse quedado viejo, no de un error que haya que anunciar.
  const estado = esEstadoEstudiante(estadoPedido) ? estadoPedido : null;
  const busqueda = q?.trim() ? q.trim() : null;
  const vista: Vista = vistaPedida === "lista" ? "lista" : "tarjetas";

  const paginaNumero = Number(paginaPedida);
  const pagina =
    Number.isInteger(paginaNumero) && paginaNumero > 0 ? paginaNumero : 1;

  const [cifras, filas, total] = await Promise.all([
    cifrasExpedientes(),
    listaExpedientes({ busqueda, estado, pagina, porPagina: POR_PAGINA }),
    contarExpedientes({ busqueda, estado }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const rutaBusqueda = idioma === "en" ? "/en/expedientes" : "/expedientes";

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
        <Cifra valor={cifras.total} etiqueta={t("stats.total")} />
        <Cifra
          valor={cifras.activos}
          etiqueta={t("stats.active")}
          color="text-[#187a99]"
        />
        <Cifra
          valor={cifras.en_proceso}
          etiqueta={t("stats.inProcess")}
          color="text-[#187a99]"
        />
        <Cifra
          valor={cifras.graduados}
          etiqueta={t("stats.graduated")}
          color="text-[#187a99]"
        />
      </div>

      {/* El estado va en desplegable porque son ocho y ocho píldoras no caben.
          Las píldoras de tipo se fueron con la 0047: con un solo tipo de
          estudiante, filtrar por él no deja fuera a nadie. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
        <form
          action={rutaBusqueda}
          method="get"
          className="flex flex-wrap items-center gap-2"
        >
          {vista !== "tarjetas" && (
            <input type="hidden" name="vista" value={vista} />
          )}

          <Input
            name="q"
            defaultValue={busqueda ?? ""}
            placeholder={t("filters.searchPlaceholder")}
            aria-label={t("filters.search")}
            className="h-9 w-full sm:w-56"
          />

          <select
            name="estado"
            defaultValue={estado ?? ""}
            aria-label={t("filters.status")}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="">{t("filters.status")}</option>
            {ESTADOS_ESTUDIANTE.map((valor) => (
              <option key={valor} value={valor}>
                {t(`status.${valor}`)}
              </option>
            ))}
          </select>

          <Button type="submit" variant="outline" size="sm" className="h-9">
            <Search className="size-4" />
            {t("filters.apply")}
          </Button>

          {(busqueda || estado) && (
            <Link
              href={enlace({ vista })}
              className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-2 hover:underline"
            >
              {t("filters.clear")}
            </Link>
          )}
        </form>
      </div>

      {filas.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo={busqueda || estado ? t("noMatches") : t("empty")}
        />
      ) : (
        <>
          {/* Vista y paginación van arriba, no al final: es lo primero que se
              quiere cambiar al llegar, no lo último que se ve tras desplazar
              toda la lista. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              {t("count", { count: total })}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border p-0.5">
                <VistaBoton
                  href={enlace({ estado, busqueda, vista: "tarjetas", pagina })}
                  activa={vista === "tarjetas"}
                  icono={LayoutGrid}
                  texto={t("views.cards")}
                />
                <VistaBoton
                  href={enlace({ estado, busqueda, vista: "lista", pagina })}
                  activa={vista === "lista"}
                  icono={List}
                  texto={t("views.list")}
                />
              </div>

              {totalPaginas > 1 && (
                <div className="flex items-center gap-2">
                  <PaginaBoton
                    href={enlace({
                      estado,
                      busqueda,
                      vista,
                      pagina: pagina - 1,
                    })}
                    deshabilitado={pagina <= 1}
                    icono={ChevronLeft}
                    etiqueta={t("pagination.previous")}
                  />
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {t("pagination.page", {
                      current: pagina,
                      total: totalPaginas,
                    })}
                  </span>
                  <PaginaBoton
                    href={enlace({
                      estado,
                      busqueda,
                      vista,
                      pagina: pagina + 1,
                    })}
                    deshabilitado={pagina >= totalPaginas}
                    icono={ChevronRight}
                    etiqueta={t("pagination.next")}
                  />
                </div>
              )}
            </div>
          </div>

          {vista === "tarjetas" ? (
            /* Una columna menos en pantalla ancha y un hueco mayor. Con cinco
               columnas la tarjeta bajaba de 180px y, siendo cuadrada, ese
               ancho es también su alto: el contenido no cabía. Cuatro
               columnas le devuelven ~25% de lado. */
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filas.map((fila) => (
                <TarjetaCuadrada
                  key={fila.id}
                  fila={fila}
                  idioma={idioma}
                  puedeEscribir={puedeEscribir}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <Card className="divide-y overflow-hidden py-0">
              {filas.map((fila) => (
                <div
                  key={fila.id}
                  className="flex items-start gap-3 p-3.5 transition-colors hover:bg-muted/50"
                >
                  <FilaContenido
                    fila={fila}
                    idioma={idioma}
                    puedeEscribir={puedeEscribir}
                    t={t}
                  />
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/**
 * URL del módulo con los filtros que toquen.
 *
 * Sin `pagina`, el enlace vuelve a la primera: cambiar de filtro o de vista
 * con la página 4 puesta dejaría una lista vacía casi siempre. Los enlaces de
 * paginación son los únicos que sí la pasan.
 */
function enlace({
  estado,
  busqueda,
  vista,
  pagina,
}: {
  estado?: string | null;
  busqueda?: string | null;
  vista?: Vista | null;
  pagina?: number | null;
}): string {
  const parametros = new URLSearchParams();

  if (estado) parametros.set("estado", estado);
  if (busqueda) parametros.set("q", busqueda);
  if (vista && vista !== "tarjetas") parametros.set("vista", vista);
  if (pagina && pagina > 1) parametros.set("pagina", String(pagina));

  const cadena = parametros.toString();

  return cadena ? `/expedientes?${cadena}` : "/expedientes";
}

function Cifra({
  valor,
  etiqueta,
  color = "text-foreground",
}: {
  valor: number;
  etiqueta: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 text-center">
        <p className={cn("text-3xl font-bold", color)}>{valor}</p>
        <p className="text-muted-foreground mt-1 text-xs">{etiqueta}</p>
      </CardContent>
    </Card>
  );
}

/** El interruptor de vista: tarjetas o lista, como dos píldoras dentro de un mismo borde. */
function VistaBoton({
  href,
  activa,
  icono: Icono,
  texto,
}: {
  href: string;
  activa: boolean;
  icono: React.ComponentType<{ className?: string }>;
  texto: string;
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? "true" : undefined}
      title={texto}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        activa
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      <Icono className="size-3.5" />
      <span className="hidden sm:inline">{texto}</span>
    </Link>
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
      <span className="text-muted-foreground/40 flex size-9 items-center justify-center rounded-md border">
        <Icono className="size-3.5" />
        <span className="sr-only">{etiqueta}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={etiqueta}
      className="flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-muted"
    >
      <Icono className="size-3.5" />
    </Link>
  );
}

/**
 * El contenido de una fila en la vista de lista: previsualización a la
 * izquierda, GPA y acceso a editar/ver a la derecha. La vista de tarjetas usa
 * `TarjetaCuadrada`, con otra disposición (todo centrado, para que quepa en
 * un cuadrado) pero el mismo componente de previsualización por dentro.
 */
function FilaContenido({
  fila,
  idioma,
  puedeEscribir,
  t,
}: {
  fila: FilaExpediente;
  idioma: Locale;
  puedeEscribir: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <>
      <PrevisualizarExpediente
        fila={fila}
        idioma={idioma}
        puedeEscribir={puedeEscribir}
        fotoUrl={urlDeAvatar(fila.foto_url)}
        textos={textosPrevisualizar(fila, t)}
      />

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="text-right">
          <p className="text-lg font-bold">
            {fila.indice === null ? "—" : fila.indice.toFixed(2)}
          </p>
          <p className="text-muted-foreground text-[10px]">
            {fila.indice === null ? t("noGpa") : t("column.gpa")}
          </p>
        </div>

        <Link
          href={`/expedientes/${fila.id}`}
          className="text-muted-foreground hover:bg-[#2096BA]/10 -mr-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors hover:text-[#187a99]"
        >
          {puedeEscribir ? (
            <PencilLine className="size-3" />
          ) : (
            <Eye className="size-3" />
          )}
          {puedeEscribir ? t("rowActions.edit") : t("rowActions.view")}
        </Link>
      </div>
    </>
  );
}

/**
 * La tarjeta cuadrada: foto, nombre y estado (con su color), centrados.
 * El estado manda el color de su badge y el de la franja superior —dos sitios
 * con la misma señal, para que se distinga de un vistazo sin tener que leer
 * el texto—. El pie, fuera del disparador de la previsualización, deja el
 * acceso a editar/ver siempre a mano sin abrir el diálogo.
 */
function TarjetaCuadrada({
  fila,
  idioma,
  puedeEscribir,
  t,
}: {
  fila: FilaExpediente;
  idioma: Locale;
  puedeEscribir: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const visual = visualDeEstado(fila.estado);

  return (
    <Card className="aspect-square overflow-hidden rounded-2xl shadow-xs transition-all duration-200 hover:shadow-md">
      {/* La franja usa su propio color sólido, no las clases de la insignia:
          una insignia clara con texto oscuro dejaba la franja casi invisible,
          que era justo la señal que se ve sin leer. */}
      <div className={cn("h-1.5 w-full shrink-0", visual.franja)} />

      <CardContent className="flex min-h-0 flex-1 flex-col p-4">
        <PrevisualizarExpediente
          fila={fila}
          idioma={idioma}
          puedeEscribir={puedeEscribir}
          fotoUrl={urlDeAvatar(fila.foto_url)}
          variante="tarjeta"
          textos={textosPrevisualizar(fila, t)}
        />

        <div className="mt-3 flex shrink-0 items-center justify-between border-t pt-3">
          <div className="space-y-0.5">
            <p className="text-sm leading-none font-bold">
              {fila.indice === null ? "—" : fila.indice.toFixed(2)}
            </p>
            <p className="text-muted-foreground text-[10px] leading-none">
              {fila.indice === null ? t("noGpa") : t("column.gpa")}
            </p>
          </div>

          {/* Con su palabra al lado, no solo el icono. Un lápiz suelto obliga a
              pasar el ratón por encima para saber si edita o abre —y en una
              pantalla táctil no hay ese "encima"—, así que la acción se
              escribe. Es además la misma etiqueta que usa la vista de lista:
              la misma acción no debería decirse de dos formas según la vista. */}
          <Link
            href={`/expedientes/${fila.id}`}
            className="text-muted-foreground hover:bg-[#2096BA]/10 flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors hover:text-[#187a99]"
          >
            {puedeEscribir ? (
              <PencilLine className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {puedeEscribir ? t("rowActions.edit") : t("rowActions.view")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** Los textos que necesita `PrevisualizarExpediente`, en las dos vistas. */
function textosPrevisualizar(
  fila: FilaExpediente,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  return {
    preview: t("rowActions.preview"),
    idCard: t("field.idCard"),
    email: t("field.email"),
    phone: t("field.phone"),
    program: t("field.program"),
    university: t("field.university"),
    since: t("detail.since"),
    gpa: t("detail.gpa"),
    gpaScale: t("detail.gpaScale"),
    noGpa: t("noGpa"),
    status: t(`status.${fila.estado}`),
    optional: t("field.optional"),
    edit: t("rowActions.edit"),
    viewFull: t("rowActions.viewFull"),
  };
}
