"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Paperclip, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FORMATOS_COTIZACION,
  MAXIMO_COTIZACION_BYTES,
  MAXIMO_TEXTO,
  MAXIMO_TITULO,
} from "@/lib/solicitudes";
import {
  crearCompra,
  type EstadoFormularioSolicitud,
} from "@/server/solicitudes/acciones";

/** Extensiones del `accept`: ayuda del navegador; el servidor vuelve a validar. */
const ACEPTA = Object.keys(FORMATOS_COTIZACION)
  .map((extension) => `.${extension}`)
  .join(",");

/**
 * Pedir a contabilidad que compre algo, con la cotización adjunta.
 *
 * Lo ven todos los roles. El archivo es obligatorio: contabilidad decide
 * sobre un precio concreto y no sobre una intención de compra.
 */
export function FormularioCompra() {
  const t = useTranslations("requests");
  const [estado, enviar, enviando] = useActionState<
    EstadoFormularioSolicitud,
    FormData
  >(crearCompra, { estado: "inicial" });

  const error =
    estado.estado === "inicial" || estado.estado === "ok"
      ? null
      : t(`form.error.${estado.estado}` as never);

  return (
    // La `key` reinicia el formulario (y el archivo elegido) tras un envío válido.
    <form
      key={estado.estado === "ok" ? "enviada" : "nueva"}
      action={enviar}
      className="space-y-4"
    >
      {estado.estado === "ok" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-control bg-marca-50 px-3 py-2 text-sm font-medium text-marca-700"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          {t("purchase.success")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="compra-titulo" className="text-sm font-medium">
            {t("form.title")}
          </Label>
          <Input
            id="compra-titulo"
            name="titulo"
            required
            maxLength={MAXIMO_TITULO}
            placeholder={t("titlePlaceholder.compra")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compra-monto" className="text-sm font-medium">
            {t("form.amount")}
          </Label>
          <Input
            id="compra-monto"
            name="monto"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="compra-detalle" className="text-sm font-medium">
          {t("purchase.description")}
        </Label>
        <Textarea
          id="compra-detalle"
          name="detalle"
          rows={3}
          maxLength={MAXIMO_TEXTO}
          placeholder={t("purchase.descriptionPlaceholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="compra-cotizacion" className="text-sm font-medium">
          <Paperclip className="size-4" />
          {t("purchase.quote")}
        </Label>
        <Input
          id="compra-cotizacion"
          name="cotizacion"
          type="file"
          required
          accept={ACEPTA}
          aria-describedby="compra-cotizacion-ayuda"
        />
        <p id="compra-cotizacion-ayuda" className="texto-meta">
          {t("purchase.quoteHint", {
            mb: MAXIMO_COTIZACION_BYTES / (1024 * 1024),
          })}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-sm text-background"
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {enviando ? t("form.sending") : t("purchase.submit")}
      </Button>
    </form>
  );
}
