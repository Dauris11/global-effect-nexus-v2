"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Interruptor } from "@/components/ui/interruptor";
import { guardarParametroTecnico } from "@/server/parametros/acciones-tecnicas";
import type { ClaveParametroTecnico } from "@/server/parametros/tecnicos";

/**
 * Interruptor de un parámetro técnico booleano. Guarda al pulsar y vuelve atrás si el servidor rechaza: la
 * acción exige `tecnico.parametros`, así que un botón visible para quien no debe no daría acceso a nada.
 */
export function InterruptorTecnico({
  clave,
  inicial,
  etiqueta,
  ayuda,
  editable,
}: {
  clave: ClaveParametroTecnico;
  inicial: boolean;
  etiqueta: string;
  ayuda: string;
  editable: boolean;
}) {
  const t = useTranslations("parametros");
  const [activo, setActivo] = useState(inicial);
  const [estado, setEstado] = useState<"ok" | "error" | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cambiar = (valor: boolean) => {
    setActivo(valor);
    setEstado(null);
    iniciar(async () => {
      const r = await guardarParametroTecnico(clave, valor ? "true" : "false");

      if (r.ok) {
        setEstado("ok");
      } else {
        setActivo(!valor);
        setEstado("error");
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-tinta">{etiqueta}</p>
          <p className="text-meta mt-0.5 max-w-prose">{ayuda}</p>
        </div>
        <Interruptor activo={activo} onCambio={cambiar} etiqueta={etiqueta} deshabilitado={!editable || pendiente} />
      </div>
      {estado === "ok" && (
        <p role="status" className="text-meta">
          {t("technicalSaved")}
        </p>
      )}
      {estado === "error" && <Alert variant="danger">{t("technicalFailed")}</Alert>}
    </div>
  );
}
