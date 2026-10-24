"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoEstado, useAccionConfig } from "@/components/contabilidad/configuracion/aviso-estado";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nuevaVigencia } from "@/server/contabilidad/configuracion/acciones";
import type { FormaParametro } from "@/server/contabilidad/configuracion/consultas";

/** El día siguiente a `iso`: la vigencia nueva tiene que empezar después de la última. */
function diaSiguiente(iso: string): string {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

/**
 * "Nueva vigencia": una fila nueva desde una fecha. La anterior no se edita,
 * se cierra; lo hace la server action en la misma transacción.
 */
export function DialogoVigencia({
  clave,
  nombre,
  forma,
  minimo,
}: {
  clave: string;
  nombre: string;
  forma: FormaParametro;
  /** `vigente_desde` de la última fila. */
  minimo: string;
}) {
  const t = useTranslations("contab.config.vigencia");
  const [abierto, setAbierto] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11">
          <CalendarPlus className="size-4" />
          {t("abrir")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("titulo", { nombre })}</DialogTitle>
          <DialogDescription>{t("descripcion")}</DialogDescription>
        </DialogHeader>
        <FormularioVigencia
          clave={clave}
          forma={forma}
          minimo={minimo}
          alTerminar={() => setAbierto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormularioVigencia({
  clave,
  forma,
  minimo,
  alTerminar,
}: {
  clave: string;
  forma: FormaParametro;
  minimo: string;
  alTerminar: () => void;
}) {
  const t = useTranslations("contab.config.vigencia");
  const [estado, enviar, enviando] = useAccionConfig(nuevaVigencia, alTerminar);
  const esTasa = forma === "tasa";

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="clave" value={clave} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vig-desde" className="text-sm font-medium">
            {t("desde")}
          </Label>
          <Input id="vig-desde" name="desde" type="date" required min={diaSiguiente(minimo)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vig-cifra" className="text-sm font-medium">
            {esTasa ? t("tasa") : t("monto")}
          </Label>
          <Input
            id="vig-cifra"
            name="cifra"
            inputMode="decimal"
            required
            maxLength={20}
            placeholder={esTasa ? t("tasaEjemplo") : t("montoEjemplo")}
          />
          <p className="texto-meta">{esTasa ? t("tasaAyuda") : t("montoAyuda")}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vig-fuente" className="text-sm font-medium">
          {t("fuente")}
        </Label>
        <Input id="vig-fuente" name="fuente" required minLength={3} maxLength={200} placeholder={t("fuenteEjemplo")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vig-nota" className="text-sm font-medium">
          {t("nota")}
        </Label>
        <Textarea id="vig-nota" name="nota" maxLength={500} rows={2} />
      </div>
      <AvisoEstado estado={estado} />
      <DialogFooter>
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("guardar")}
        </Button>
      </DialogFooter>
    </form>
  );
}
