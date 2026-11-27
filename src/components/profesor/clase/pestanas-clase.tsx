"use client";

import { useState } from "react";
import { CalendarCheck, ClipboardCheck, FileUp, GraduationCap, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/app/empty-state";
import { ListaEstudiantes, ListaPublicaciones, ListaSesiones, NotasFinales } from "@/components/profesor/clase/listas-clase";
import { PanelAsistencia } from "@/components/profesor/clase/panel-asistencia";
import { PanelMaterial, PanelTarea } from "@/components/profesor/clase/panel-publicar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DatosDeClase } from "@/lib/clase-docente";

type Pestana = "students" | "tasks" | "material" | "attendance" | "finals";

/**
 * Las cinco pestañas de una clase. La acción primaria CAMBIA con la pestaña
 * (Crear tarea · Subir material · Pasar asistencia) y sigue siendo UN botón,
 * arriba a la derecha de la lista (ux-rules §5); en Estudiantes y Notas finales
 * no hay ninguna porque ahí no se crea nada.
 */
const PESTANAS: readonly Pestana[] = ["students", "tasks", "material", "attendance", "finals"];

export function PestanasClase({ datos, inicial }: { datos: DatosDeClase; /** `?tab=` de la URL: «Pasar asistencia» desde el inicio abre ya esa pestaña. */ inicial?: string }) {
  const t = useTranslations("teacherClasses");
  const [pestana, setPestana] = useState<Pestana>(PESTANAS.find((p) => p === inicial) ?? "students");
  const [panel, setPanel] = useState<"tarea" | "material" | "asistencia" | null>(null);
  const cerrar = (abierto: boolean) => !abierto && setPanel(null);

  const accion =
    pestana === "tasks"
      ? { clave: "tarea" as const, texto: t("tasks.create"), icono: <Plus aria-hidden /> }
      : pestana === "material"
        ? { clave: "material" as const, texto: t("material.upload"), icono: <FileUp aria-hidden /> }
        : pestana === "attendance"
          ? { clave: "asistencia" as const, texto: datos.hoyYaPasada ? t("attendance.fix") : t("attendance.take"), icono: <CalendarCheck aria-hidden /> }
          : null;

  const evaluables = datos.publicaciones.filter((p) => p.tipo === "tarea" || p.tipo === "examen");
  const materiales = datos.publicaciones.filter((p) => p.tipo === "material" || p.tipo === "anuncio");

  return (
    <>
      <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {(["students", "tasks", "material", "attendance", "finals"] as const).map((p) => (
              <TabsTrigger key={p} value={p}>
                {t(`tabs.${p}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {accion && (
            <Button type="button" onClick={() => setPanel(accion.clave)}>
              {accion.icono}
              {accion.texto}
            </Button>
          )}
        </div>

        <TabsContent value="students">
          {datos.estudiantes.length === 0 ? (
            <EmptyState readOnly icon={Users} title={t("students.emptyTitle")} description={t("students.emptyHint")} />
          ) : (
            <ListaEstudiantes estudiantes={datos.estudiantes} />
          )}
        </TabsContent>
        <TabsContent value="tasks">
          {evaluables.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={t("tasks.emptyTitle")}
              action={<Button onClick={() => setPanel("tarea")}>{t("tasks.create")}</Button>}
            />
          ) : (
            <ListaPublicaciones publicaciones={datos.publicaciones} evaluables />
          )}
        </TabsContent>
        <TabsContent value="material">
          {materiales.length === 0 ? (
            <EmptyState
              icon={FileUp}
              title={t("material.emptyTitle")}
              action={<Button onClick={() => setPanel("material")}>{t("material.upload")}</Button>}
            />
          ) : (
            <ListaPublicaciones publicaciones={datos.publicaciones} evaluables={false} />
          )}
        </TabsContent>
        <TabsContent value="attendance">
          {datos.sesiones.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={t("attendance.emptyTitle")}
              action={<Button onClick={() => setPanel("asistencia")}>{t("attendance.take")}</Button>}
            />
          ) : (
            <ListaSesiones sesiones={datos.sesiones} />
          )}
        </TabsContent>
        <TabsContent value="finals">
          {datos.estudiantes.length === 0 ? (
            <EmptyState readOnly icon={GraduationCap} title={t("students.emptyTitle")} description={t("students.emptyHint")} />
          ) : (
            <NotasFinales origen={datos.origen} estudiantes={datos.estudiantes} />
          )}
        </TabsContent>
      </Tabs>

      <PanelTarea datos={datos} abierto={panel === "tarea"} onCambio={cerrar} />
      <PanelMaterial datos={datos} abierto={panel === "material"} onCambio={cerrar} />
      <PanelAsistencia key={datos.roster.map((r) => r.marcaHoy ?? "-").join("")} datos={datos} abierto={panel === "asistencia"} onCambio={cerrar} />
    </>
  );
}
