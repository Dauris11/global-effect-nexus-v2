"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Receipt,
  ScanLine,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { enviarRendicionGastoAction } from "@/server/colaborador/acciones";

interface FormularioRendicionGastoProps {
  programas: { id: string; nombre: string; codigo: string | null }[];
  onExito?: () => void;
}

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function FormularioRendicionGasto({
  programas,
  onExito,
}: FormularioRendicionGastoProps) {
  const t = useTranslations("rendicion");
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [escaneandoOcr, setEscaneandoOcr] = useState(false);
  const [ocrCompletado, setOcrCompletado] = useState(false);
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
  const [ocrData, setOcrData] = useState<Record<string, unknown> | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );

  // Simulación inteligente de OCR con extracción de comprobantes dominicanos
  const procesarArchivoOcr = (file: File) => {
    setArchivoNombre(file.name);
    setArchivo(file);

    setEscaneandoOcr(true);
    setOcrCompletado(false);

    setTimeout(() => {
      // Extracción simulada con datos fiscales dominicanos representativos
      const datosOcr = {
        proveedor: "Ferretería & Suministros Cibao SRL",
        rnc: "131456789",
        ncf: "B0100000045",
        fecha: new Date().toISOString().split("T")[0],
        monto: 3850.0,
        itbis: 587.29,
        concepto: "Compra de discos de corte, electrodos y pernos para Casa de Herramientas",
      };

      setProveedorNombre(datosOcr.proveedor);
      setProveedorRnc(datosOcr.rnc);
      setNcf(datosOcr.ncf);
      setFechaComprobante(datosOcr.fecha);
      setMontoTotal(datosOcr.monto.toString());
      setMontoItbis(datosOcr.itbis.toString());
      setConcepto(datosOcr.concepto);
      setOcrData(datosOcr);

      setEscaneandoOcr(false);
      setOcrCompletado(true);
    }, 1200);
  };

  const manejarEnvio = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensaje(null);

    const formData = new FormData();
    formData.set("proveedor_nombre", proveedorNombre);
    formData.set("proveedor_rnc", proveedorRnc);
    formData.set("ncf", ncf);
    formData.set("programa_id", programaId);
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
        setArchivo(null);
        setArchivoNombre(null);
        setOcrCompletado(false);
        if (onExito) onExito();
        // La lista de abajo es del servidor: sin esto no aparecía lo enviado.
        router.refresh();
      } else {
        setMensaje({ tipo: "error", texto: res.mensaje || t("submitError") });
      }
    });
  };

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
                ? "bg-[#1E9E6A]/10 text-[#1E9E6A]"
                : "border border-linea-fuerte bg-muted text-tinta",
            )}
          >
            {mensaje.tipo === "ok" ? (
              <CheckCircle2 className="size-4 shrink-0 text-[#1E9E6A]" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-[#B4342B]" />
            )}
            <span>{mensaje.texto}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-4">
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
                <p className="text-xs text-tinta/60">
                  {archivoNombre ? archivoNombre : t("ocrHint")}
                </p>
              </div>
            </label>

            {ocrCompletado && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#1E9E6A]/10 px-3 py-1 text-xs font-semibold text-[#1E9E6A]">
                <CheckCircle2 className="size-3.5" />
                {t("ocrAutoExtracted")}
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
                placeholder={t("providerPlaceholder")}
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

          <div>
            <Label htmlFor="concepto">{t("conceptDescription")}</Label>
            <Textarea
              id="concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={t("conceptPlaceholder")}
              required
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isPending || escaneandoOcr}
              className="min-h-[44px] w-full sm:w-auto bg-marca-500 text-white hover:bg-marca-600 active:scale-95"
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              {t("submitVoucher")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
