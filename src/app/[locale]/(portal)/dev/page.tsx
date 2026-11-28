import type { Metadata } from "next";
import { Activity, BookOpen, Bot, ScrollText, SlidersHorizontal } from "lucide-react";
import { forbidden } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type ChipEstado } from "@/components/app/filter-bar";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { InterruptorTecnico } from "@/components/parametros/interruptor-tecnico";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { AJUSTES } from "@/lib/configuracion";
import { fechaConHora } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import { CLAVE_IMPERSONATION_WRITE } from "@/lib/suplantacion";
import { cn } from "@/lib/utils";
import { esFiltroRegistro, estadoColaCorreo, eventosRecientes, FILTROS_REGISTRO } from "@/server/dev/consultas";
import { impersonationWriteActivo } from "@/server/parametros/tecnicos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dev" });

  return { title: t("title") };
}

const ICONO_ACCESO = {
  ia: Bot,
  knowledge: BookOpen,
  activity: Activity,
  audit: ScrollText,
  parameters: SlidersHorizontal,
} as const;

const TARJETA = "rounded-card border border-linea bg-card p-5 shadow-card";

/**
 * Panel del equipo de desarrollo: bitácora reciente, banderas, estado de la cola de correos y atajos a las
 * pantallas técnicas. Solo `tecnico.dev_panel`.
 *
 * El permiso se mira con `obtenerUsuarioActual` y no con `requerirPermiso`, que redirige al portal de quien no lo
 * tiene: aquí se quiere una página de «no es para ti» (`forbidden()`), no un salto mudo a otra pantalla. Ese
 * rechazo no es control de acceso por sí solo: lo que escribe (`guardarParametroTecnico`) vuelve a exigir
 * `tecnico.parametros` en el servidor, y las pantallas a las que enlaza piden sus propios permisos.
 */
export default async function PaginaDev({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ registro?: string; q?: string }>;
}) {
  const [{ locale }, { registro, q }] = await Promise.all([params, searchParams]);
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !usuarioTienePermiso(usuario, "tecnico.dev_panel")) forbidden();

  const filtro = esFiltroRegistro(registro) ? registro : "todos";
  const idioma = usuario.idioma;
  const [t, tAjustes, tPar, eventos, cola, escritura, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "dev" }),
    getTranslations({ locale, namespace: "settings.nav" }),
    getTranslations({ locale, namespace: "parametros" }),
    eventosRecientes(filtro, q ?? ""),
    estadoColaCorreo().catch(() => null),
    impersonationWriteActivo(),
    mensajesCliente(["parametros"]),
  ]);

  const chips: ChipEstado[] = FILTROS_REGISTRO.filter((f) => f !== "todos").map((f) => ({
    value: f,
    label: t(
      f === "sesion" ? "logsFilterSession" : f === "tecnico" ? "logsFilterTech" : "logsFilterBlocked",
    ),
  }));
  const accesos = AJUSTES.filter((a) => a.clave in ICONO_ACCESO && usuarioTienePermiso(usuario, a.permiso));
  const puedeParametros = usuarioTienePermiso(usuario, "tecnico.parametros");
  const cuando = (valor: Date | null) => (valor ? fechaConHora(valor, null, idioma) : t("noData"));

  return (
    <PageContainer className="space-y-8 pb-10">
      <PageHeader title={t("title")} subtitle={t("intro")} />

      <section aria-labelledby="dev-accesos" className="space-y-3">
        <h2 id="dev-accesos" className="text-section">
          {t("quick")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map((a) => {
            const Icono = ICONO_ACCESO[a.clave as keyof typeof ICONO_ACCESO];

            return (
              <li key={a.clave}>
                <Link
                  href={a.href}
                  className="flex min-h-11 items-center gap-3 rounded-card border border-linea bg-card px-4 py-3 text-sm font-semibold text-tinta shadow-card transicion-control hover:border-linea-fuerte hover:shadow-elevada"
                >
                  <Icono aria-hidden className="size-5 shrink-0 text-marca-700" />
                  {a.clave === "parameters" ? t("quickParams") : tAjustes(a.clave)}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="dev-banderas" className={cn(TARJETA, "space-y-4")}>
        <h2 id="dev-banderas" className="text-section">
          {t("flags")}
        </h2>
        <NextIntlClientProvider messages={mensajes}>
          <InterruptorTecnico
            clave={CLAVE_IMPERSONATION_WRITE}
            inicial={escritura}
            etiqueta={tPar("impersonationWrite")}
            ayuda={tPar("impersonationWriteHint")}
            editable={puedeParametros}
          />
        </NextIntlClientProvider>
      </section>

      <section aria-labelledby="dev-jobs" className="space-y-3">
        <h2 id="dev-jobs" className="text-section">
          {t("jobs")}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className={TARJETA}>
            <h3 className="text-label font-semibold">{t("mailQueue")}</h3>
            {cola ? (
              <dl className="mt-3 space-y-1.5 text-sm">
                <Fila etiqueta={t("mailPending")} valor={String(cola.pendientes)} />
                <Fila etiqueta={t("mailFailed")} valor={String(cola.fallidos)} />
                <Fila etiqueta={t("mailLastSent")} valor={cuando(cola.ultimo_envio)} />
                {cola.ultimo_error && <Fila etiqueta={t("mailLastError")} valor={cola.ultimo_error.slice(0, 120)} />}
              </dl>
            ) : (
              <p className="text-meta mt-3">{t("noData")}</p>
            )}
          </div>
          {/* Sin tabla ni bitácora que registre estas dos integraciones: «Sin datos» es la verdad, no un verde inventado. */}
          {(["resend", "gemini"] as const).map((clave) => (
            <div key={clave} className={TARJETA}>
              <h3 className="text-label font-semibold">{t(clave)}</h3>
              <p className="mt-3 text-sm font-semibold">{t("noData")}</p>
              <p className="text-meta mt-1">{t("noSource")}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="dev-logs" className="space-y-3">
        <h2 id="dev-logs" className="text-section">
          {t("logs")}
        </h2>
        <Suspense fallback={null}>
          <FilterBar chips={chips} chipParam="registro" />
        </Suspense>
        {eventos.length === 0 ? (
          <EmptyState icon={ScrollText} title={t("logsEmpty")} readOnly />
        ) : (
          <div className="overflow-x-auto rounded-card border border-linea bg-card">
            <table className="w-full text-sm">
              <thead className="text-meta border-b border-linea text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("colWhen")}</th>
                  <th className="px-4 py-3 font-medium">{t("colWho")}</th>
                  <th className="px-4 py-3 font-medium">{t("colAction")}</th>
                  <th className="px-4 py-3 font-medium">{t("colEntity")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {eventos.map((e) => (
                  <tr key={e.id}>
                    <td className="text-meta px-4 py-2.5 whitespace-nowrap">{fechaConHora(e.created_at, null, idioma)}</td>
                    <td className="px-4 py-2.5">{e.actor ?? t("systemActor")}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.accion}</td>
                    <td className="text-meta px-4 py-2.5">{e.entidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {usuarioTienePermiso(usuario, "tecnico.auditoria") && (
          <Link href="/configuracion/auditoria" className="text-label inline-block text-marca-700 hover:underline">
            {t("logsAll")}
          </Link>
        )}
      </section>
    </PageContainer>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-meta">{etiqueta}</dt>
      <dd className="text-right font-medium tabular-nums">{valor}</dd>
    </div>
  );
}
