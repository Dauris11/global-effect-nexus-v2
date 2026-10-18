import { CheckCircle2, Clock, DollarSign, Package, QrCode } from "lucide-react";

import { TablaActivos } from "@/components/inventario/tabla-activos";
import { Link } from "@/i18n/navigation";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import {
  listarActivos,
  obtenerMetricasInventario,
} from "@/server/inventario/consultas";

export default async function PaginaInventario() {
  const usuario = await requerirPermiso("inventario.leer");

  const [metricas, activos] = await Promise.all([
    obtenerMetricasInventario(),
    listarActivos(),
  ]);

  const puedeEscribir = tienePermiso(usuario.rol, "inventario.escribir");
  const puedeAuditar = tienePermiso(usuario.rol, "inventario.auditar");

  const formatoMoneda = (val: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-marca-50 px-2.5 py-0.5 text-xs font-bold text-marca-700">
              Módulo 30
            </span>
            <span className="text-xs font-semibold text-tinta-2">Control Patrimonial</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
            Inventario de Activos y Códigos QR
          </h1>
          <p className="mt-0.5 text-xs text-tinta-2">
            Registro físico de maquinaria, tecnología, herramientas de talleres y mobiliario con etiquetas QR imprimibles y auditoría móvil in situ.
          </p>
        </div>

        {puedeAuditar && (
          <Link
            href="/administrativo/inventario/escanear"
            className="flex items-center justify-center gap-2 rounded-xl bg-marca-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-marca-700 sm:w-auto"
          >
            <QrCode className="size-4" />
            <span>Escáner Móvil QR</span>
          </Link>
        )}
      </div>

      {/* Tarjetas de Métricas / KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col justify-between rounded-2xl border border-linea bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta-2">Total Activos</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
              <Package className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-tinta">
            {metricas.totalActivos}
          </p>
          <span className="text-[11px] text-tinta-3">Piezas inventariadas</span>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-linea bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta-2">Operativos</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-tinta">
            {metricas.operativos}
          </p>
          <span className="text-[11px] text-tinta-3 font-medium">En servicio activo</span>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-linea bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta-2">Mantenimiento</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-tinta-2">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-tinta">
            {metricas.enMantenimiento}
          </p>
          <span className="text-[11px] text-tinta-3 font-medium">En revisión técnica</span>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-linea bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tinta-2">Valor Estimado</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl font-extrabold text-tinta">
            {formatoMoneda(metricas.valorTotalEstimado)}
          </p>
          <span className="text-[11px] text-tinta-3">Patrimonio en libros</span>
        </div>
      </div>

      {/* Catálogo y Tabla de Activos */}
      <TablaActivos
        activos={activos}
        puedeEscribir={puedeEscribir}
        puedeAuditar={puedeAuditar}
      />
    </div>
  );
}
