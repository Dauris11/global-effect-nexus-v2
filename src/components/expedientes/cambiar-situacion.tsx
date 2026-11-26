"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRightLeft, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ESTADOS_ESTUDIANTE } from "@/lib/expedientes";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { cambiarSituacionExpediente, type EstadoSituacion } from "@/server/expedientes/acciones";

const CLASE_SELECT =
  "h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta sm:text-[15px]";

/** Cambiar la situación de un estudiante: a cuál pasa, por qué y desde cuándo. */
export function CambiarSituacion({ estudianteId, estadoActual }: { estudianteId: string; estadoActual: string; tieneCuenta: boolean }) {
  const t = useTranslations("records.situation");
  const te = useTranslations("records.status");
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [estado, enviar, guardando] = useActionState<EstadoSituacion, FormData>(async (previo, datos) => {
    const r = await cambiarSituacionExpediente(previo, datos);

    if (r.estado === "ok") setAbierto(false);

    return r;
  }, { estado: "inicial" });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft className="size-4" />
          {t("button")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          <input type="hidden" name="estudiante" value={estudianteId} />

          <div className="space-y-1.5">
            <Label htmlFor="sit-estado">{t("newState")}</Label>
            <select id="sit-estado" name="nuevo_estado" required value={nuevo} onChange={(e) => setNuevo(e.target.value)} className={CLASE_SELECT}>
              <option value="" disabled />
              {ESTADOS_ESTUDIANTE.filter((e) => e !== estadoActual).map((e) => (
                <option key={e} value={e}>{te(e)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sit-motivo">{t("reason")}</Label>
            <Textarea id="sit-motivo" name="motivo" rows={3} maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sit-fecha">{t("date")}</Label>
            <Input id="sit-fecha" name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>

          {estado.estado !== "inicial" && estado.estado !== "ok" && (
            <p role="alert" className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>{t(`errors.${estado.estado}`)}</span>
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={guardando || nuevo === ""}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
