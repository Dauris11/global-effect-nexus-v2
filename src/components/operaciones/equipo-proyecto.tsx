"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Save, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { OpcionOperaciones } from "@/server/operaciones/consultas";
import { guardarEquipoProyecto } from "@/server/operaciones/torre-acciones";
import type { EquipoProyecto as Equipo } from "@/server/operaciones/torre-consultas";

import { AvisoError, CLASE_SELECT } from "./torre-dialogos";

/**
 * Líder y miembros de un proyecto. Es lo que hace que el proyecto aparezca en
 * la torre de cada persona aunque todavía no tenga tareas suyas.
 */
export function EquipoProyecto({
  proyectoId,
  equipo,
  personas,
}: {
  proyectoId: string;
  equipo: Equipo;
  personas: readonly OpcionOperaciones[];
}) {
  const t = useTranslations("torre");
  const [resultado, setResultado] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function enviar(datos: FormData) {
    iniciar(async () => {
      const r = await guardarEquipoProyecto(datos);
      setResultado(r.ok ? "ok" : r.error);
    });
  }

  return (
    <Card className="p-5">
      <form action={enviar} className="space-y-4">
        <input type="hidden" name="proyecto" value={proyectoId} />
        <h2 className="texto-titulo-tarjeta flex items-center gap-2">
          <Users className="size-5 text-tinta-2" />
          {t("projectTeam.title")}
        </h2>
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="eq-lider">{t("projectTeam.lead")}</Label>
          <select id="eq-lider" name="responsable" defaultValue={equipo.responsable_id ?? ""} className={CLASE_SELECT}>
            <option value="">{t("projectTeam.noLead")}</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t("projectTeam.members")}</legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {personas.map((p) => (
              <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="miembro"
                  value={p.id}
                  defaultChecked={equipo.miembros.includes(p.id)}
                  className="size-4 accent-marca-500"
                />
                <span className="truncate">{p.nombre}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {resultado && resultado !== "ok" && <AvisoError clave={resultado} />}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={guardando}>
            {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t("projectTeam.save")}
          </Button>
          {resultado === "ok" && !guardando && (
            <span role="status" className="inline-flex items-center gap-1 texto-meta">
              <CheckCircle2 className="size-4 text-marca-500" />
              {t("projectTeam.saved")}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
