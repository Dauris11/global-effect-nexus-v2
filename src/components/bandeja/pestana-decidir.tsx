import { getTranslations } from "next-intl/server";

import { GraficasBandeja } from "@/components/bandeja/graficas-bandeja";
import { NotificacionesBandeja } from "@/components/bandeja/notificaciones-bandeja";
import { PendientesBandeja } from "@/components/bandeja/pendientes-bandeja";
import { ProyectosBandeja } from "@/components/bandeja/proyectos-bandeja";
import { ReunionesBandeja } from "@/components/bandeja/reuniones-bandeja";
import type { Locale } from "@/i18n/routing";
import type { UsuarioSesion } from "@/lib/auth";
import { cargarBandeja } from "@/server/bandeja/consultas";

/**
 * Pestaña «Para decidir» de Pendientes: lo que espera una decisión, los
 * proyectos, la agenda, los avisos y las gráficas (lo que era la bandeja).
 *
 * Las tareas por hacer ya no se repiten aquí: viven en «Mis tareas». Cada
 * bloque llega `null` si la persona no tiene su permiso (ver `cargarBandeja`) y
 * entonces no se dibuja.
 *
 * Las gráficas son cliente pero reciben los textos ya traducidos, así que no
 * hace falta `NextIntlClientProvider` ni `mensajesCliente` para ellas.
 */
export async function PestanaDecidir({
  usuario,
  idioma,
}: {
  usuario: UsuarioSesion;
  idioma: Locale;
}) {
  const [t, tPrioridad, tEstado, datos] = await Promise.all([
    getTranslations({ locale: idioma, namespace: "bandeja" }),
    getTranslations({ locale: idioma, namespace: "torre.priority" }),
    getTranslations({ locale: idioma, namespace: "torre.status" }),
    cargarBandeja(usuario),
  ]);

  return (
    <div className="space-y-6 md:space-y-8">
      {datos.pendientes && <PendientesBandeja pendientes={datos.pendientes} />}

      <GraficasBandeja
        datos={{
          tareas: datos.tareasGrafica,
          flujo: datos.flujo,
          proyectos: datos.proyectosGrafica,
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

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <NotificacionesBandeja notificaciones={datos.notificaciones} idioma={idioma} />
        {datos.proyectos && <ProyectosBandeja proyectos={datos.proyectos} />}
        {datos.reuniones && <ReunionesBandeja reuniones={datos.reuniones} idioma={idioma} />}
      </div>
    </div>
  );
}
