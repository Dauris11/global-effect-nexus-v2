"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  guardarAgente,
  guardarCuota,
  guardarPrecio,
  type EstadoIAAdmin,
} from "@/server/ia/acciones-admin";

const INICIAL: EstadoIAAdmin = { estado: "inicial" };

const SELECT =
  "border-linea-fuerte bg-background h-11 w-full rounded-control border px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Resultado de guardar, con el icono que lo distingue aun sin color. */
function Resultado({ estado, pendiente }: { estado: EstadoIAAdmin["estado"]; pendiente: boolean }) {
  const t = useTranslations("iaAdmin");

  if (pendiente) return <Loader2 className="text-tinta-2 size-4 animate-spin" aria-hidden />;
  if (estado === "inicial") return null;

  return estado === "ok" ? (
    <p role="status" className="text-marca-700 flex items-center gap-1.5 text-sm font-medium">
      <CheckCircle2 className="size-4" />
      {t("form.saved")}
    </p>
  ) : (
    <p role="alert" className="text-tinta flex items-center gap-1.5 text-sm font-medium">
      <AlertCircle className="size-4" />
      {t(`form.error.${estado}`)}
    </p>
  );
}

export function FormularioCuota() {
  const t = useTranslations("iaAdmin");
  const [estado, accion, pendiente] = useActionState(guardarCuota, INICIAL);

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div>
        <Label htmlFor="cuota-alcance">{t("quotas.scope")}</Label>
        <select id="cuota-alcance" name="alcance" className={SELECT} defaultValue="rol">
          <option value="rol">{t("quotas.scopeRole")}</option>
          <option value="usuario">{t("quotas.scopeUser")}</option>
        </select>
      </div>
      <div>
        <Label htmlFor="cuota-quien">{t("quotas.who")}</Label>
        <Input id="cuota-quien" name="quien" required placeholder={t("quotas.whoHint")} />
      </div>
      <div>
        <Label htmlFor="cuota-tokens">{t("quotas.tokens")}</Label>
        <Input id="cuota-tokens" name="tokens_mes" type="number" min={1} required />
      </div>
      <div>
        <Label htmlFor="cuota-aviso">{t("quotas.warnAt")}</Label>
        <Input id="cuota-aviso" name="aviso_pct" type="number" min={1} max={100} defaultValue={80} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          <Save className="size-4" />
          {t("form.save")}
        </Button>
        <Resultado estado={estado.estado} pendiente={pendiente} />
      </div>
    </form>
  );
}

export function FormularioPrecio() {
  const t = useTranslations("iaAdmin");
  const [estado, accion, pendiente] = useActionState(guardarPrecio, INICIAL);

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div>
        <Label htmlFor="precio-modelo">{t("prices.model")}</Label>
        <Input id="precio-modelo" name="modelo" required />
      </div>
      <div>
        <Label htmlFor="precio-entrada">{t("prices.input")}</Label>
        <Input id="precio-entrada" name="entrada" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor="precio-salida">{t("prices.output")}</Label>
        <Input id="precio-salida" name="salida" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor="precio-cache">{t("prices.cache")}</Label>
        <Input id="precio-cache" name="cache" inputMode="decimal" defaultValue="0" />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          <Save className="size-4" />
          {t("form.save")}
        </Button>
        <Resultado estado={estado.estado} pendiente={pendiente} />
      </div>
    </form>
  );
}

export function EditorAgente({
  clave,
  nombre,
  roles,
  instrucciones,
  modelo,
  maxTokens,
  limiteHora,
  activo,
}: {
  clave: string;
  nombre: string;
  roles: string;
  instrucciones: string;
  modelo: string;
  maxTokens: number | null;
  limiteHora: number;
  activo: boolean;
}) {
  const t = useTranslations("iaAdmin");
  const [estado, accion, pendiente] = useActionState(guardarAgente, INICIAL);

  return (
    <details className="rounded-card border-linea border">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{nombre}</span>
          <span className="texto-meta block truncate">{roles}</span>
        </span>
        <span className="texto-meta shrink-0">{activo ? t("agents.on") : t("agents.off")}</span>
      </summary>

      <form action={accion} className="border-linea space-y-3 border-t p-4">
        <input type="hidden" name="clave" value={clave} />

        <div>
          <Label htmlFor={`ag-ins-${clave}`}>{t("agents.instructions")}</Label>
          <textarea
            id={`ag-ins-${clave}`}
            name="instrucciones"
            rows={4}
            maxLength={4000}
            defaultValue={instrucciones}
            className="border-linea-fuerte bg-background w-full rounded-control border px-3 py-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="texto-meta mt-1">{t("agents.instructionsHint")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`ag-mod-${clave}`}>{t("agents.model")}</Label>
            <Input id={`ag-mod-${clave}`} name="modelo" defaultValue={modelo} placeholder={t("agents.modelHint")} />
          </div>
          <div>
            <Label htmlFor={`ag-max-${clave}`}>{t("agents.maxTokens")}</Label>
            <Input id={`ag-max-${clave}`} name="max_tokens" type="number" min={0} defaultValue={maxTokens ?? 0} />
          </div>
          <div>
            <Label htmlFor={`ag-lim-${clave}`}>{t("agents.hourlyLimit")}</Label>
            <Input id={`ag-lim-${clave}`} name="limite_hora" type="number" min={1} max={1000} defaultValue={limiteHora} />
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-2 text-[15px]">
          <input type="checkbox" name="activo" defaultChecked={activo} className="size-4" />
          {t("agents.active")}
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pendiente}>
            <Save className="size-4" />
            {t("form.save")}
          </Button>
          <Resultado estado={estado.estado} pendiente={pendiente} />
        </div>
      </form>
    </details>
  );
}
