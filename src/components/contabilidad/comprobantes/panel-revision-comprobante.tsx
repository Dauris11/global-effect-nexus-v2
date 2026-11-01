"use client";

import { useState } from "react";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Receipt,
  Search,
  User,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ComprobanteRecibidoFila } from "@/server/contabilidad/comprobantes/recibidos-consultas";
import { validarComprobanteRecibido } from "@/server/contabilidad/comprobantes/recibidos-acciones";

export function PanelRevisionComprobante({
  comprobantes,
  proyectos = [],
}: {
  comprobantes: ComprobanteRecibidoFila[];
  proyectos?: { id: string; nombre: string }[];
}) {
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
    try {
      const res = await validarComprobanteRecibido({
        id: seleccionado.id,
        estado: nuevoEstado,
        proyectoId: proyectoId || undefined,
        observaciones: observacion || undefined,
      });
      if (res.ok) {
        seleccionado.estado = nuevoEstado;
        seleccionado.proyecto_id = proyectoId || null;
        const proyObj = proyectos.find((p) => p.id === proyectoId);
        seleccionado.proyecto_nombre = proyObj ? proyObj.nombre : null;
        setObservacion("");
      }
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
              placeholder="Buscar por concepto, proveedor o chofer…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-lg border border-linea bg-superficie px-3 text-sm text-tinta"
          >
            <option value="todos">Todos</option>
            <option value="recibido">Por validar</option>
            <option value="validado">Validados</option>
            <option value="observado">Observados</option>
            <option value="rechazado">Rechazados</option>
          </select>
        </div>

        <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
          {filtrados.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-tinta-3">
                No hay comprobantes que coincidan con el filtro.
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
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    esActivo
                      ? "border-marca-500 bg-marca-50/20 shadow-xs"
                      : "border-linea bg-superficie hover:border-marca-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-tinta-3">
                      FOLIO #{comp.folio}
                    </span>
                    <Badge
                      variant={
                        comp.estado === "validado"
                          ? "marca"
                          : comp.estado === "rechazado"
                            ? "solida"
                            : "neutra"
                      }
                      className="text-xs capitalize"
                    >
                      {comp.estado}
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
          <div className="space-y-4 rounded-2xl border border-linea bg-superficie p-6 shadow-card">
            <div className="flex items-center justify-between border-b border-linea pb-4">
              <div>
                <span className="texto-meta text-xs">Comprobante de Gasto</span>
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
                {seleccionado.estado}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="texto-meta text-xs">Monto Total</p>
                <p className="font-mono text-base font-bold text-tinta">
                  {seleccionado.moneda}{" "}
                  {Number(seleccionado.monto).toLocaleString("es-DO", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="texto-meta text-xs">Enviado por</p>
                <p className="font-medium text-tinta">{seleccionado.remitente_nombre}</p>
              </div>
              <div>
                <p className="texto-meta text-xs">Fecha</p>
                <p className="text-tinta">{seleccionado.fecha_comprobante}</p>
              </div>
              <div>
                <p className="texto-meta text-xs">Proveedor</p>
                <p className="text-tinta">{seleccionado.proveedor_nombre || "No especificado"}</p>
              </div>
              <div>
                <p className="texto-meta text-xs">RNC / Cédula</p>
                <p className="font-mono text-tinta">{seleccionado.proveedor_rnc || "—"}</p>
              </div>
              <div>
                <p className="texto-meta text-xs">NCF</p>
                <p className="font-mono text-tinta">{seleccionado.ncf || "—"}</p>
              </div>
            </div>

            {/* Vinculación de Programa / Proyecto */}
            <div className="rounded-xl border border-linea bg-muted/30 p-3.5 space-y-1.5">
              <label className="text-xs font-semibold text-tinta flex items-center gap-1.5">
                <Building className="size-3.5 text-marca-600" />
                Vincular a Programa o Proyecto de la Fundación
              </label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
                className="w-full rounded-lg border border-linea bg-superficie p-2 text-sm text-tinta"
              >
                <option value="">— Sin programa asignado (Gasto general) —</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {seleccionado.proyecto_nombre && (
                <p className="texto-meta text-xs">
                  Asignado actualmente a: <span className="font-semibold text-tinta">{seleccionado.proyecto_nombre}</span>
                </p>
              )}
            </div>

            {/* Previsualización del comprobante / imagen */}
            <div className="rounded-xl border border-linea bg-muted/30 p-4">
              <p className="texto-meta mb-2 text-xs font-semibold uppercase">
                Foto / Documento Adjunto
              </p>
              {seleccionado.archivo_url ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <a
                    href={seleccionado.archivo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-marca-600 underline flex items-center gap-1"
                  >
                    Ver archivo original <ExternalLink className="size-3.5" />
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-tinta-3">
                  <Receipt className="size-4" />
                  <span>Comprobante registrado sin archivo escaneado.</span>
                </div>
              )}
            </div>

            {/* Observaciones o correcciones */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-tinta">
                Notas / Observación para el empleado
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Indica si falta el NCF, si es válido para reembolso o el motivo de rechazo…"
                className="w-full rounded-xl border border-linea p-3 text-sm focus:border-marca-500 focus:outline-none"
                rows={2}
              />
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-linea">
              <Button
                variant="outline"
                size="sm"
                disabled={guardando}
                onClick={() => handleValidar("observado")}
                className="text-tinta-2 hover:bg-muted"
              >
                <AlertCircle className="size-4 mr-1 text-alerta-600" />
                Marcar Observado
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={guardando}
                onClick={() => handleValidar("rechazado")}
                className="text-tinta"
              >
                <XCircle className="size-4 mr-1" />
                Rechazar
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={guardando}
                onClick={() => handleValidar("validado")}
              >
                <CheckCircle2 className="size-4 mr-1" />
                Aprobar y Validar
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-sm text-tinta-3">
              Selecciona un comprobante de la lista para revisarlo.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
