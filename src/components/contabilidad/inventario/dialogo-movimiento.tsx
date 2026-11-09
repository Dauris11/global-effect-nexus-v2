"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Loader2 } from "lucide-react";
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
import { registrarMovimientoInventario } from "@/server/contabilidad/inventario/acciones";

export function DialogoMovimiento({
  articulos,
  centrosCosto,
}: {
  articulos: Array<{ id: string; codigo: string; nombre: string; stock_actual: number; unidad_medida: string }>;
  centrosCosto: Array<{ id: string; codigo: string; nombre: string }>;
}) {
  const t = useTranslations("contab.inventarioContable");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [articuloId, setArticuloId] = useState(articulos[0]?.id || "");
  const [tipo, setTipo] = useState<
    "entrada_compra" | "entrada_donacion" | "salida_consumo" | "ajuste_sobrante" | "ajuste_faltante"
  >("salida_consumo");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [centroCostoId, setCentroCostoId] = useState(centrosCosto[0]?.id || "");
  const [motivo, setMotivo] = useState("");

  const esEntrada = tipo === "entrada_compra" || tipo === "entrada_donacion" || tipo === "ajuste_sobrante";
  const articuloSeleccionado = articulos.find((a) => a.id === articuloId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    try {
      await registrarMovimientoInventario({
        articulo_id: articuloId,
        tipo,
        fecha,
        cantidad: Number(cantidad),
        costo_unitario: esEntrada && costoUnitario ? Number(costoUnitario) : undefined,
        centro_costo_id: centroCostoId || null,
        motivo: motivo || undefined,
      });

      setAbierto(false);
      setCantidad("");
      setCostoUnitario("");
      setMotivo("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar movimiento");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          {t("nuevoMovimiento")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("modalMovimientoTitulo")}</DialogTitle>
            <DialogDescription>{t("modalMovimientoDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20">
              {error}
            </div>
          )}

          <FormularioGuiado className="py-4 text-sm">
            <PasoFormulario titulo={t("pasos.movimiento")}>
              <div className="space-y-1">
                <Label htmlFor="mov-art">{t("nombre")}</Label>
                <Select value={articuloId} onValueChange={setArticuloId} required>
                  <SelectTrigger id="mov-art">
                    <SelectValue placeholder="Seleccione artículo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {articulos.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.codigo} — {a.nombre} (Stock: {a.stock_actual} {a.unidad_medida})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="mov-tipo">{t("tipoMovimiento")}</Label>
                  <Select
                    value={tipo}
                    onValueChange={(val: any) => setTipo(val)}
                  >
                    <SelectTrigger id="mov-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salida_consumo">{t("salida_consumo")}</SelectItem>
                      <SelectItem value="entrada_compra">{t("entrada_compra")}</SelectItem>
                      <SelectItem value="entrada_donacion">{t("entrada_donacion")}</SelectItem>
                      <SelectItem value="ajuste_sobrante">{t("ajuste_sobrante")}</SelectItem>
                      <SelectItem value="ajuste_faltante">{t("ajuste_faltante")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="mov-fecha">{t("fecha")}</Label>
                  <Input
                    id="mov-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
              </div>
            </PasoFormulario>

            <PasoFormulario titulo={t("pasos.cantidades")}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="mov-cant">
                    {t("cantidad")} {articuloSeleccionado ? `(${articuloSeleccionado.unidad_medida})` : ""}
                  </Label>
                  <Input
                    id="mov-cant"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    required
                  />
                </div>

                {esEntrada ? (
                  <div className="space-y-1">
                    <Label htmlFor="mov-costo">{t("costoUnitario")} (RD$)</Label>
                    <Input
                      id="mov-costo"
                      type="number"
                      step="0.01"
                      min="0"
                      value={costoUnitario}
                      onChange={(e) => setCostoUnitario(e.target.value)}
                      placeholder="55.00"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="mov-centro">Centro de Imputación</Label>
                    <Select value={centroCostoId} onValueChange={setCentroCostoId}>
                      <SelectTrigger id="mov-centro">
                        <SelectValue />
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
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="mov-motivo">{t("motivo")}</Label>
                <Input
                  id="mov-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Suministro para almuerzo de 120 becados en Comedor"
                />
              </div>
            </PasoFormulario>

            <AccionesFormulario>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                  {t("cancelar")}
                </Button>
                <Button
                  type="submit"
                  disabled={cargando || !articuloId || !cantidad}
                  className="bg-[#2096BA] hover:bg-[#187a99] text-white"
                >
                  {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {cargando ? t("procesando") : t("confirmarMovimiento")}
                </Button>
              </DialogFooter>
            </AccionesFormulario>
          </FormularioGuiado>
        </form>
      </DialogContent>
    </Dialog>
  );
}
