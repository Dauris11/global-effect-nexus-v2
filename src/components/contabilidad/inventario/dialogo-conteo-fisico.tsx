"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardCheck, Loader2 } from "lucide-react";
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
import { crearConteoFisico } from "@/server/contabilidad/inventario/acciones";

export function DialogoConteoFisico() {
  const t = useTranslations("contab.inventarioContable");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [descripcion, setDescripcion] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    try {
      await crearConteoFisico({
        fecha,
        descripcion,
      });

      setAbierto(false);
      setDescripcion("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar toma física");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardCheck className="mr-2 h-4 w-4" />
          {t("nuevaToma")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("tomaFisicaTitulo")}</DialogTitle>
            <DialogDescription>{t("tomaFisicaDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20">
              {error}
            </div>
          )}

          <div className="grid gap-4 py-4 text-sm">
            <div className="space-y-1">
              <Label htmlFor="conf-fecha">{t("fecha")}</Label>
              <Input
                id="conf-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="conf-desc">{t("descripcion")}</Label>
              <Input
                id="conf-desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Cierre físico mensual almacén de cocina y útiles"
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
              disabled={cargando || !descripcion}
              className="bg-[#2096BA] hover:bg-[#187a99] text-white"
            >
              {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cargando ? t("procesando") : t("iniciarConteo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
