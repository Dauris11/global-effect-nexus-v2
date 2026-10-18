"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  FileX,
  FolderOpen,
  Loader2,
  Receipt,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatearMonto } from "@/lib/contabilidad/formato";
import type { EstadoRendicion, RendicionGastoItem } from "@/lib/torre-control";
import { cn } from "@/lib/utils";
import { revisarRendicionGastoAction } from "@/server/colaborador/acciones";

interface ListaRendicionesProps {
  rendiciones: RendicionGastoItem[];
  puedeRevisar: boolean;
}

export function ListaRendiciones({
  rendiciones,
  puedeRevisar,
}: ListaRendicionesProps) {
  const t = useTranslations("rendicion");

  const [filtro, setFiltro] = useState<string>("todas");
  const [rendicionSeleccionada, setRendicionSeleccionada] =
    useState<RendicionGastoItem | null>(null);
  const [modalRevisarAbierto, setModalRevisarAbierto] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtradas = rendiciones.filter((item) => {
    if (filtro === "todas") return true;
    return item.estado === filtro;
  });

  const ejecutarRevision = (estado: EstadoRendicion) => {
    if (!rendicionSeleccionada) return;

    const datos = new FormData();
    datos.set("id", rendicionSeleccionada.id);
    datos.set("estado", estado);
    if (estado === "rechazada") {
      datos.set("motivo_rechazo", motivoRechazo);
    }

    startTransition(async () => {
      const res = await revisarRendicionGastoAction(datos);
      if (res.ok) {
        setModalRevisarAbierto(false);
        setRendicionSeleccionada(null);
        setMotivoRechazo("");
      }
    });
  };

  const renderBadgeEstado = (estado: EstadoRendicion) => {
    switch (estado) {
      case "aprobada":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#1E9E6A]/10 px-2 py-0.5 text-xs font-semibold text-[#1E9E6A]">
            <CheckCircle2 className="size-3" />
            {t("stateAprobada")}
          </span>
        );
      case "rechazada":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#B4342B]/10 px-2 py-0.5 text-xs font-semibold text-[#B4342B]">
            <AlertCircle className="size-3" />
            {t("stateRechazada")}
          </span>
        );
      case "contabilizada":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-marca-100 px-2 py-0.5 text-xs font-semibold text-marca-700">
            <FileCheck className="size-3" />
            {t("stateContabilizada")}
          </span>
        );
      case "en_revision":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-tinta/80">
            <Clock className="size-3" />
            {t("stateEnRevision")}
          </span>
        );
      case "enviada":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-marca-50 px-2 py-0.5 text-xs font-semibold text-marca-600">
            <Clock className="size-3" />
            {t("stateEnviada")}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros Táctiles */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: "todas", label: t("filterAll") },
            { id: "enviada", label: t("stateEnviada") },
            { id: "aprobada", label: t("stateAprobada") },
            { id: "contabilizada", label: t("stateContabilizada") },
            { id: "rechazada", label: t("stateRechazada") },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFiltro(item.id)}
            className={cn(
              "inline-flex min-h-[38px] items-center rounded-lg px-3 text-xs font-medium transition-all active:scale-95",
              filtro === item.id
                ? "bg-marca-500 text-white shadow-xs"
                : "border border-linea-fuerte/40 bg-white text-tinta/70 hover:bg-muted hover:text-tinta",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Lista de Rendiciones */}
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linea-fuerte bg-white py-12 text-center shadow-xs">
          <Receipt className="size-10 text-marca-500/60" />
          <h3 className="mt-3 text-base font-semibold text-tinta">
            {t("noVouchersTitle")}
          </h3>
          <p className="mt-1 text-sm text-tinta/60">{t("noVouchersSubtitle")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((r) => (
            <div
              key={r.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-linea-fuerte bg-white p-4 shadow-xs transition-all hover:border-marca-500/40 sm:flex-row sm:items-center"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-marca-600">
                    {r.codigo}
                  </span>
                  {renderBadgeEstado(r.estado)}
                  {r.programa_nombre && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-tinta/70">
                      <FolderOpen className="size-3" />
                      {r.programa_nombre}
                    </span>
                  )}
                  {r.ncf && (
                    <span className="rounded-md border border-linea-fuerte px-1.5 py-0.5 font-mono text-[11px] text-tinta/80">
                      NCF: {r.ncf}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                  <h4 className="text-base font-semibold text-tinta">
                    {r.proveedor_nombre}
                  </h4>
                  <span className="text-sm font-bold text-tinta">
                    {formatearMonto(r.monto_total, r.moneda === "USD" ? "USD" : "DOP")}
                  </span>
                </div>

                <p className="text-xs text-tinta/70">{r.concepto}</p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-tinta/50 pt-1">
                  <span className="flex items-center gap-1">
                    <User className="size-3" />
                    {r.empleado_nombre}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {r.fecha_comprobante}
                  </span>
                  {r.motivo_rechazo && (
                    <span className="text-[#B4342B] font-medium">
                      Motivo rechazo: {r.motivo_rechazo}
                    </span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0">
                {puedeRevisar && r.estado === "enviada" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[42px] border-marca-500 text-marca-600 hover:bg-marca-50 active:scale-95"
                    onClick={() => {
                      setRendicionSeleccionada(r);
                      setModalRevisarAbierto(true);
                    }}
                  >
                    <FileCheck className="mr-1.5 size-4" />
                    {t("reviewVoucher")}
                  </Button>
                )}

                {puedeRevisar && r.estado === "aprobada" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[42px] border-marca-700 text-marca-700 hover:bg-marca-50 active:scale-95"
                    onClick={() => {
                      setRendicionSeleccionada(r);
                      ejecutarRevision("contabilizada");
                    }}
                  >
                    <FileCheck className="mr-1.5 size-4" />
                    {t("postToAccounting")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Revisión y Validación DGII */}
      <Dialog open={modalRevisarAbierto} onOpenChange={setModalRevisarAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="size-5 text-marca-500" />
              {t("reviewVoucherModalTitle")}
            </DialogTitle>
          </DialogHeader>

          {rendicionSeleccionada && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-linea-fuerte bg-muted/30 p-3 space-y-1 text-xs">
                <div className="flex justify-between font-semibold">
                  <span>{rendicionSeleccionada.codigo}</span>
                  <span>
                    {formatearMonto(
                      rendicionSeleccionada.monto_total,
                      rendicionSeleccionada.moneda === "USD" ? "USD" : "DOP",
                    )}
                  </span>
                </div>
                <p className="text-tinta/70">
                  {t("providerName")}: {rendicionSeleccionada.proveedor_nombre}
                </p>
                {rendicionSeleccionada.proveedor_rnc && (
                  <p className="text-tinta/70">
                    RNC: {rendicionSeleccionada.proveedor_rnc}
                  </p>
                )}
                {rendicionSeleccionada.ncf && (
                  <p className="text-tinta/70">NCF: {rendicionSeleccionada.ncf}</p>
                )}
                <p className="text-tinta/70">
                  {t("conceptDescription")}: {rendicionSeleccionada.concepto}
                </p>
              </div>

              <div>
                <Label htmlFor="motivo">{t("rejectReasonOptional")}</Label>
                <Textarea
                  id="motivo"
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder={t("rejectReasonPlaceholder")}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => ejecutarRevision("rechazada")}
                  className="border-[#B4342B] text-[#B4342B] hover:bg-[#B4342B]/10 active:scale-95"
                >
                  <FileX className="mr-1.5 size-4" />
                  {t("rejectButton")}
                </Button>

                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => ejecutarRevision("aprobada")}
                  className="bg-marca-500 text-white hover:bg-marca-600 active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 size-4" />
                  )}
                  {t("approveButton")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
