"use client";

import { Bell, CalendarClock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";

import { StatusBadge } from "@/components/app/status-badge";
import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cerrarVentana, type EstadoAdmin360 } from "@/server/global360/acciones";
import { recordarPrematricula } from "@/server/global360/acciones-recordatorio";
import type { EleccionEstudiante } from "@/server/global360/prematricula-admin";

/** Una ventana, para la tarjeta de arriba (fechas ya en hora de La Vega, `YYYY-MM-DD HH:MM`). */
export type VentanaVista = { id: string; periodo: string; ronda: 1 | 2; abre: string; cierra: string; abierta: boolean };

/**
 * Lo primero de Prematrícula: la ventana vigente (fechas, «Cerrar ventana» o «Abrir ventana») con el progreso
 * «9 de 13 estudiantes eligieron», y debajo la tabla de estudiantes con su estado de elección y «Recordar» en
 * la fila. El catálogo y el alta de ventanas siguen debajo, en la administración.
 */
export function VentanaYElecciones({ ventana, elecciones }: { ventana: VentanaVista | null; elecciones: readonly EleccionEstudiante[] }) {
  const t = useTranslations("global360");
  const avisar = useToast();
  const [estadoCierre, cerrar, cerrando] = useActionState<EstadoAdmin360, FormData>(cerrarVentana, { estado: "inicial" });
  const [recordados, setRecordados] = useState<ReadonlySet<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const eligieron = elecciones.filter((e) => e.eligio).length;
  const porcentaje = elecciones.length > 0 ? Math.round((eligieron / elecciones.length) * 100) : 0;

  const recordar = (e: EleccionEstudiante) => {
    setOcupado(e.id);
    iniciar(async () => {
      const r = await recordarPrematricula(e.id);
      setOcupado(null);
      if (r.ok) {
        setRecordados((s) => new Set(s).add(e.id));
        avisar({ titulo: t("reminded", { nombre: e.nombre }) });
      } else {
        avisar({ titulo: r.error === "sin_cuenta" ? t("noAccount") : t("errGeneric") });
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        {ventana ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <CalendarClock aria-hidden className="size-4 text-tinta-2" />
                  <span className="text-section">
                    {ventana.periodo} · {t(ventana.ronda === 1 ? "tanda1" : "tanda2")}
                  </span>
                  <StatusBadge status={ventana.abierta ? "activo" : "pendiente"} label={ventana.abierta ? t("windowOpen") : t("windowSoon")} />
                </p>
                <p className="text-meta mt-1">
                  {ventana.abre.slice(0, 16).replace("T", " ")} → {ventana.cierra.slice(0, 16).replace("T", " ")}
                </p>
              </div>
              {ventana.abierta ? (
                <form action={cerrar}>
                  <input type="hidden" name="id" value={ventana.id} />
                  <Button type="submit" variant="secondary" cargando={cerrando}>
                    {t("closeWindowBtn")}
                  </Button>
                </form>
              ) : null}
            </div>
            {estadoCierre.estado !== "inicial" && estadoCierre.estado !== "ok" && (
              <p role="alert" className="text-meta">{t("errGeneric")}</p>
            )}
            <div className="space-y-1">
              <p className="text-body font-semibold">{t("electionProgress", { n: eligieron, total: elecciones.length })}</p>
              <Progress value={porcentaje} aria-label={t("electionProgress", { n: eligieron, total: elecciones.length })} />
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body">{t("noActiveWindow")}</p>
            <Button asChild>
              <a href="#ventanas">{t("openWindow")}</a>
            </Button>
          </div>
        )}
      </Card>

      {ventana && elecciones.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-linea bg-card">
          <table data-list className="w-full text-sm">
            <thead className="text-meta border-b border-linea text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t("studentCol")}</th>
                <th className="px-4 py-3 font-medium">{t("choiceCol")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {elecciones.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 font-medium">{e.nombre}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={e.eligio ? "completado" : "pendiente"} label={e.eligio ? t("chose") : t("notChosen")} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!e.eligio && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recordar(e)}
                        disabled={!e.puedeAvisarse || recordados.has(e.id) || ocupado === e.id}
                      >
                        {ocupado === e.id ? <Loader2 aria-hidden className="animate-spin" /> : <Bell aria-hidden />}
                        {recordados.has(e.id) ? t("reminderSent") : t("remind")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
