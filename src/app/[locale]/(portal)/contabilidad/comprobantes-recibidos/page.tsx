import type { Metadata } from "next";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Inbox,
  Receipt,
  Search,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requerirRol } from "@/lib/auth";
import { programasParaRendicion } from "@/server/colaborador/consultas";
import { listarComprobantesRecibidos } from "@/server/contabilidad/comprobantes/recibidos-consultas";
import { PanelRevisionComprobante } from "@/components/contabilidad/comprobantes/panel-revision-comprobante";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Bandeja de Comprobantes Recibidos · Contabilidad" };
}

export default async function ComprobantesRecibidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  await requerirRol(["contabilidad", "super_admin", "admin"]);
  const params = await searchParams;

  const [comprobantes, proyectos] = await Promise.all([
    listarComprobantesRecibidos({
      estado: params.estado,
      busqueda: params.q,
      limite: 100,
    }),
    programasParaRendicion(),
  ]);

  const conteoPorEstado = {
    recibido: comprobantes.filter((c) => c.estado === "recibido").length,
    validado: comprobantes.filter((c) => c.estado === "validado").length,
    observado: comprobantes.filter((c) => c.estado === "observado").length,
    rechazado: comprobantes.filter((c) => c.estado === "rechazado").length,
    contabilizado: comprobantes.filter((c) => c.estado === "contabilizado").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="texto-meta text-xs uppercase tracking-wider text-marca-600 font-semibold">
              Recepción en Vivo
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
            Bandeja de Comprobantes Recibidos
          </h1>
          <p className="texto-meta mt-1">
            Facturas y recibos capturados desde el chat por choferes y personal de campo en tiempo real.
          </p>
        </div>
      </div>

      {/* Métricas rápidas de la bandeja */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-linea bg-superficie p-4">
          <p className="texto-meta text-xs">Por Validar</p>
          <p className="text-2xl font-bold text-alerta-600">{conteoPorEstado.recibido}</p>
        </div>
        <div className="rounded-xl border border-linea bg-superficie p-4">
          <p className="texto-meta text-xs">Validados</p>
          <p className="text-2xl font-bold text-exito-600">{conteoPorEstado.validado}</p>
        </div>
        <div className="rounded-xl border border-linea bg-superficie p-4">
          <p className="texto-meta text-xs">Observados</p>
          <p className="text-2xl font-bold text-tinta-2">{conteoPorEstado.observado}</p>
        </div>
        <div className="rounded-xl border border-linea bg-superficie p-4">
          <p className="texto-meta text-xs">Contabilizados</p>
          <p className="text-2xl font-bold text-marca-600">{conteoPorEstado.contabilizado}</p>
        </div>
      </div>

      {/* Lista interactiva de comprobantes con panel de revisión */}
      <PanelRevisionComprobante comprobantes={comprobantes} proyectos={proyectos} />
    </div>
  );
}
