import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Diamond,
  GanttChartSquare,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { cuentasPorPagar, type FilaCxp } from "@/server/contabilidad/cxp/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.gantt" });
  return { title: t("titulo") };
}

const DIA_MS = 86_400_000;

function aMs(fechaIso: string): number {
  const d = new Date(`${fechaIso}T00:00:00Z`);
  return d.getTime();
}

export default async function PaginaGanttCxp({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ agrupar?: string }>;
}) {
  const { locale } = await params;
  const { agrupar = "proveedor" } = await searchParams;
  await requerirPermiso("contabilidad.leer");

  const [t, cuentas] = await Promise.all([
    getTranslations({ locale, namespace: "contab.gantt" }),
    cuentasPorPagar("abiertas"),
  ]);

  const hoyStr = claveDia();
  const hoyMs = aMs(hoyStr);

  // Calcular la ventana de tiempo para el diagrama
  let minMs = hoyMs - 15 * DIA_MS;
  let maxMs = hoyMs + 45 * DIA_MS;

  for (const c of cuentas) {
    const emi = aMs(c.fecha_emision);
    const ven = aMs(c.fecha_vencimiento);
    if (!Number.isNaN(emi) && emi < minMs) minMs = emi;
    if (!Number.isNaN(ven) && ven > maxMs) maxMs = ven;
    if (c.fecha_programada) {
      const prog = aMs(c.fecha_programada);
      if (!Number.isNaN(prog) && prog > maxMs) maxMs = prog;
    }
  }

  const duracionTotal = Math.max(DIA_MS, maxMs - minMs);

  const pct = (ms: number) => {
    const p = ((ms - minMs) / duracionTotal) * 100;
    return Math.max(0, Math.min(100, p));
  };

  const hoyPct = pct(hoyMs);

  // Agrupación
  const grupos = new Map<string, FilaCxp[]>();
  for (const c of cuentas) {
    const clave =
      agrupar === "proyecto"
        ? c.proyecto ?? t("sinProyecto")
        : c.tercero;
    const arr = grupos.get(clave) ?? [];
    arr.push(c);
    grupos.set(clave, arr);
  }

  const inicioStr = new Date(minMs).toISOString().slice(0, 10);
  const finStr = new Date(maxMs).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href="/contabilidad/cuentas-por-pagar">
            <ArrowLeft className="size-4" />
            Volver a cuentas por pagar
          </Link>
        </Button>

        <EncabezadoPagina
          titulo={t("titulo")}
          acciones={
            <div className="flex items-center gap-2">
              <span className="text-xs text-tinta-2 font-medium">{t("agrupar")}:</span>
              <Button
                asChild
                size="sm"
                variant={agrupar === "proveedor" ? "secondary" : "outline"}
              >
                <Link href="/contabilidad/cuentas-por-pagar/gantt?agrupar=proveedor">
                  {t("porProveedor")}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={agrupar === "proyecto" ? "secondary" : "outline"}
              >
                <Link href="/contabilidad/cuentas-por-pagar/gantt?agrupar=proyecto">
                  {t("porProyecto")}
                </Link>
              </Button>
            </div>
          }
        />
      </div>

      {/* Leyenda y rango */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-control border border-linea bg-background p-4 text-xs text-tinta-2">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-alerta" />
            {t("vencida")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-marca-500" />
            {t("aTiempo")}
          </span>
          <span className="flex items-center gap-1.5">
            <Diamond className="size-3 text-tinta fill-tinta rotate-45" />
            {t("programada")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-alerta" />
            {t("hoy")}
          </span>
        </div>
        <p className="font-mono">{t("rango", { inicio: inicioStr, fin: finStr })}</p>
      </div>

      {cuentas.length === 0 ? (
        <div className="rounded-tarjeta border border-linea bg-background p-8 text-center text-tinta-2">
          <p className="font-medium text-tinta">{t("vacio")}</p>
        </div>
      ) : (
        <div className="rounded-tarjeta border border-linea bg-background p-6 space-y-8 overflow-x-auto">
          {Array.from(grupos.entries()).map(([nombreGrupo, items]) => (
            <div key={nombreGrupo} className="space-y-3 min-w-[700px]">
              <div className="flex items-center justify-between border-b border-linea pb-1.5">
                <h3 className="font-semibold text-sm text-tinta flex items-center gap-2">
                  <Users className="size-4 text-tinta-2" />
                  {nombreGrupo}
                </h3>
                <span className="text-xs text-tinta-2">
                  {items.length} {items.length === 1 ? "cuenta" : "cuentas"}
                </span>
              </div>

              <div className="space-y-2">
                {items.map((c) => {
                  const emiMs = aMs(c.fecha_emision);
                  const venMs = aMs(c.fecha_vencimiento);
                  const left = pct(emiMs);
                  const right = pct(venMs);
                  const width = Math.max(3, right - left);
                  const vencida = c.dias_vencida > 0;

                  const progMs = c.fecha_programada ? aMs(c.fecha_programada) : null;
                  const progLeft = progMs ? pct(progMs) : null;

                  return (
                    <div key={c.id} className="group relative">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <Link
                          href={`/contabilidad/cuentas-por-pagar/${c.id}`}
                          className="font-medium text-tinta hover:text-marca-700 hover:underline truncate max-w-sm"
                        >
                          {c.concepto}
                        </Link>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-tinta-2">
                            {c.fecha_emision} → {c.fecha_vencimiento}
                          </span>
                          <Monto valor={c.saldo} moneda={c.moneda} className="font-semibold text-tinta" />
                        </div>
                      </div>

                      {/* Carril de la barra */}
                      <div className="relative h-6 rounded-sm bg-superficie border border-linea overflow-visible">
                        {/* Línea de hoy */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-alerta z-10 pointer-events-none"
                          style={{ left: `${hoyPct}%` }}
                          title={`Hoy: ${hoyStr}`}
                        />

                        {/* Barra de duración */}
                        <div
                          className={`absolute top-1 bottom-1 rounded-sm transition-opacity group-hover:opacity-90 ${
                            vencida ? "bg-alerta text-white" : "bg-marca-500 text-white"
                          }`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${c.concepto}: del ${c.fecha_emision} al ${c.fecha_vencimiento}`}
                        />

                        {/* Marcador de fecha programada */}
                        {progLeft !== null && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none"
                            style={{ left: `${progLeft}%` }}
                            title={`Programada: ${c.fecha_programada}`}
                          >
                            <div className="size-3 bg-tinta rotate-45 border border-background shadow-xs" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
