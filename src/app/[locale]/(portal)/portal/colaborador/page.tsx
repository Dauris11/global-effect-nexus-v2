import type { Metadata } from "next";
import {
  Camera,
  CheckCircle2,
  Clock,
  Inbox,
  ListTodo,
  MessageSquare,
  Receipt,
  Sparkles,
  Wrench,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BannerPortal } from "@/components/layout/banner-portal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { tareasColaborador } from "@/server/colaborador/consultas";
import { misNotificaciones } from "@/server/notificaciones/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "colaborador.portal" });

  return { title: t("metaTitle") };
}

export default async function PortalColaboradorPage() {
  const usuario = await requerirRol(["colaborador", "admin", "super_admin"]);
  const t = await getTranslations("colaborador.portal");

  const tareas = await tareasColaborador(usuario.id);
  const avisos = await misNotificaciones(usuario.id, 5);

  const tareasHoy = tareas.filter((t) => t.es_hoy || t.vencida);
  const pendientes = tareas.filter((t) => t.estado !== "completada");

  return (
    <div className="space-y-6">
      <BannerPortal
        rol={usuario.rol}
        icono={Sparkles}
        insignia={t("eyebrow")}
        titulo={t("greeting", { nombre: usuario.nombre })}
        subtitulo={t("subtitle")}
        kpis={[]}
      />

      {/* Acciones directas móviles estilo tarjeta grande */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/administrativo/tareas/hoy"
          className="group flex items-center gap-4 rounded-2xl border border-linea bg-superficie p-5 shadow-card transition-all hover:border-marca-500 hover:shadow-hover"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-500 group-hover:scale-105">
            <ListTodo className="size-6" />
          </div>
          <div>
            <h3 className="font-semibold text-tinta">{t("todayTitle")}</h3>
            <p className="texto-meta text-xs">
              {t("todayCount", { n: tareasHoy.length })}
            </p>
          </div>
        </Link>

        <Link
          href="/administrativo/rendiciones"
          className="group flex items-center gap-4 rounded-2xl border border-linea bg-superficie p-5 shadow-card transition-all hover:border-marca-500 hover:shadow-hover"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-500 group-hover:scale-105">
            <Camera className="size-6" />
          </div>
          <div>
            <h3 className="font-semibold text-tinta">{t("expenseTitle")}</h3>
            <p className="texto-meta text-xs">{t("expenseText")}</p>
          </div>
        </Link>

        <Link
          href="/administrativo/solicitudes"
          className="group flex items-center gap-4 rounded-2xl border border-linea bg-superficie p-5 shadow-card transition-all hover:border-marca-500 hover:shadow-hover"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-500 group-hover:scale-105">
            <Inbox className="size-6" />
          </div>
          <div>
            <h3 className="font-semibold text-tinta">{t("requestsTitle")}</h3>
            <p className="texto-meta text-xs">{t("requestsText")}</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tareas de la jornada */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-tinta">{t("myTasks")}</h2>
            <Badge variant="neutra">{t("pendingCount", { n: pendientes.length })}</Badge>
          </div>

          {tareas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="size-10 text-marca-500/40" />
                <p className="mt-2 text-sm text-tinta-2">
                  {t("allDone")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tareas.slice(0, 6).map((tarea) => (
                <div
                  key={tarea.id}
                  className="flex items-center justify-between rounded-xl border border-linea bg-superficie p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-tinta">{tarea.titulo}</p>
                    {tarea.proyecto_nombre && (
                      <p className="text-xs text-tinta-3">{tarea.proyecto_nombre}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {tarea.vencida && (
                      <Badge variant="solida" className="text-xs">
                        {t("overdue")}
                      </Badge>
                    )}
                    {tarea.es_hoy && (
                      <Badge variant="marca" className="text-xs">
                        {t("today")}
                      </Badge>
                    )}
                    <span className="text-xs capitalize text-tinta-2">
                      {tarea.estado.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Avisos y Notificaciones */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-tinta">{t("recentNotices")}</h2>
          {avisos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-tinta-3">
                {t("noNotices")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {avisos.map((aviso) => (
                <div
                  key={aviso.id}
                  className="rounded-xl border border-linea bg-superficie p-3.5 space-y-1"
                >
                  <p className="text-sm font-semibold text-tinta">{aviso.titulo}</p>
                  <p className="text-xs text-tinta-2">{aviso.mensaje}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
