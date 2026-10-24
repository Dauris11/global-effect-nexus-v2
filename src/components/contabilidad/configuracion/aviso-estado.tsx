"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { AvisoError, AvisoOk } from "@/components/contabilidad/comun";
import type { EstadoConfig } from "@/server/contabilidad/configuracion/acciones";

export const ESTADO_INICIAL: EstadoConfig = { estado: "inicial" };

type AccionConfig = (previo: EstadoConfig, datos: FormData) => Promise<EstadoConfig>;

/**
 * `useActionState` con un aviso al terminar bien. El aviso va dentro de la
 * acción y no en un efecto: así el diálogo se cierra en la misma transición
 * que trae la respuesta, y al reabrirlo el formulario nace limpio (Radix
 * desmonta el contenido cerrado).
 */
export function useAccionConfig(accion: AccionConfig, alTerminar?: () => void) {
  return useActionState<EstadoConfig, FormData>(async (previo, datos) => {
    const resultado = await accion(previo, datos);
    if (resultado.estado === "ok") alTerminar?.();
    return resultado;
  }, ESTADO_INICIAL);
}

/**
 * El resultado de una acción de Configuración, ya traducido. El "ok" solo
 * se muestra donde el formulario sigue a la vista (la entidad); en un
 * diálogo, el diálogo se cierra y eso ya lo dice.
 */
export function AvisoEstado({ estado, mostrarOk = false }: { estado: EstadoConfig; mostrarOk?: boolean }) {
  const t = useTranslations("contab.config.error");
  const tc = useTranslations("contab.config");

  if (estado.estado === "inicial") return null;
  if (estado.estado === "ok") return mostrarOk ? <AvisoOk>{tc("guardado")}</AvisoOk> : null;
  return <AvisoError>{t(estado.estado)}</AvisoError>;
}
