"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Play, Loader2 } from "lucide-react";
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
import { ejecutarDepreciacionMensual } from "@/server/contabilidad/activos-fijos/acciones";

export function DialogoDepreciacion() {
  const t = useTranslations("contab.activosFijos");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear().toString());
  const [mes, setMes] = useState((hoy.getMonth() + 1).toString());
  const [fechaAsiento, setFechaAsiento] = useState(hoy.toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    try {
      await ejecutarDepreciacionMensual(Number(anio), Number(mes), fechaAsiento);
      setAbierto(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al ejecutar depreciación");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#2096BA] text-[#2096BA] hover:bg-[#2096BA]/10">
          <Play className="mr-2 h-4 w-4" />
          {t("ejecutar")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("modalDeprecTitulo")}</DialogTitle>
            <DialogDescription>{t("modalDeprecDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20">
              {error}
            </div>
          )}

          <div className="grid gap-4 py-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="dep-anio">{t("anio")}</Label>
                <Input
                  id="dep-anio"
                  type="number"
                  min="2020"
                  max="2099"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dep-mes">{t("mes")}</Label>
                <Input
                  id="dep-mes"
                  type="number"
                  min="1"
                  max="12"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dep-fecha">{t("fechaAsiento")}</Label>
              <Input
                id="dep-fecha"
                type="date"
                value={fechaAsiento}
                onChange={(e) => setFechaAsiento(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button
              type="submit"
              disabled={cargando}
              className="bg-[#2096BA] hover:bg-[#187a99] text-white"
            >
              {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cargando ? t("procesando") : t("confirmarDepreciacion")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
