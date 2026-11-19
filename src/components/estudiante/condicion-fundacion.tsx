import {
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  XCircle,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FILA, Seccion } from "@/components/estudiante/seccion";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { INSIGNIA_SEMAFORO, SEMAFORO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { CondicionMes } from "@/server/estudiantes/portal";

type NivelCondicion = "dentro" | "advertencia" | "alerta";

function evaluarNivel(cumplidos: number, total: number): NivelCondicion {
  if (total === 0) return "advertencia";
  const ratio = cumplidos / total;
  if (ratio >= 0.8) return "dentro";
  if (ratio >= 0.5) return "advertencia";
  return "alerta";
}

/**
 * Servicio mensual y reuniones de los últimos meses con semáforo de condición
 * (verde: al día, naranja: en observación, rojo: en riesgo).
 */
export async function CondicionFundacion({
  condicion,
}: {
  condicion: readonly CondicionMes[];
}) {
  const t = await getTranslations("studentPortal");

  const serviciosCumplidos = condicion.filter((m) => m.hizo_servicio).length;
  const reunionesCumplidas = condicion.filter((m) => m.asistio_reunion).length;
  const totalMarcas = condicion.length * 2;
  const cumplidasTotal = serviciosCumplidos + reunionesCumplidas;
  const porcentajeGlobal =
    totalMarcas > 0 ? Math.round((cumplidasTotal / totalMarcas) * 100) : 0;
  const nivelGlobal = evaluarNivel(cumplidasTotal, totalMarcas);

  const IconoGlobal =
    nivelGlobal === "dentro"
      ? CheckCircle2
      : nivelGlobal === "advertencia"
        ? AlertTriangle
        : XCircle;

  const colorBarra =
    nivelGlobal === "dentro"
      ? SEMAFORO.dentro
      : nivelGlobal === "advertencia"
        ? SEMAFORO.advertencia
        : SEMAFORO.alerta;

  return (
    <Seccion titulo={t("standingTitle")}>
      {condicion.length === 0 ? (
        <EstadoVacio icono={HeartHandshake} titulo={t("standingEmpty")} />
      ) : (
        <div className="space-y-4">
          {/* Semáforo general de condición */}
          <div className="space-y-2 rounded-card border border-linea bg-card p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-tinta-2">
                {t("standingSummary", {
                  services: serviciosCumplidos,
                  months: condicion.length,
                  meetings: reunionesCumplidas,
                })}
              </p>

              <Badge
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold",
                  INSIGNIA_SEMAFORO[nivelGlobal],
                )}
              >
                <IconoGlobal className="size-3.5" aria-hidden />
                {t(`standingLevel.${nivelGlobal}`)} ({porcentajeGlobal}%)
              </Badge>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${porcentajeGlobal}%`,
                  backgroundColor: colorBarra,
                }}
              />
            </div>
          </div>

          <ul>
            {condicion.map((mes) => {
              const nivelMes: NivelCondicion =
                mes.hizo_servicio && mes.asistio_reunion
                  ? "dentro"
                  : mes.hizo_servicio || mes.asistio_reunion
                    ? "advertencia"
                    : "alerta";

              return (
                <li key={mes.mes} className={FILA}>
                  <div className="flex w-24 shrink-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: SEMAFORO[nivelMes] }}
                    />
                    <span className="text-sm font-semibold">{mes.mes}</span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <Marca
                      cumplido={mes.hizo_servicio}
                      etiqueta={mes.hizo_servicio ? t("service") : t("noService")}
                    />
                    <Marca
                      cumplido={mes.asistio_reunion}
                      etiqueta={
                        mes.asistio_reunion ? t("meeting") : t("noMeeting")
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Seccion>
  );
}

function Marca({
  cumplido,
  etiqueta,
}: {
  cumplido: boolean;
  etiqueta: string;
}) {
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        cumplido ? INSIGNIA_SEMAFORO.dentro : INSIGNIA_SEMAFORO.alerta,
      )}
    >
      {cumplido ? (
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <XCircle className="size-3.5 shrink-0" aria-hidden />
      )}
      <span>{etiqueta}</span>
    </Badge>
  );
}
