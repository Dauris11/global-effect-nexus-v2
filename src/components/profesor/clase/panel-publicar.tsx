"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";

import { SidePanelForm } from "@/components/app/side-panel-form";
import { useToast } from "@/components/app/toaster";
import { useRouter } from "@/i18n/navigation";
import type { DatosDeClase } from "@/lib/clase-docente";
import { publicarMaterialDeClase } from "@/server/profesor/acciones-clase";
import { publicarTarea, publicarTareaMateria, type EstadoAcademico } from "@/server/profesor/acciones";

/**
 * «Crear tarea» y «Subir material»: dos paneles laterales con lo mínimo a la
 * vista (título, y fecha o archivo) y lo demás en «Más detalles». La tarea usa
 * las acciones de siempre; el material con archivo usa la acción nueva que sube
 * el archivo al bucket desde el servidor.
 */
export function PanelTarea({
  datos,
  abierto,
  onCambio,
}: {
  datos: DatosDeClase;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) {
  const t = useTranslations("teacherClasses");
  const router = useRouter();
  const avisar = useToast();
  const [estado, enviar, pendiente] = useActionState<EstadoAcademico, FormData>(
    datos.origen === "g360" ? publicarTarea : publicarTareaMateria,
    { estado: "inicial" },
  );
  // Un `useEffect` por resultado: cerrar el panel y avisar solo cuando llega «ok».
  useEffect(() => {
    if (estado.estado === "ok") {
      avisar({ titulo: t("tasks.created") });
      router.refresh();
      onCambio(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reaccionar solo al cambio de `estado`
  }, [estado]);

  return (
    <SidePanelForm
      open={abierto}
      onOpenChange={onCambio}
      title={t("tasks.new")}
      description={datos.nombre}
      submitLabel={t("tasks.create")}
      pending={pendiente}
      action={enviar}
      moreDetails={
        <>
          <div className="space-y-2">
            <Label htmlFor="t-desc">{t("tasks.description")}</Label>
            <Textarea id="t-desc" name="descripcion" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-tipo">{t("tasks.type")}</Label>
            <select id="t-tipo" name="tipo" defaultValue="tarea" className="h-10 w-full rounded-control border border-linea-fuerte bg-card px-3 text-sm">
              <option value="tarea">{t("tasks.types.tarea")}</option>
              <option value="examen">{t("tasks.types.examen")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-pts">{t("tasks.points")}</Label>
            <Input id="t-pts" name="puntaje_maximo" type="number" min={1} max={1000} defaultValue={100} />
          </div>
        </>
      }
    >
      <input type="hidden" name="materia" value={datos.id} />
      <input type="hidden" name="periodo" value={datos.periodoId ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="t-titulo">{t("tasks.name")}</Label>
        <Input id="t-titulo" name="titulo" required maxLength={160} autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="t-vence">{t("tasks.due")}</Label>
        <Input id="t-vence" name="vence" type="datetime-local" />
      </div>
      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-body rounded-control bg-tinta p-3 text-background">
          {t(`tasks.err.${estado.estado}` as never)}
        </p>
      )}
    </SidePanelForm>
  );
}

export function PanelMaterial({
  datos,
  abierto,
  onCambio,
}: {
  datos: DatosDeClase;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) {
  const t = useTranslations("teacherClasses");
  const router = useRouter();
  const avisar = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formulario = e.currentTarget;
    const cuerpo = new FormData(formulario);

    cuerpo.set("origen", datos.origen);
    cuerpo.set("clase", datos.id);
    cuerpo.set("periodo", datos.periodoId ?? "");
    iniciar(async () => {
      const res = await publicarMaterialDeClase(cuerpo);

      if (res.estado === "ok") {
        avisar({ titulo: t("material.created") });
        formulario.reset();
        router.refresh();
        onCambio(false);
      } else {
        setError(t(`material.err.${res.estado}` as never));
      }
    });
  };

  return (
    <SidePanelForm
      open={abierto}
      onOpenChange={onCambio}
      title={t("material.new")}
      description={datos.nombre}
      submitLabel={t("material.create")}
      pending={pendiente}
      onSubmit={enviar}
      moreDetails={
        <div className="space-y-2">
          <Label htmlFor="m-desc">{t("tasks.description")}</Label>
          <Textarea id="m-desc" name="descripcion" rows={3} />
        </div>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="m-titulo">{t("tasks.name")}</Label>
        <Input id="m-titulo" name="titulo" required maxLength={160} autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="m-archivo">{t("material.file")}</Label>
        <Input id="m-archivo" name="archivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.pptx,.docx" />
        <p className="text-meta">{t("material.fileHint")}</p>
      </div>
      {error && (
        <p role="alert" className="text-body rounded-control bg-tinta p-3 text-background">
          {error}
        </p>
      )}
    </SidePanelForm>
  );
}
