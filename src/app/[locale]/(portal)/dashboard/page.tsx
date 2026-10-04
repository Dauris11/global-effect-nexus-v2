import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccesosPanel } from "@/components/dashboard/accesos-panel";
import { CifrasPanel } from "@/components/dashboard/cifras-panel";
import { GraficasPanel } from "@/components/dashboard/graficas-panel";
import {
  ListaEventos,
  ListaProyectos,
  ListaTareas,
} from "@/components/dashboard/listas-panel";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import {
  balanceDelMes,
  cifrasPanel,
  eventosProximos,
  flujoFinanciero,
  proyectosEnMarcha,
  tareasAbiertas,
  tareasPorPrioridad,
} from "@/server/dashboard/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });

  return { title: t("overview") };
}

/**
 * Panel general de administración.
 *
 * Responde a cuatro preguntas y en este orden, que es el orden en que se
 * preguntan: a cuánta gente atendemos, qué está en marcha, qué está atascado y
 * cómo va el dinero.
 *
 * Lo financiero se pide solo si el rol tiene `finanzas.leer`. No es que se
 * oculte la tarjeta: es que las consultas no se lanzan, así que un `admin` sin
 * ese permiso no llega a tener los importes en la respuesta del servidor. Por
 * eso `Promise.all` se arma en dos trozos.
 *
 * La página solo consulta y ordena; cada bloque vive en
 * `components/dashboard/` (cifras, accesos, gráficas, listas). Antes era un
 * banner en degradado con todo dentro y pasaba de quinientas líneas.
 */
export default async function PaginaDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["admin", "super_admin"]);
  const verFinanzas = tienePermiso(usuario.rol, "finanzas.leer");

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tRoles = await getTranslations({ locale, namespace: "roles" });

  const [cifras, tareas, prioridades, proyectos, eventos] = await Promise.all([
    cifrasPanel(),
    tareasAbiertas(6),
    tareasPorPrioridad(),
    proyectosEnMarcha(4),
    eventosProximos(4),
  ]);

  const [flujo, balance] = verFinanzas
    ? await Promise.all([flujoFinanciero(6), balanceDelMes()])
    : [null, null];

  const neto = balance ? balance.ingresos - balance.egresos : null;

  return (
    <div className="animate-fade-in-up space-y-8 md:space-y-12">
      <EncabezadoPagina
        antetitulo={tRoles(usuario.rol)}
        titulo={t("greeting", { name: usuario.nombre })}
        subtitulo={t("subtitle")}
      />

      <CifrasPanel cifras={cifras} neto={neto} />

      <AccesosPanel verFinanzas={verFinanzas} />

      <GraficasPanel cifras={cifras} prioridades={prioridades} flujo={flujo} />

      {/* Tareas y proyectos, lado a lado: la tarea dice qué hay que hacer y el
          proyecto dice dónde encaja. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ListaTareas tareas={tareas} idioma={idioma} />

        <div className="space-y-4">
          <ListaProyectos proyectos={proyectos} />
          <ListaEventos eventos={eventos} idioma={idioma} />
        </div>
      </div>
    </div>
  );
}
