import type { Metadata } from "next";
import {
  AlertCircle,
  BarChart3,
  ChevronRight,
  History,
  LayoutGrid,
  Shield,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BannerPortal } from "@/components/layout/banner-portal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { cuantasPorAtender } from "@/server/solicitudes/consultas";
import { fechaConHora } from "@/lib/fechas";
import { menuDe } from "@/lib/nav";
import { visibilidadDeRol } from "@/server/visibilidad/consultas";
import { CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  actividadReciente,
  cifrasDeLaFundacion,
  pendientesDeLaFundacion,
} from "@/server/portales/administrativo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "adminPortal" });

  return { title: t("eyebrow") };
}

/**
 * Portal administrativo: el tablero de toda la Fundación.
 *
 * NO ES UN PANEL DE OPERACIONES. Aquí converge el sistema entero —lo académico,
 * lo estudiantil, las solicitudes, patrocinio, el comedor y las cuentas—, no solo
 * tareas y proyectos. Ese es el encargo, y es lo que separa esta pantalla de
 * `/dashboard`, que sigue siendo el sitio de las gráficas.
 *
 * EL ORDEN DE LA PANTALLA ES EL ARGUMENTO:
 *
 *   1. **Lo que espera una decisión.** Va primero porque es lo único con
 *      alguien al otro lado, y cada aviso enlaza a donde se resuelve: un aviso
 *      que no se puede accionar es decoración. Si no hay nada, se dice, y se
 *      dice como buena noticia.
 *   2. **Las cifras**, que responden "cuánto hay" y no "qué falta".
 *   3. **Todos los módulos**, derivados de `menuDe(rol)` —el MISMO menú que la
 *      barra lateral— en vez de una lista escrita a mano. Una rejilla copiada
 *      se queda desfasada la primera vez que alguien añade una pantalla; esta
 *      no puede, y además hereda el filtrado por permiso.
 *   4. **La actividad reciente**, que es la primera lectura de `audit_log` que
 *      existe en el sitio.
 *
 * `requerirRol` y no `requerirPermiso`: esto no es un módulo con su permiso, es
 * la entrada de un rol. Entran `admin` —que es a quien la especificación llama
 * "administrativo"— y `super_admin`.
 */
