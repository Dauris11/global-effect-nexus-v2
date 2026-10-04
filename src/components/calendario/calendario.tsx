"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { EventManager, type Entrada } from "@/components/calendario/event-manager";

/**
 * Puente entre la página y el gestor de eventos.
 *
 * Existe por una sola razón: el mes vive en la URL —`?mes=2026-08`— para que la
 * pantalla se pueda enlazar y recargar sin perder dónde estabas, y cambiar la
 * URL es cosa del router, que solo existe en el cliente. El gestor no sabe nada
 * de rutas: recibe el mes y avisa cuando quiere otro.
 *
 * `router.replace` y no `push`: pasar de agosto a septiembre no es un paso del
 * historial, y con `push` el botón "atrás" del navegador tendría que recorrer
 * mes a mes todo lo que la persona haya mirado.
 */
export function Calendario({
  entradas,
  mes,
  hoy,
  puedeCrear,
  puedeMoverCitas,
}: {
  entradas: readonly Entrada[];
  mes: string;
  hoy: string;
  puedeCrear: boolean;
  puedeMoverCitas: boolean;
}) {
  const router = useRouter();
  const parametros = useSearchParams();

  return (
    <EventManager
      entradas={entradas}
      mes={mes}
      hoy={hoy}
      puedeCrear={puedeCrear}
      puedeMoverCitas={puedeMoverCitas}
      onCambiarMes={(nuevo) => {
        const siguientes = new URLSearchParams(parametros);
        siguientes.set("mes", nuevo);
        router.replace(`?${siguientes}`, { scroll: false });
      }}
    />
  );
}
