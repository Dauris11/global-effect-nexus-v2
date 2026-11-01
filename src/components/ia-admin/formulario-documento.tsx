"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ingerirDocumento,
  type EstadoConocimiento,
} from "@/server/ia/acciones-conocimiento";

const INICIAL: EstadoConocimiento = { estado: "inicial" };

/** Cargar un documento: el texto se corta en fragmentos y queda asignado a agentes. */
export function FormularioDocumento({
  agentes,
}: {
  /** Agentes que quien carga puede usar, ya con su nombre traducido. */
  agentes: { clave: string; nombre: string }[];
}) {
  const t = useTranslations("iaAdmin");
  const [estado, accion, pendiente] = useActionState(ingerirDocumento, INICIAL);

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="doc-titulo">{t("knowledge.docTitle")}</Label>
          <Input id="doc-titulo" name="titulo" required maxLength={160} />
        </div>
        <div>
          <Label htmlFor="doc-fuente">{t("knowledge.source")}</Label>
          <Input id="doc-fuente" name="fuente" required maxLength={240} placeholder={t("knowledge.sourceHint")} />
        </div>
        <div>
          <Label htmlFor="doc-version">{t("knowledge.version")}</Label>
          <Input id="doc-version" name="version" maxLength={40} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="doc-verificado">{t("knowledge.verifiedOn")}</Label>
            <Input id="doc-verificado" name="verificado_el" type="date" />
          </div>
          <div>
            <Label htmlFor="doc-vigente">{t("knowledge.validUntil")}</Label>
            <Input id="doc-vigente" name="vigente_hasta" type="date" />
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">{t("knowledge.agents")}</legend>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {agentes.map((agente) => (
            <label key={agente.clave} className="flex min-h-11 items-center gap-2 text-[15px]">
              <input type="checkbox" name="agentes" value={agente.clave} className="size-4" />
              {agente.nombre}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="doc-texto">{t("knowledge.text")}</Label>
        <textarea
          id="doc-texto"
          name="texto"
          required
          rows={10}
          className="border-linea-fuerte bg-background w-full rounded-control border px-3 py-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {t("knowledge.upload")}
        </Button>

        {estado.estado === "ok" && (
          <p role="status" className="text-marca-700 flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            {t("knowledge.uploaded")}
          </p>
        )}
        {estado.estado !== "ok" && estado.estado !== "inicial" && (
          <p role="alert" className="text-tinta flex items-center gap-1.5 text-sm font-medium">
            <AlertCircle className="size-4" />
            {t(`knowledge.error.${estado.estado}`)}
          </p>
        )}
      </div>
    </form>
  );
}
