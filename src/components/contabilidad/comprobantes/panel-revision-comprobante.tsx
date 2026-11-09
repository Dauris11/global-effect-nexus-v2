"use client";

import { useState } from "react";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  ExternalLink,
  Receipt,
  Search,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { ComprobanteRecibidoFila } from "@/server/contabilidad/comprobantes/recibidos-consultas";
import { validarComprobanteRecibido } from "@/server/contabilidad/comprobantes/recibidos-acciones";

export function PanelRevisionComprobante({
  comprobantes,
  proyectos = [],
  puedeValidar = false,
}: {
  comprobantes: ComprobanteRecibidoFila[];
  proyectos?: { id: string; nombre: string }[];
  /** `contabilidad.registrar`: quien solo consulta no ve botones que fallarían. */
  puedeValidar?: boolean;
}) {
  const t = useTranslations("contab.comprobantesRecibidos");
  const router = useRouter();
  const [errorGuardar, setErrorGuardar] = useState(false);
  const [seleccionado, setSeleccionado] = useState<ComprobanteRecibidoFila | null>(
    comprobantes[0] ?? null,
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [guardando, setGuardando] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [proyectoId, setProyectoId] = useState<string>(seleccionado?.proyecto_id || "");

  const filtrados = comprobantes.filter((c) => {
    const coincideEstado = filtroEstado === "todos" || c.estado === filtroEstado;
    const coincideBusqueda =
      !busqueda ||
      c.concepto.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.proveedor_nombre && c.proveedor_nombre.toLowerCase().includes(busqueda.toLowerCase())) ||
      c.remitente_nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideEstado && coincideBusqueda;
  });

  const handleValidar = async (nuevoEstado: "validado" | "observado" | "rechazado") => {
    if (!seleccionado) return;
    setGuardando(true);
    setErrorGuardar(false);
    try {
      const res = await validarComprobanteRecibido({
        id: seleccionado.id,
        estado: nuevoEstado,
        proyectoId: proyectoId || undefined,
        observaciones: observacion || undefined,
      });
      if (res.ok) {
        const proyObj = proyectos.find((p) => p.id === proyectoId);
        setSeleccionado({
          ...seleccionado,
          estado: nuevoEstado,
          proyecto_id: proyectoId || null,
          proyecto_nombre: proyObj ? proyObj.nombre : null,
        });
        setObservacion("");
        router.refresh();
      } else {
        setErrorGuardar(true);
      }
    } catch {
      setErrorGuardar(true);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Columna izquierda: Lista de comprobantes */}
      <div className="space-y-3 lg:col-span-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-tinta-3" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-control border border-linea bg-card px-3 text-sm text-tinta outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="todos">{t("filterAll")}</option>
            <option value="recibido">{t("stats.pending")}</option>
            <option value="validado">{t("stats.validated")}</option>
            <option value="observado">{t("stats.observed")}</option>
            <option value="rechazado">{t("stats.rejected")}</option>
          </select>
        </div>

        <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
          {filtrados.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-tinta-3">
                {t("empty")}
              </CardContent>
            </Card>
          ) : (
            filtrados.map((comp) => {
              const esActivo = seleccionado?.id === comp.id;
              return (
                <div
                  key={comp.id}
                  onClick={() => {
                    setSeleccionado(comp);
                    setObservacion(comp.observaciones || "");
                    setProyectoId(comp.proyecto_id || "");
                  }}
                  className={`cursor-pointer rounded-control border p-4 transition-all ${
                    esActivo
                      ? "border-marca-500 bg-marca-50/20 shadow-xs"
                      : "border-linea bg-card hover:border-marca-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-tinta-3">
                      {t("folio", { folio: comp.folio })}
                    </span>
                    <Badge
                      variant={
                        comp.estado === "validado"
                          ? "marca"
                          : comp.estado === "rechazado"
                            ? "destructive"
                            : "neutra"
                      }
                      className="text-xs capitalize"
                    >
                      {t(`stats.${comp.estado === "recibido" ? "pending" : comp.estado === "validado" ? "validated" : comp.estado === "observado" ? "observed" : comp.estado === "rechazado" ? "rejected" : "posted"}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 font-semibold text-tinta line-clamp-1">
                    {comp.concepto}
                  </p>
                  {comp.proyecto_nombre && (
                    <span className="mt-1 inline-block rounded-md bg-marca-50 px-2 py-0.5 text-[11px] font-medium text-marca-700">
                      {comp.proyecto_nombre}
                    </span>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-tinta-2">
                    <span>{comp.remitente_nombre}</span>
                    <span className="font-mono font-bold text-tinta">
                      {comp.moneda} {Number(comp.monto).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Columna derecha: Detalle, previsualización y acciones */}
      <div className="lg:col-span-7">
        {seleccionado ? (
          <div className="space-y-4 rounded-card border border-linea bg-card p-6 shadow-card">
            <div className="flex items-center justify-between border-b border-linea pb-4">
              <div>
                <span className="texto-meta text-xs">{t("detailTitle")}</span>
                <h2 className="text-xl font-bold text-tinta">
                  {seleccionado.concepto}
                </h2>
              </div>
              <Badge
                variant={
                  seleccionado.estado === "validado" ? "marca" : "neutra"
                }
                className="text-sm capitalize"
              >
                {t(`stats.${seleccionado.estado === "recibido" ? "pending" : seleccionado.estado === "validado" ? "validated" : seleccionado.estado === "observado" ? "observed" : seleccionado.estado === "rechazado" ? "rejected" : "posted"}`)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="texto-meta text-xs">{t("amount")}</p>
                <p className="font-mono text-base font-bold text-tinta">
                  {seleccionado.moneda}{" "}
                  {Number(seleccionado.monto).toLocaleString("es-DO", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="texto-meta text-xs">{t("sender")}</p>
                <p className="font-medium text-tinta">{seleccionado.remitente_nombre}</p>
              </div>
              <div>
                <p className="texto-meta text-xs">{t("date")}</p>
                <p className="text-tinta">{seleccionado.fecha_comprobante}</p>
              </div>
              <div>
                <p className="texto-meta text-xs">{t("vendor")}</p>
                <p className="text-tinta">{seleccionado.proveedor_nombre || t("unspecified")}</p>
              </div>
              <div>
                <p className="texto-meta text-xs">{t("rnc")}</p>
                <p className="font-mono text-tinta">{seleccionado.proveedor_rnc || "—"}</p>
              </div>
              <div>
                <p className="texto-meta text-xs">{t("ncf")}</p>
                <p className="font-mono text-tinta">{seleccionado.ncf || "—"}</p>
              </div>
            </div>

            {/* Vinculación de Programa / Proyecto */}
            <div className="rounded-control border border-linea bg-muted/30 p-3.5 space-y-1.5">
              <label className="text-xs font-semibold text-tinta flex items-center gap-1.5">
                <Building className="size-3.5 text-marca-600" />
                {t("linkProject")}
              </label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
                className="w-full rounded-control border border-linea bg-card p-2 text-sm text-tinta outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("noProject")}</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {seleccionado.proyecto_nombre && (
                <p className="texto-meta text-xs">
                  {t("assignedTo", { project: seleccionado.proyecto_nombre })}
                </p>
              )}
            </div>

            {/* Previsualización del comprobante / imagen */}
            <div className="rounded-control border border-linea bg-muted/30 p-4">
              <p className="texto-meta mb-2 text-xs font-semibold uppercase">
                {t("attachment")}
              </p>
              {seleccionado.archivo_url ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <a
                    href={seleccionado.archivo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-marca-600 underline flex items-center gap-1 font-medium"
                  >
                    {t("viewOriginal")} <ExternalLink className="size-3.5" />
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-tinta-3">
                  <Receipt className="size-4" />
                  <span>{t("noAttachment")}</span>
                </div>
              )}
            </div>

            {/* Observaciones o correcciones */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-tinta">
                {t("notesLabel")}
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="w-full rounded-control border border-linea p-3 text-sm focus:border-marca-500 focus:outline-none"
                rows={2}
              />
            </div>

            {errorGuardar && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs text-background"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {t("saveError")}
              </p>
            )}

            {/* Botones de acción */}
            {puedeValidar && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-linea">
              <Button
                variant="outline"
                size="sm"
                disabled={guardando}
                onClick={() => handleValidar("observado")}
                className="text-tinta-2 hover:bg-muted"
              >
                <AlertCircle className="size-4 mr-1 text-tinta-2" />
                {t("markObserved")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={guardando}
                onClick={() => handleValidar("rechazado")}
                className="text-tinta"
              >
                <XCircle className="size-4 mr-1" />
                {t("reject")}
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={guardando}
                onClick={() => handleValidar("validado")}
              >
                <CheckCircle2 className="size-4 mr-1" />
                {t("approveAndValidate")}
              </Button>
            </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-sm text-tinta-3">
              {t("noSelection")}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