export default async function PortalAdministrativo({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["admin", "super_admin"]);

  const [t, tNav, cifras, pendientes, actividad, porAtender] = await Promise.all([
    getTranslations({ locale, namespace: "adminPortal" }),
    getTranslations({ locale, namespace: "nav" }),
    cifrasDeLaFundacion(),
    pendientesDeLaFundacion(),
    actividadReciente(8),
    // Las de ESTA persona, no todas las abiertas: la separación de funciones
    // saca de la cuenta lo que pidió ella misma, que no le toca decidir.
    cuantasPorAtender(usuario),
  ]);

  const usd = (valor: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(valor);

  /*
   * Los avisos, con su destino. Se declaran juntos y se filtran por `cuantos`:
   * un aviso en cero no se dibuja, porque la lista es de trabajo pendiente y
   * un "0 tareas vencidas" en medio esconde al que sí tiene número.
   */
  const avisos = [
    { clave: "urgentTasks", cuantos: pendientes.tareas_urgentes, href: "/administrativo/tareas" },
    { clave: "overdueTasks", cuantos: pendientes.tareas_vencidas, href: "/administrativo/tareas" },
    { clave: "submissions", cuantos: pendientes.entregas_por_revisar, href: "/academico/clases-360" },
    { clave: "unsponsored", cuantos: pendientes.becados_sin_patrocinador, href: "/patrocinadores/becas" },
    { clave: "terms", cuantos: pendientes.periodos_incoherentes, href: "/academico/periodos" },
    { clave: "requests", cuantos: porAtender, href: "/administrativo/solicitudes" },
    { clave: "subjectsNoTerm", cuantos: pendientes.materias_sin_periodo, href: "/academico/materias" },
  ].filter((aviso) => aviso.cuantos > 0);

  const figuras = [
    { clave: "students", valor: cifras.estudiantes },
    { clave: "classes360", valor: cifras.clases_360 },
    { clave: "subjects", valor: cifras.materias },
    { clave: "grades", valor: cifras.notas },
    { clave: "projects", valor: cifras.proyectos },
    { clave: "tasks", valor: cifras.tareas_abiertas },
    { clave: "sponsors", valor: cifras.patrocinadores },
    { clave: "giving", valor: usd(cifras.aporte_mensual) },
    { clave: "diners", valor: cifras.comensales_hoy },
    { clave: "requests", valor: cifras.solicitudes_abiertas },
    { clave: "users", valor: cifras.usuarios },
  ];

  const areas = menuDe(usuario.rol, new Set((await visibilidadDeRol(usuario.rol)).fueraDelMenu));

  return (
    <div className="space-y-6">
      <BannerPortal
        rol={usuario.rol}
        icono={Shield}
        titulo={t("greeting", { name: usuario.nombre })}
        subtitulo={t("summary")}
        insignia={t("eyebrow")}
        kpis={[
          { valor: String(cifras.estudiantes), etiqueta: t("kpi.students") },
          { valor: String(cifras.tareas_abiertas), etiqueta: t("kpi.tasks") },
          { valor: String(cifras.proyectos), etiqueta: t("kpi.projects") },
          { valor: usd(cifras.aporte_mensual), etiqueta: t("kpi.giving") },
        ]}
      />

      {/* ── 1. Lo que espera una decisión ─────────────────────────── */}
      <Card className={avisos.length > 0 ? "border-[#171A1D]/20" : undefined}>
        <CardContent className="pt-5">
          <CardTitle className="mb-1">
            <AlertCircle className="size-4" />
            {t("pending.title")}
            {avisos.length > 0 && (
              <Badge className="ml-1 bg-[#171A1D] text-[10px] text-white">
                {avisos.reduce((total, aviso) => total + aviso.cuantos, 0)}
              </Badge>
            )}
          </CardTitle>
          <p className="text-muted-foreground mb-3 text-xs">
            {t("pending.hint")}
          </p>

          {avisos.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm font-semibold">{t("pending.none")}</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                {t("pending.noneHint")}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {avisos.map((aviso) => (
                <li key={aviso.clave}>
                  <Link
                    href={aviso.href}
                    className="group hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
                  >
                    {/* El número en tinta y a la izquierda: es lo que se
                        escanea, no el texto que lo acompaña. */}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#171A1D] text-sm font-bold text-white">
                      {aviso.cuantos}
                    </span>

                    <span className="min-w-0 flex-1 text-sm">
                      {t(`pending.${aviso.clave}` as never)}
                    </span>

                    <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Las cifras ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <CardTitle className="mb-3">
            <BarChart3 className="size-4" />
            {t("figures.title")}
          </CardTitle>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {figuras.map((figura) => (
              <div
                key={figura.clave}
                className="bg-muted/30 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#2096BA]/10"
              >
                <dd className="text-lg leading-none font-bold text-[#187a99]">
                  {figura.valor}
                </dd>
                <dt className="text-muted-foreground mt-1 text-[10px] leading-tight">
                  {t(`figures.${figura.clave}` as never)}
                </dt>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* ── 3. Todos los módulos, del mismo menú que la barra ─────── */}
      <Card>
        <CardContent className="pt-5">
          <CardTitle className="mb-1">
            <LayoutGrid className="size-4" />
            {t("modules.title")}
          </CardTitle>
          <p className="text-muted-foreground mb-3 text-xs">
            {t("modules.hint")}
          </p>

          <div className="space-y-4">
            {areas.map((area) => (
              <div key={area.clave}>
                <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase">
                  <area.icono className="size-3.5" />
                  {tNav(area.etiqueta as never)}
                </p>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {area.secciones.flatMap((seccion) =>
                    seccion.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group hover:border-[#2096BA]/30 flex items-center gap-2 rounded-lg border p-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md transition-transform duration-150 group-hover:scale-110",
                            CUADRO.marca,
                          )}
                        >
                          <item.icono className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {tNav(item.etiqueta as never)}
                        </span>
                      </Link>
                    )),
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Lo último que ha pasado ────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <CardTitle className="mb-1">
            <History className="size-4" />
            {t("activity.title")}
          </CardTitle>
          <p className="text-muted-foreground mb-3 text-xs">
            {t("activity.hint")}
          </p>

          {actividad.length === 0 ? (
            <div className={VACIO.contenedor}>
              <span className={VACIO.icono}>
                <History className="size-6" />
              </span>
              <p className={VACIO.descripcion}>{t("activity.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {actividad.map((traza) => (
                <li
                  key={traza.id}
                  className="flex flex-wrap items-center gap-2 py-2 text-xs"
                >
                  {/* La acción tal cual la escribió quien la registró
                      (`tarea.movida`, `beca.asignada`): es vocabulario del
                      sistema, no texto para traducir, y traducirlo obligaría a
                      mantener una clave por cada verbo que se añada. */}
                  <span className="bg-muted/60 rounded px-1.5 py-0.5 font-mono text-[10px]">
                    {traza.accion}
                  </span>

                  <span className="text-muted-foreground min-w-0 flex-1 truncate">
                    {t("activity.by", { quien: traza.quien ?? t("activity.unknown") })}
                  </span>

                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {fechaConHora(traza.created_at, null, idioma)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
