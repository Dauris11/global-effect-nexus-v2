"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { ALERTA_RIESGO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import { marcarServicio } from "@/server/bienestar/acciones";
import type { FilaServicio } from "@/server/bienestar/consultas";

/**
 * Planilla de servicio y reunión: una fila por estudiante, dos casillas.
 *
 * SE GUARDA AL MARCAR, sin botón. Es una lista de asistencia de decenas de
 * filas: obligar a pulsar "guardar" al final significa que un despiste pierde
 * media hora de trabajo, y un botón por fila llenaría la pantalla de botones.
 *
 * La casilla cambia en pantalla ANTES de que conteste el servidor y **vuelve a
 * su sitio si la escritura falla**, con el aviso al pie. Una casilla que se
 * queda marcada tras un error es peor que una que no se deja marcar: dice que
 * el dato está guardado cuando no lo está.
 *
 * Las dos marcas viajan juntas en cada envío aunque solo cambie una. La fila de
 * la base guarda las dos y el navegador conoce las dos; mandar solo la que
 * cambió obligaría al servidor a leer la otra para no borrarla.
 */
export function PlanillaServicios({
  filas,
  mes,
  puedeEscribir,
}: {
  filas: readonly FilaServicio[];
  mes: string;
  puedeEscribir: boolean;
}) {
  const t = useTranslations("monthlyServices");

  /** Lo marcado en pantalla mientras el servidor confirma. */
  const [local, setLocal] = useState<
    Record<string, { servicio: boolean; reunion: boolean }>
  >({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const [, empezar] = useTransition();

  const estadoDe = (fila: FilaServicio) =>
    local[fila.estudiante_id] ?? {
      servicio: fila.hizo_servicio,
      reunion: fila.asistio_reunion,
    };

  function marcar(fila: FilaServicio, campo: "servicio" | "reunion") {
    if (!puedeEscribir) return;

    const previo = estadoDe(fila);
    const siguiente = { ...previo, [campo]: !previo[campo] };

    setFallo(false);
    setLocal((estado) => ({ ...estado, [fila.estudiante_id]: siguiente }));
    setGuardando(fila.estudiante_id);

    empezar(async () => {
      const datos = new FormData();
      datos.set("estudiante", fila.estudiante_id);
      datos.set("mes", mes);
      datos.set("servicio", siguiente.servicio ? "1" : "0");
      datos.set("reunion", siguiente.reunion ? "1" : "0");

      const resultado = await marcarServicio({ estado: "inicial" }, datos);

      setGuardando(null);

      if (resultado.estado !== "ok") {
        // Vuelve a como estaba: una casilla marcada que no se guardó miente.
        setLocal((estado) => ({ ...estado, [fila.estudiante_id]: previo }));
        setFallo(true);
      }
    });
  }

  return (
    <div className="space-y-3">
      {!puedeEscribir && (
        <p className="text-muted-foreground text-xs print:hidden">
          {t("readOnly")}
        </p>
      )}

      {fallo && (
        <p role="alert" className={cn(ALERTA_RIESGO.contenedor, "print:hidden")}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{t("error")}</span>
        </p>
      )}

      {/* La tabla se desplaza dentro de su caja y no empuja la página: con dos
          columnas de casillas y nombres largos, a 360px no cabe de otra forma. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="w-10 py-2 font-medium">#</th>
              <th className="py-2 font-medium">{t("student")}</th>
              <th className="py-2 font-medium">{t("program")}</th>
              <th className="w-32 py-2 text-center font-medium">
                {t("service")}
              </th>
              <th className="w-32 py-2 text-center font-medium">
                {t("meeting")}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {filas.map((fila, indice) => {
              const marcas = estadoDe(fila);
              const ocupada = guardando === fila.estudiante_id;

              return (
                <tr key={fila.estudiante_id} className="hover:bg-muted/30">
                  <td className="text-muted-foreground py-2 text-xs">
                    {indice + 1}
                  </td>
                  <td className="py-2 font-medium">{fila.nombre}</td>
                  <td className="text-muted-foreground py-2 text-xs">
                    {fila.programa ?? "—"}
                  </td>

                  <td className="py-2 text-center">
                    <Casilla
                      marcada={marcas.servicio}
                      ocupada={ocupada}
                      activa={puedeEscribir}
                      etiqueta={`${t("service")} · ${fila.nombre}`}
                      alPulsar={() => marcar(fila, "servicio")}
                    />
                  </td>

                  <td className="py-2 text-center">
                    <Casilla
                      marcada={marcas.reunion}
                      ocupada={ocupada}
                      activa={puedeEscribir}
                      etiqueta={`${t("meeting")} · ${fila.nombre}`}
                      alPulsar={() => marcar(fila, "reunion")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs print:hidden">{t("hint")}</p>
    </div>
  );
}

/**
 * Una casilla.
 *
 * `input type="checkbox"` de verdad y no un `div` estilizado: el navegador ya
 * sabe enfocarlo con teclado, marcarlo con la barra espaciadora y anunciarlo a
 * un lector de pantalla. El `aria-label` lleva a quién y a qué corresponde,
 * porque en una tabla de cien filas "casilla marcada" a secas no dice nada.
 */
function Casilla({
  marcada,
  ocupada,
  activa,
  etiqueta,
  alPulsar,
}: {
  marcada: boolean;
  ocupada: boolean;
  activa: boolean;
  etiqueta: string;
  alPulsar: () => void;
}) {
  if (ocupada) {
    return <Loader2 className="mx-auto size-4 animate-spin text-[#187a99]" />;
  }

  return (
    <input
      type="checkbox"
      checked={marcada}
      disabled={!activa}
      onChange={alPulsar}
      aria-label={etiqueta}
      className="size-4 accent-[#2096BA] disabled:opacity-50"
    />
  );
}
