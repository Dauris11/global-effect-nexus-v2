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
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearActivoFijo } from "@/server/contabilidad/activos-fijos/acciones";

export function DialogoActivoFijo({
  categorias,
  centrosCosto,
  activosFisicos,
}: {
  categorias: Array<{ id: string; codigo: string; nombre: string }>;
  centrosCosto: Array<{ id: string; codigo: string; nombre: string }>;
  activosFisicos: Array<{ id: string; codigo: string; nombre: string }>;
}) {
  const t = useTranslations("contab.activosFijos");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [centroCostoId, setCentroCostoId] = useState("");
  const [fechaAdquisicion, setFechaAdquisicion] = useState(new Date().toISOString().split("T")[0]);
  const [costoAdquisicion, setCostoAdquisicion] = useState("");
  const [valorResidual, setValorResidual] = useState("0");
  const [esDonado, setEsDonado] = useState(false);
  const [inventarioActivoId, setInventarioActivoId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    try {
      await crearActivoFijo({
        codigo,
        nombre,
        categoria_id: categoriaId,
        centro_costo_id: centroCostoId,
        fecha_adquisicion: fechaAdquisicion,
        costo_adquisicion: Number(costoAdquisicion),
        valor_residual: Number(valorResidual) || 0,
        es_donado: esDonado,
        inventario_activo_id: inventarioActivoId || null,
      });

      setAbierto(false);
      setCodigo("");
      setNombre("");
      setCostoAdquisicion("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar activo");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button className="bg-[#2096BA] hover:bg-[#187a99] text-white">
          <Plus className="mr-2 h-4 w-4" />
          {t("nuevo")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("modalCrearTitulo")}</DialogTitle>
            <DialogDescription>{t("modalCrearDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20">
              {error}
            </div>
          )}

          <FormularioGuiado className="py-4 text-sm">
            <PasoFormulario titulo={t("pasos.identificacion")}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="af-cod">{t("codigo")}</Label>
                  <Input
                    id="af-cod"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="AF-2026-001"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="af-cat">{t("categoria")}</Label>
                  <Select value={categoriaId} onValueChange={setCategoriaId} required>
                    <SelectTrigger id="af-cat">
                      <SelectValue placeholder="Seleccione categoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="af-nom">{t("nombre")}</Label>
                <Input
                  id="af-nom"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Servidor central y switches de red"
                  required
                />
              </div>
            </PasoFormulario>

            <PasoFormulario titulo={t("pasos.adquisicion")}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="af-centro">{t("centroCosto")}</Label>
                  <Select value={centroCostoId} onValueChange={setCentroCostoId} required>
                    <SelectTrigger id="af-centro">
                      <SelectValue placeholder="Seleccione centro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {centrosCosto.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.codigo} — {cc.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="af-fecha">{t("fechaAdquisicion")}</Label>
                  <Input
                    id="af-fecha"
                    type="date"
                    value={fechaAdquisicion}
                    onChange={(e) => setFechaAdquisicion(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="af-costo">{t("costo")} (RD$)</Label>
                  <Input
                    id="af-costo"
                    type="number"
                    step="0.01"
                    min="1"
                    value={costoAdquisicion}
                    onChange={(e) => setCostoAdquisicion(e.target.value)}
                    placeholder="85000.00"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="af-res">{t("valorResidual")} (RD$)</Label>
                  <Input
                    id="af-res"
                    type="number"
                    step="0.01"
                    value={valorResidual}
                    onChange={(e) => setValorResidual(e.target.value)}
                  />
                </div>
              </div>
            </PasoFormulario>

            <PasoFormulario titulo={t("pasos.origen")}>
              {activosFisicos.length > 0 && (
                <div className="space-y-1">
                  <Label htmlFor="af-qr">{t("enlaceInventarioQr")}</Label>
                  <Select value={inventarioActivoId} onValueChange={setInventarioActivoId}>
                    <SelectTrigger id="af-qr">
                      <SelectValue placeholder="Sin enlace / Activo contable puro" />
                    </SelectTrigger>
                    <SelectContent>
                      {activosFisicos.map((af) => (
                        <SelectItem key={af.id} value={af.id}>
                          {af.codigo} — {af.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={esDonado}
                  onChange={(e) => setEsDonado(e.target.checked)}
                  className="rounded border-linea-fuerte text-[#2096BA] focus:ring-[#2096BA]"
                />
                <span>{t("esDonado")} (Aporte de patrocinador)</span>
              </label>
            </PasoFormulario>

            <AccionesFormulario>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                  {t("cancelar")}
                </Button>
                <Button
                  type="submit"
                  disabled={cargando || !codigo || !nombre || !categoriaId || !centroCostoId || !costoAdquisicion}
                  className="bg-[#2096BA] hover:bg-[#187a99] text-white"
                >
                  {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {cargando ? t("procesando") : t("guardar")}
                </Button>
              </DialogFooter>
            </AccionesFormulario>
          </FormularioGuiado>
        </form>
      </DialogContent>
    </Dialog>
  );
}
