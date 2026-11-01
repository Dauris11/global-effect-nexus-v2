"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claveI18n } from "@/lib/actividad";
import { cn } from "@/lib/utils";
import {
  guardarParametros,
  type EstadoParametros,
} from "@/server/parametros/acciones";

const INICIAL: EstadoParametros = { estado: "inicial" };

export type CampoParametro = {
  clave: string;
  grupo: string;
  tipo: "hora" | "numero" | "correo";
  valor: string;
  porDefecto: string;
  minimo?: number;
  maximo?: number;
  decimales?: number;
  /** Quién y cuándo lo cambió por última vez, ya formateado. */
  ultimoCambio: string | null;
};

/**
 * Los parámetros institucionales, agrupados. Cada campo enseña su valor normal y
 * permite volver a él; el servidor valida todo otra vez y dice qué campo falló.
 */
export function FormularioParametros({
  grupos,
}: {
  grupos: { clave: string; campos: CampoParametro[] }[];
}) {
  const t = useTranslations("parametros");
  const [resultado, accion, pendiente] = useActionState(guardarParametros, INICIAL);

  const inicial = Object.fromEntries(grupos.flatMap((g) => g.campos.map((c) => [c.clave, c.valor])));
  const [valores, setValores] = useState<Record<string, string>>(inicial);

  return (
    <form action={accion} className="space-y-8">
      {grupos.map((grupo) => (
        <section key={grupo.clave} className="space-y-3">
          <p className="texto-titulo-seccion">{t(`groups.${grupo.clave}.title`)}</p>

          <div className="divide-linea rounded-card border-linea divide-y border">
            {grupo.campos.map((campo) => {
              const k = claveI18n(campo.clave);
              const error = resultado.errores?.[campo.clave];
              const cambiado = valores[campo.clave] !== campo.porDefecto;

              return (
                <div key={campo.clave} className="grid gap-3 p-4 sm:grid-cols-[1fr_14rem] sm:items-start">
                  <div className="min-w-0">
                    <Label htmlFor={`p-${k}`}>{t(`items.${k}.label`)}</Label>
                    <p className="texto-meta mt-0.5">{t(`items.${k}.hint`)}</p>
                    {campo.ultimoCambio && <p className="texto-meta mt-1">{campo.ultimoCambio}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Input
                      id={`p-${k}`}
                      name={campo.clave}
                      type={campo.tipo === "hora" ? "time" : campo.tipo === "correo" ? "email" : "number"}
                      inputMode={campo.tipo === "numero" ? "decimal" : undefined}
                      step={campo.tipo === "hora" ? 60 : campo.tipo === "numero" ? 1 / 10 ** (campo.decimales ?? 0) : undefined}
                      min={campo.minimo}
                      max={campo.maximo}
                      required
                      value={valores[campo.clave]}
                      onChange={(e) => setValores((v) => ({ ...v, [campo.clave]: e.target.value }))}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `e-${k}` : undefined}
                    />

                    <div className="flex items-center justify-between gap-2">
                      <span className="texto-meta">{t("normal", { valor: campo.porDefecto })}</span>
                      {cambiado && (
                        <button
                          type="button"
                          onClick={() => setValores((v) => ({ ...v, [campo.clave]: campo.porDefecto }))}
                          className="text-marca-700 hover:bg-muted flex min-h-9 items-center gap-1 rounded-control px-2 text-xs font-medium"
                        >
                          <RotateCcw className="size-3.5" />
                          {t("restore")}
                        </button>
                      )}
                    </div>

                    {error && (
                      <p id={`e-${k}`} role="alert" className={cn("flex items-start gap-1.5 text-sm font-medium")}>
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        {error === "rango"
                          ? t("errors.rango", { min: campo.minimo ?? 0, max: campo.maximo ?? 0 })
                          : t(`errors.${error}`)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("save")}
        </Button>

        {resultado.estado === "ok" && (
          <p role="status" className="text-marca-700 flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            {t("saved", { n: resultado.cambiados ?? 0 })}
          </p>
        )}
        {resultado.estado === "sin_cambios" && <p role="status" className="texto-meta">{t("noChanges")}</p>}
        {resultado.estado === "invalido" && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-medium">
            <AlertCircle className="size-4" />
            {t("checkFields")}
          </p>
        )}
        {resultado.estado === "error" && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-medium">
            <AlertCircle className="size-4" />
            {t("failed")}
          </p>
        )}
      </div>
    </form>
  );
}
