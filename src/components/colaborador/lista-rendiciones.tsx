"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  ExternalLink,
  FileCheck,
  FolderOpen,
  GraduationCap,
  ScrollText,
  User,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { StatusBadge } from "@/components/app/status-badge";
import { CeldaAcciones } from "@/components/app/celda-acciones";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import type { EstadoRendicion, RendicionGastoItem } from "@/lib/torre-control";
import { revisarRendicionGastoAction } from "@/server/colaborador/acciones";

interface ListaRendicionesProps {
  rendiciones: readonly RendicionGastoItem[];
  puedeRevisar: boolean;
}

/** Qué diálogo está abierto sobre qué rendición: validar (aprobar o rechazar) o contabilizar. */
type Revision = { id: string; modo: "revisar" | "contabilizar" };

const monto = (r: RendicionGastoItem) =>
  formatearMonto(r.monto_total, r.moneda === "USD" ? "USD" : "DOP");

/**
 * Bandeja de rendiciones (patrón Lista, docs/ux-rules.md): tabla densa con el estado
 * en una pastilla, clic en la fila para abrir el panel con el detalle, y las acciones
 * de quien revisa en la propia fila. Los filtros y los conteos viven en la página (URL
 * y servidor); aquí solo se pinta lo que llega.
 *
 * Hay UN panel y UN diálogo para toda la lista; el estado guarda ids y se busca en
 * `rendiciones`, así que tras `router.refresh()` lo que se ve es el dato nuevo.
 */
