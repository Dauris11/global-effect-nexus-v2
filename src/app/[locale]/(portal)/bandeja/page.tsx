import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GraficasBandeja } from "@/components/bandeja/graficas-bandeja";
import { NotificacionesBandeja } from "@/components/bandeja/notificaciones-bandeja";
import { PendientesBandeja } from "@/components/bandeja/pendientes-bandeja";
import {
  avanceDeProyecto,
  ProyectosBandeja,
} from "@/components/bandeja/proyectos-bandeja";
import { ReunionesBandeja } from "@/components/bandeja/reuniones-bandeja";
import { TareasBandeja } from "@/components/bandeja/tareas-bandeja";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { cargarBandeja } from "@/server/bandeja/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bandeja" });

  return { title: t("title") };
}

/**
 * Bandeja: inicio de `admin` y `super_admin`, centro de avisos y gráficas.
 *
 * Sustituye al "portal administrativo" y al "panel", que respondían casi a lo
 * mismo en dos pantallas. El orden es el de la urgencia: primero lo que espera
 * una decisión, luego lo que tienes por hacer y tus proyectos, lo que viene en
 * la agenda y los avisos, y al final las gráficas.
 *
 * Cada bloque llega `null` si la persona no tiene su permiso (ver
 * `cargarBandeja`) y entonces no se dibuja. `requerirRol` y no un permiso
 * suelto porque esto es la entrada de un rol, no un módulo.
 *
 * Las gráficas son cliente pero reciben los textos ya traducidos, así que no
 * hace falta `NextIntlClientProvider` ni `mensajesCliente` para ellas.
 */
export default async function PaginaBandeja({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["admin", "super_admin"]);

  const [t, tPrioridad, tEstado, datos] = await Promise.all([
    getTranslations({ locale, namespace: "bandeja" }),
    getTranslations({ locale, namespace: "torre.priority" }),
    getTranslations({ locale, namespace: "torre.status" }),
    cargarBandeja(usuario),
  ]);

  const proyectosEnMarcha =
    datos.proyectos?.filter((p) => p.estado !== "completado" && p.estado !== "cancelado") ?? null;

  return (
    <div className="animate-entrada space-y-6 md:space-y-8">
      <EncabezadoPagina titulo={t("greeting", { name: usuario.nombre })} />

      {datos.pendientes && <PendientesBandeja pendientes={datos.pendientes} />}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {datos.tareas && <TareasBandeja tareas={datos.tareas} idioma={idioma} />}
        <NotificacionesBandeja notificaciones={datos.notificaciones} idioma={idioma} />
        {datos.proyectos && <ProyectosBandeja proyectos={datos.proyectos} />}
        {datos.reuniones && <ReunionesBandeja reuniones={datos.reuniones} idioma={idioma} />}
      </div>

      <GraficasBandeja
        datos={{
          tareas: datos.tareas?.map((x) => ({ prioridad: x.prioridad, estado: x.estado })) ?? null,
          flujo: datos.flujo,
          proyectos:
            proyectosEnMarcha
              ?.filter((p) => p.tareas > 0)
              .map((p) => ({ nombre: p.nombre, avance: avanceDeProyecto(p) })) ?? null,
        }}
        etiquetas={{
          porPrioridad: t("charts.byPriority"),
          porEstado: t("charts.byStatus"),
          abiertas: t("charts.tasksTotal"),
          tareasVacio: t("charts.tasksEmpty"),
          finanzas: t("charts.finance"),
          ingresos: t("charts.income"),
          egresos: t("charts.expenses"),
          finanzasVacio: t("charts.noFinance"),
          proyectos: t("charts.projects"),
          proyectosVacio: t("charts.projectsEmpty"),
          prioridades: {
            baja: tPrioridad("baja"),
            media: tPrioridad("media"),
            alta: tPrioridad("alta"),
            urgente: tPrioridad("urgente"),
          },
          estados: {
            por_hacer: tEstado("por_hacer"),
            en_progreso: tEstado("en_progreso"),
            en_revision: tEstado("en_revision"),
            completada: tEstado("completada"),
          },
        }}
      />
    </div>
  );
}
