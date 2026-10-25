"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearNomina } from "@/server/contabilidad/nomina/acciones";

export function DialogoNuevaNomina() {
  const t = useTranslations("contab.nomina");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const fechaHoyStr = hoy.toISOString().split("T")[0];

  const [anio, setAnio] = useState(anioActual.toString());
  const [mes, setMes] = useState(mesActual.toString());
  const [periodoTipo, setPeriodoTipo] = useState<"mensual" | "primera_quincena" | "segunda_quincena" | "regalia_pascual">("mensual");
  const [fechaCorte, setFechaCorte] = useState(fechaHoyStr);
  const [fechaPago, setFechaPago] = useState(fechaHoyStr);
  const [notas, setNotas] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    try {
      await crearNomina({
        anio: Number(anio),
        mes: Number(mes),
        periodo_tipo: periodoTipo,
        fecha_corte: fechaCorte,
        fecha_pago: fechaPago,
        notas: notas || undefined,
      });
      setAbierto(false);
      setNotas("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar nómina");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button className="bg-[#2096BA] hover:bg-[#187a99] text-white">
          <Plus className="mr-2 h-4 w-4" />
          {t("nueva")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("modalNominaTitulo")}</DialogTitle>
            <DialogDescription>{t("modalNominaDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20">
              {error}
            </div>
          )}

          <div className="grid gap-4 py-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nom-anio">{t("anio")}</Label>
                <Input
                  id="nom-anio"
                  type="number"
                  min="2020"
                  max="2099"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nom-mes">{t("mes")}</Label>
                <Input
                  id="nom-mes"
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
              <Label htmlFor="nom-tipo">{t("tipoPeriodo")}</Label>
              <Select
                value={periodoTipo}
                onValueChange={(val: "mensual" | "primera_quincena" | "segunda_quincena" | "regalia_pascual") =>
                  setPeriodoTipo(val)
                }
              >
                <SelectTrigger id="nom-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">{t("mensual")}</SelectItem>
                  <SelectItem value="primera_quincena">{t("primera_quincena")}</SelectItem>
                  <SelectItem value="segunda_quincena">{t("segunda_quincena")}</SelectItem>
                  <SelectItem value="regalia_pascual">{t("regalia_pascual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nom-corte">{t("fechaCorte")}</Label>
                <Input
                  id="nom-corte"
                  type="date"
                  value={fechaCorte}
                  onChange={(e) => setFechaCorte(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nom-pago">{t("fechaPago")}</Label>
                <Input
                  id="nom-pago"
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="nom-notas">{t("notas")}</Label>
              <Input
                id="nom-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. Nómina quincenal regular personal docente y operativo"
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
              {cargando ? t("procesando") : t("generar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