export function ListaRendiciones({ rendiciones, puedeRevisar }: ListaRendicionesProps) {
  const t = useTranslations("rendicion");
  const tl = useTranslations("listas");
  const tc = useTranslations("appUi");
  const router = useRouter();
  const locale = useLocale() as Locale;

  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [isPending, startTransition] = useTransition();
  // El resultado se enseña: un rechazo sin motivo o un fallo no pueden dejar el botón «sin hacer nada».
  const [errorRevision, setErrorRevision] = useState<string | null>(null);

  const l = (clave: string, valores?: Record<string, string | number>) =>
    tl(`rendiciones.${clave}` as never, valores as never);
  const etiquetaEstado = (estado: EstadoRendicion) => {
    const clave = {
      enviada: "stateEnviada",
      en_revision: "stateEnRevision",
      aprobada: "stateAprobada",
      rechazada: "stateRechazada",
      contabilizada: "stateContabilizada",
    }[estado];

    return t(clave as never);
  };

  const abierta = rendiciones.find((r) => r.id === abiertaId) ?? null;
  const enRevision = revision ? (rendiciones.find((r) => r.id === revision.id) ?? null) : null;

  const puedeValidar = (r: RendicionGastoItem) =>
    puedeRevisar && (r.estado === "enviada" || r.estado === "en_revision");
  const puedeContabilizar = (r: RendicionGastoItem) => puedeRevisar && r.estado === "aprobada";

  const abrirRevision = (r: RendicionGastoItem, modo: Revision["modo"]) => {
    setErrorRevision(null);
    setMotivoRechazo("");
    setAbiertaId(null);
    setRevision({ id: r.id, modo });
  };

  const cerrarRevision = () => {
    setRevision(null);
    setMotivoRechazo("");
    setErrorRevision(null);
  };

  const ejecutarRevision = (estado: EstadoRendicion, rendicion: RendicionGastoItem) => {
    setErrorRevision(null);

    if (estado === "rechazada" && !motivoRechazo.trim()) {
      setErrorRevision(t("reviewError.falta_motivo"));
      return;
    }

    const datos = new FormData();
    datos.set("id", rendicion.id);
    datos.set("estado", estado);
    if (estado === "rechazada") {
      datos.set("motivo_rechazo", motivoRechazo);
    }

    startTransition(async () => {
      const res = await revisarRendicionGastoAction(datos);
      if (res.ok) {
        cerrarRevision();
        router.refresh();
        return;
      }

      const clave = res.mensaje ?? "error";
      setErrorRevision(
        t.has(`reviewError.${clave}` as never)
          ? t(`reviewError.${clave}` as never)
          : t("reviewError.error"),
      );
      if (clave === "ya_cambio") router.refresh();
    });
  };

  const datosNombrados = (r: RendicionGastoItem) => ({
    proveedor: r.proveedor_nombre,
    empleado: r.empleado_nombre,
    monto: monto(r),
    codigo: r.codigo,
  });

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        {/* ≥ md: tabla densa */}
        <table className="hidden w-full text-sm md:table">
          <thead className="text-meta border-b border-linea text-left">
            <tr>
              <th className="px-4 py-3 font-medium">{l("column.voucher")}</th>
              <th className="px-4 py-3 font-medium">{l("column.status")}</th>
              {puedeRevisar && <th className="px-4 py-3 font-medium">{l("column.employee")}</th>}
              <th className="px-4 py-3 text-right font-medium">{l("column.amount")}</th>
              <th className="px-4 py-3 font-medium">{l("column.date")}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{l("column.actions")}</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-linea">
            {rendiciones.map((r) => (
              <tr key={r.id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
                <td className="max-w-80 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => setAbiertaId(r.id)}
                    aria-label={`${l("view")}: ${r.proveedor_nombre}`}
                    className="flex min-w-0 items-center gap-3 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FotoEstudiante nombre={r.empleado_nombre} url={null} className="size-9 shrink-0 rounded-full" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{r.proveedor_nombre}</span>
                      <span className="text-meta block truncate">
                        {[r.codigo, r.programa_nombre].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-1.5">
                  <StatusBadge status={r.estado} label={etiquetaEstado(r.estado)} />
                </td>
                {puedeRevisar && (
                  <td className="max-w-48 px-4 py-1.5">
                    <span className="block truncate">{r.empleado_nombre}</span>
                  </td>
                )}
                <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{monto(r)}</td>
                <td className="text-meta px-4 py-1.5 whitespace-nowrap">
                  {fechaCorta(r.fecha_comprobante.slice(0, 10), locale)}
                </td>
                <CeldaAcciones>
                  {puedeValidar(r) && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => abrirRevision(r, "revisar")}>
                      <FileCheck />
                      {t("reviewVoucher")}
                    </Button>
                  )}
                  {puedeContabilizar(r) &&
                    (puedeValidar(r) ? (
                      <MenuMasAcciones
                        compacto
                        acciones={[{ etiqueta: t("postToAccounting"), icono: <Check />, onClick: () => abrirRevision(r, "contabilizar") }]}
                      />
                    ) : (
                      <Button type="button" size="sm" variant="secondary" onClick={() => abrirRevision(r, "contabilizar")}>
                        <Check />
                        {t("postToAccounting")}
                      </Button>
                    ))}
                </CeldaAcciones>
              </tr>
            ))}
          </tbody>
        </table>

        {/* < md: filas; las acciones van en el panel */}
        <ul className="divide-y divide-linea md:hidden">
          {rendiciones.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setAbiertaId(r.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FotoEstudiante nombre={r.empleado_nombre} url={null} className="size-11 rounded-full" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-semibold">{r.proveedor_nombre}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.estado} label={etiquetaEstado(r.estado)} />
                    <span className="text-meta font-semibold tabular-nums">{monto(r)}</span>
                  </span>
                  <span className="text-meta block truncate">
                    {[r.codigo, puedeRevisar ? r.empleado_nombre : null, fechaCorta(r.fecha_comprobante.slice(0, 10), locale)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Panel de detalle */}
      <Sheet open={abierta !== null} onOpenChange={(a) => !a && setAbiertaId(null)}>
        <SheetContent>
          {abierta && (
            <>
              <div className="space-y-2 border-b border-linea px-6 py-5 pr-14">
                <SheetTitle className="text-section">{abierta.proveedor_nombre}</SheetTitle>
                <SheetDescription className="text-meta">
                  {abierta.codigo} · {monto(abierta)}
                </SheetDescription>
                <StatusBadge status={abierta.estado} label={etiquetaEstado(abierta.estado)} />
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <p className="text-sm whitespace-pre-line">{abierta.concepto}</p>

                {abierta.motivo_rechazo && (
                  <p className="flex items-start gap-2 rounded-control bg-tinta px-3 py-2 text-sm text-background">
                    <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {t("rejectReasonLabel", { motivo: abierta.motivo_rechazo })}
                  </p>
                )}

                <dl className="space-y-2.5 text-sm">
                  <FilaDetalle icono={<User />}>{abierta.empleado_nombre}</FilaDetalle>
                  <FilaDetalle icono={<Calendar />}>
                    {fechaCorta(abierta.fecha_comprobante.slice(0, 10), locale)}
                  </FilaDetalle>
                  {abierta.programa_nombre && (
                    <FilaDetalle icono={<FolderOpen />}>{abierta.programa_nombre}</FilaDetalle>
                  )}
                  {abierta.solicitud_folio !== null && (
                    <FilaDetalle icono={<ScrollText />}>
                      {t("requestRef", { folio: abierta.solicitud_folio, titulo: abierta.solicitud_titulo ?? "" })}
                    </FilaDetalle>
                  )}
                  {abierta.estudiante_nombre && (
                    <FilaDetalle icono={<GraduationCap />}>{abierta.estudiante_nombre}</FilaDetalle>
                  )}
                  {abierta.proveedor_rnc && <FilaDetalle>RNC: {abierta.proveedor_rnc}</FilaDetalle>}
                  {abierta.ncf && <FilaDetalle>NCF: {abierta.ncf}</FilaDetalle>}
                  {abierta.comprobante_url && (
                    <FilaDetalle icono={<ExternalLink />}>
                      <a
                        href={`/api/rendiciones/${abierta.id}/comprobante`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-marca-600 hover:underline"
                      >
                        {t("viewReceipt")}
                      </a>
                    </FilaDetalle>
                  )}
                </dl>

                {(puedeValidar(abierta) || puedeContabilizar(abierta)) && (
                  <div className="flex flex-wrap gap-2 border-t border-linea pt-4">
                    {puedeValidar(abierta) && (
                      <Button type="button" onClick={() => abrirRevision(abierta, "revisar")}>
                        <FileCheck />
                        {t("reviewVoucher")}
                      </Button>
                    )}
                    {puedeContabilizar(abierta) && (
                      <Button type="button" onClick={() => abrirRevision(abierta, "contabilizar")}>
                        <Check />
                        {t("postToAccounting")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Validación DGII (aprobar o rechazar) y confirmación de contabilizar, siempre nombrando la rendición. */}
      <Dialog open={enRevision !== null} onOpenChange={(a) => !a && cerrarRevision()}>
        <DialogContent className="md:max-w-md">
          {enRevision && revision?.modo === "revisar" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-section">
                  {l("confirmReview", datosNombrados(enRevision))}
                </DialogTitle>
                <DialogDescription className="text-meta">{t("reviewVoucherModalTitle")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-1 rounded-card border border-linea bg-muted/30 p-3 text-xs">
                <p className="text-tinta-2">
                  {t("providerName")}: {enRevision.proveedor_nombre}
                </p>
                {enRevision.proveedor_rnc && <p className="text-tinta-2">RNC: {enRevision.proveedor_rnc}</p>}
                {enRevision.ncf && <p className="text-tinta-2">NCF: {enRevision.ncf}</p>}
                <p className="text-tinta-2">
                  {t("conceptDescription")}: {enRevision.concepto}
                </p>
                {enRevision.solicitud_folio !== null && (
                  <p className="text-tinta-2">
                    {t("authorizingRequest")}:{" "}
                    {t("requestRef", { folio: enRevision.solicitud_folio, titulo: enRevision.solicitud_titulo ?? "" })}
                  </p>
                )}
                {enRevision.estudiante_nombre && (
                  <p className="text-tinta-2">
                    {t("chargeToStudent")}: {enRevision.estudiante_nombre}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="motivo">{t("rejectReasonOptional")}</Label>
                <Textarea
                  id="motivo"
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <ErrorRevision texto={errorRevision} />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  cargando={isPending}
                  onClick={() => ejecutarRevision("rechazada", enRevision)}
                >
                  <X />
                  {t("rejectButton")}
                </Button>
                <Button type="button" cargando={isPending} onClick={() => ejecutarRevision("aprobada", enRevision)}>
                  <Check />
                  {t("approveButton")}
                </Button>
              </DialogFooter>
            </>
          )}

          {enRevision && revision?.modo === "contabilizar" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-section">
                  {l("confirmPost", datosNombrados(enRevision))}
                </DialogTitle>
                <DialogDescription className="sr-only">{enRevision.concepto}</DialogDescription>
              </DialogHeader>

              <ErrorRevision texto={errorRevision} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={cerrarRevision} disabled={isPending}>
                  {tc("panel.cancel")}
                </Button>
                <Button type="button" cargando={isPending} onClick={() => ejecutarRevision("contabilizada", enRevision)}>
                  <Check />
                  {t("postToAccounting")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Un dato del panel: icono opcional y valor, en la misma línea. `icono` va como elemento. */
function FilaDetalle({ icono, children }: { icono?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-tinta-2">
      <span aria-hidden className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-tinta-3 [&_svg]:size-4">
        {icono}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function ErrorRevision({ texto }: { texto: string | null }) {
  if (!texto) return null;

  return (
    <p role="alert" className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs text-background">
      <AlertCircle className="size-3.5 shrink-0" />
      {texto}
    </p>
  );
}
