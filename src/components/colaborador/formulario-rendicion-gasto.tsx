"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Receipt,
  ScanLine,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { SolicitudParaRendir } from "@/server/colaborador/consultas";
import {
  enviarRendicionGastoAction,
  extraerComprobanteOcrAction,
} from "@/server/colaborador/acciones";

interface FormularioRendicionGastoProps {
  programas: { id: string; nombre: string; codigo: string | null }[];
  /** Solicitudes aprobadas de la persona que aún no se han cerrado. */
  solicitudes: SolicitudParaRendir[];
  /**
   * Becados a quienes imputar el gasto. `null` = esta persona no puede ver
   * estudiantes: el selector no se pinta y la lista nunca llegó al navegador.
   */
  becados: { id: string; nombre: string }[] | null;
  onExito?: () => void;
}

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function FormularioRendicionGasto({
  programas,
  solicitudes,
  becados,
  onExito,
}: FormularioRendicionGastoProps) {
  const t = useTranslations("rendicion");
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [escaneandoOcr, setEscaneandoOcr] = useState(false);
  const [ocrCompletado, setOcrCompletado] = useState(false);
  const [ocrManual, setOcrManual] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  // El archivo en sí, no su vista previa: la URL `blob:` solo vive en este
  // navegador y contabilidad no podía abrirla.
  const [archivo, setArchivo] = useState<File | null>(null);

  // Campos del formulario
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [proveedorRnc, setProveedorRnc] = useState("");
  const [ncf, setNcf] = useState("");
  const [fechaComprobante, setFechaComprobante] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [montoTotal, setMontoTotal] = useState("");
  const [montoItbis, setMontoItbis] = useState("");
  const [concepto, setConcepto] = useState("");
  const [programaId, setProgramaId] = useState("");
  const [solicitudId, setSolicitudId] = useState("");
  const [estudianteId, setEstudianteId] = useState("");
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [ocrData, setOcrData] = useState<Record<string, unknown> | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );

  // Extracción real con OCR en servidor (`leerComprobanteFiscal`)
  const procesarArchivoOcr = async (file: File) => {
    setArchivoNombre(file.name);
    setArchivo(file);

    setEscaneandoOcr(true);
    setOcrCompletado(false);
    setOcrManual(false);

    try {
      const formData = new FormData();
      formData.set("comprobante", file);
      const resultado = await extraerComprobanteOcrAction(formData);

      if (resultado.estado === "ok") {
        const { datos } = resultado;
        if (datos.proveedor) setProveedorNombre(datos.proveedor);
        if (datos.rnc) setProveedorRnc(datos.rnc);
        if (datos.ncf) setNcf(datos.ncf);
        if (datos.fecha) setFechaComprobante(datos.fecha);
        if (datos.monto !== null) setMontoTotal(String(datos.monto));
        if (datos.itbis !== null) setMontoItbis(String(datos.itbis));
        if (datos.concepto) setConcepto(datos.concepto);
        setOcrData(datos);
        setOcrCompletado(true);
      } else {
        setOcrData(null);
        setOcrManual(true);
      }
    } catch {
      setOcrData(null);
      setOcrManual(true);
    } finally {
      setEscaneandoOcr(false);
    }
  };

  const manejarEnvio = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensaje(null);

    const formData = new FormData();
    formData.set("proveedor_nombre", proveedorNombre);
    formData.set("proveedor_rnc", proveedorRnc);
    formData.set("ncf", ncf);
    formData.set("programa_id", programaId);
    formData.set("solicitud_id", solicitudId);
    formData.set("estudiante_id", estudianteId);
    formData.set("fecha_comprobante", fechaComprobante);
    formData.set("monto_total", montoTotal);
    formData.set("monto_itbis", montoItbis);
    formData.set("concepto", concepto);
    if (archivo) {
      formData.set("comprobante", archivo);
    }
    if (ocrData) {
      formData.set("ocr_data", JSON.stringify(ocrData));
    }

    startTransition(async () => {
      const res = await enviarRendicionGastoAction(formData);
      if (res.ok) {
        setMensaje({ tipo: "ok", texto: t("submitSuccess") });
        // Limpiar
        setProveedorNombre("");
        setProveedorRnc("");
        setNcf("");
        setMontoTotal("");
        setMontoItbis("");
        setConcepto("");
        setSolicitudId("");
        setEstudianteId("");
        setBusquedaEstudiante("");
        setArchivo(null);
        setArchivoNombre(null);
        setOcrCompletado(false);
        setOcrManual(false);
        if (onExito) onExito();
        // La lista de abajo es del servidor: sin esto no aparecía lo enviado.
        router.refresh();
      } else {
        const codigo = res.mensaje;
        const codigosConocidos = [
          "falta_solicitud",
          "solicitud_invalida",
          "estudiante_invalido",
          "falta_proveedor",
          "falta_concepto",
          "monto_invalido",
          "ncf_invalido",
          "formato_invalido",
          "archivo_grande",
          "error_subida",
          "error",
        ] as const;
        const textoError =
          codigo && (codigosConocidos as readonly string[]).includes(codigo)
            ? t(`submitErrorCode.${codigo as (typeof codigosConocidos)[number]}`)
            : t("submitError");
        setMensaje({ tipo: "error", texto: textoError });
      }
    });
  };

  // Sin una solicitud aprobada no hay nada que rendir: se explica y se lleva a
  // crearla, en vez de dejar un formulario que el servidor rechazaría.
  if (solicitudes.length === 0) {
    return (
      <Card className="rounded-2xl border-linea-fuerte bg-card shadow-xs">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-tinta">
            <Info className="mt-0.5 size-4 shrink-0 text-marca-700" />
            <span>{t("noApprovedRequest")}</span>
          </p>
          <Link
            href="/administrativo/solicitudes"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-control bg-marca-500 px-4 text-sm font-semibold text-white hover:bg-marca-600 active:scale-95"
          >
            {t("createRequestLink")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const becadosFiltrados = (becados ?? [])
    .filter((b) =>
      b.nombre.toLowerCase().includes(busquedaEstudiante.trim().toLowerCase()),
    )
    .slice(0, 6);
  const estudianteElegido = becados?.find((b) => b.id === estudianteId) ?? null;

  return (
    <Card className="rounded-2xl border-linea-fuerte bg-card shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-tinta">
          <Receipt className="size-5 text-marca-500" />
          {t("formTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mensaje && (
          <div
            className={cn(
              "mb-4 flex items-center gap-2 rounded-xl p-3 text-sm",
              mensaje.tipo === "ok"
                ? "bg-status-success/10 text-status-success-fg"
                : "border border-linea-fuerte bg-muted text-tinta",
            )}
          >
            {mensaje.tipo === "ok" ? (
              <CheckCircle2 className="size-4 shrink-0 text-status-success-fg" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-status-danger-fg" />
            )}
            <span>{mensaje.texto}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-4">
          <FormularioGuiado>
          <PasoFormulario titulo={t("pasos.solicitud")}>
          <div>
            <Label htmlFor="solicitud_id">{t("authorizingRequest")}</Label>
            <select
              id="solicitud_id"
              value={solicitudId}
              onChange={(e) => setSolicitudId(e.target.value)}
              required
              className={cn(SELECT_CLASS, "mt-1")}
            >
              <option value="">{t("selectRequestHint")}</option>
              {solicitudes.map((sol) => (
                <option key={sol.id} value={sol.id}>
                  #{sol.folio} · {sol.titulo}
                </option>
              ))}
            </select>
          </div>
          </PasoFormulario>

          {/* La foto va en el primer paso porque el OCR rellena los campos del
              proveedor que vienen justo después: subirla primero ahorra teclear. */}
          <PasoFormulario titulo={t("pasos.comprobante")}>
          {/* Zona de Carga con Cámara u OCR */}
          <div className="rounded-xl border-2 border-dashed border-marca-500/30 bg-marca-50 p-4 text-center">
            <input
              type="file"
              id="archivo-factura"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) procesarArchivoOcr(file);
              }}
            />

            <label
              htmlFor="archivo-factura"
              className="flex flex-col items-center justify-center cursor-pointer space-y-2 py-3 active:scale-95 transition-all"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-card shadow-xs text-marca-500">
                {escaneandoOcr ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <Camera className="size-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-tinta">
                  {escaneandoOcr ? t("ocrScanning") : t("uploadReceiptPrompt")}
                </p>
                {archivoNombre && (
                  <p className="text-xs text-tinta/60">{archivoNombre}</p>
                )}
              </div>
            </label>

            {ocrCompletado && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-status-success/10 px-3 py-1 text-xs font-semibold text-status-success-fg">
                <CheckCircle2 className="size-3.5" />
                {t("ocrAutoExtracted")}
              </div>
            )}
            {ocrManual && !ocrCompletado && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-tinta-2">
                {t("ocrManualNotice")}
              </div>
            )}
          </div>

          {/* Formulario de Campos Fiscales */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="proveedor">{t("providerName")}</Label>
              <Input
                id="proveedor"
                value={proveedorNombre}
                onChange={(e) => setProveedorNombre(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="rnc">{t("providerRnc")}</Label>
              <Input
                id="rnc"
                value={proveedorRnc}
                onChange={(e) => setProveedorRnc(e.target.value)}
                placeholder="131-45678-9"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ncf">{t("ncf")}</Label>
              <Input
                id="ncf"
                value={ncf}
                onChange={(e) => setNcf(e.target.value.toUpperCase())}
                placeholder="B0100000001"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fecha_comprobante">{t("receiptDate")}</Label>
              <Input
                id="fecha_comprobante"
                type="date"
                value={fechaComprobante}
                onChange={(e) => setFechaComprobante(e.target.value)}
                required
                className="mt-1"
              />
            </div>

          </div>
          </PasoFormulario>

          <PasoFormulario titulo={t("pasos.montos")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="monto_total">{t("totalAmount")} (RD$)</Label>
              <Input
                id="monto_total"
                type="number"
                step="0.01"
                min="0.01"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                placeholder="0.00"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="monto_itbis">{t("itbisAmount")} (RD$)</Label>
              <Input
                id="monto_itbis"
                type="number"
                step="0.01"
                min="0"
                value={montoItbis}
                onChange={(e) => setMontoItbis(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
          </div>

          </PasoFormulario>

          <PasoFormulario titulo={t("pasos.destino")}>
          <div>
            <Label htmlFor="programa_id">{t("assignProgram")}</Label>
            <select
              id="programa_id"
              value={programaId}
              onChange={(e) => setProgramaId(e.target.value)}
              className={cn(SELECT_CLASS, "mt-1")}
            >
              <option value="">{t("selectProgramHint")}</option>
              {programas.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.nombre}
                </option>
              ))}
            </select>
          </div>

          {becados && (
            <div>
              <Label htmlFor="buscar_estudiante">{t("chargeToStudent")}</Label>
              {estudianteElegido ? (
                <div className="mt-1 flex min-h-[44px] items-center justify-between gap-2 rounded-control border border-linea-fuerte bg-marca-50 px-3 text-sm text-marca-700">
                  <span className="truncate font-medium">{estudianteElegido.nombre}</span>
                  <Button variant="ghost" size="icon-sm"
                    type="button"
                    onClick={() => setEstudianteId("")}
                    aria-label={t("clearStudent")}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="mt-1 space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-3" />
                    <Input
                      id="buscar_estudiante"
                      value={busquedaEstudiante}
                      onChange={(e) => setBusquedaEstudiante(e.target.value)}
                      placeholder={t("studentSearchPlaceholder")}
                      autoComplete="off"
                      className="pl-9"
                    />
                  </div>
                  {busquedaEstudiante.trim() !== "" && (
                    <ul className="overflow-hidden rounded-control border border-linea-fuerte bg-card">
                      {becadosFiltrados.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-tinta-3">
                          {t("studentNoResults")}
                        </li>
                      ) : (
                        becadosFiltrados.map((b) => (
                          <li key={b.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setEstudianteId(b.id);
                                setBusquedaEstudiante("");
                              }}
                              className="flex min-h-[44px] w-full items-center px-3 text-left text-sm text-tinta hover:bg-muted"
                            >
                              {b.nombre}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="concepto">{t("conceptDescription")}</Label>
            <Textarea
              id="concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
              rows={2}
              className="mt-1"
            />
          </div>

          </PasoFormulario>

          <AccionesFormulario>
          <div className="flex justify-end pt-2">
            <Button size="lg"
              type="submit"
              disabled={isPending || escaneandoOcr}
              className="w-full sm:w-auto"
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              {t("submitVoucher")}
            </Button>
          </div>
          </AccionesFormulario>
          </FormularioGuiado>
        </form>
      </CardContent>
    </Card>
  );
}
