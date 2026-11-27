"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import type { TipoPrioridad } from "@/lib/prioridades/types";
import { guardarResponsabilidades, restablecerResponsabilidades } from "@/server/prioridades/acciones";

/**
 * «Qué atiende»: casillas agrupadas por módulo con los tipos de pendiente, ya marcadas con lo que
 * le toca hoy a esa persona (su personalización o, si no la hay, el reparto de su rol).
 */
export function QueAtiende({
  userId,
  grupos,
  marcados,
  personalizado,
}: {
  userId: string;
  grupos: { modulo: string; tipos: TipoPrioridad[] }[];
  marcados: TipoPrioridad[];
  personalizado: boolean;
}) {
  const t = useTranslations("priorities");
  const avisar = useToast();
  const [elegidos, setElegidos] = useState(new Set<string>(marcados));
  const [custom, setCustom] = useState(personalizado);
  const [pendiente, iniciar] = useTransition();

  const alternar = (tipo: string) =>
    setElegidos((previo) => {
      const nuevo = new Set(previo);
      if (!nuevo.delete(tipo)) nuevo.add(tipo);

      return nuevo;
    });

  const guardar = () =>
    iniciar(async () => {
      const r = await guardarResponsabilidades(userId, [...elegidos]);
      if (r.ok) {
        setCustom(true);
        avisar({ titulo: t("whatTheyHandle.saved") });
      } else avisar({ titulo: t(`errors.${r.error ?? "error"}`) });
    });

  const restablecer = () =>
    iniciar(async () => {
      const r = await restablecerResponsabilidades(userId);
      if (r.ok) {
        setCustom(false);
        avisar({ titulo: t("whatTheyHandle.saved") });
        window.location.reload();
      }
    });

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-section">{t("whatTheyHandle.title")}</h2>
        <p className="text-meta mt-1 max-w-2xl">
          {t("whatTheyHandle.help")} · {custom ? t("whatTheyHandle.custom") : t("whatTheyHandle.usingDefault")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <fieldset key={g.modulo} className="rounded-card border border-linea bg-card p-4">
            <legend className="text-label px-1">{t(`modules.${g.modulo}`)}</legend>
            <div className="space-y-1">
              {g.tipos.map((tipo) => (
                <label key={tipo} className="text-body flex min-h-11 cursor-pointer items-start gap-3 rounded-control px-1 py-2 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={elegidos.has(tipo)}
                    onChange={() => alternar(tipo)}
                    className="mt-0.5 size-5 shrink-0 accent-[var(--color-marca-500)]"
                  />
                  <span>{t(`types.${tipo}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={guardar} cargando={pendiente}>
          <Save aria-hidden />
          {t("whatTheyHandle.save")}
        </Button>
        {custom && (
          <Button variant="secondary" onClick={restablecer} cargando={pendiente}>
            {t("whatTheyHandle.reset")}
          </Button>
        )}
      </div>
    </section>
  );
}
