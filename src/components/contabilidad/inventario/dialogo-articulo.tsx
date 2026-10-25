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
import { crearArticulo } from "@/server/contabilidad/inventario/acciones";

export function DialogoArticulo({
  centrosCosto,
  cuentasInventario,
  cuentasGasto,
}: {
  centrosCosto: Array<{ id: string; codigo: string; nombre: string }>;
  cuentasInventario: Array<{ id: string; codigo: string; nombre: string }>;
  cuentasGasto: Array<{ id: string; codigo: string; nombre: string }>;
}) {
  const t = useTranslations("contab.inventarioContable");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<
    "alimentos_comedor" | "suministros_oficina" | "material_didactico" | "limpieza" | "otros"
  >("alimentos_comedor");
  const [unidadMedida, setUnidadMedida] = useState<
    "unidad" | "libra" | "kilo" | "caja" | "saco" | "litro" | "galon" | "paquete"
  >("libra");
  const [centroCostoId, setCentroCostoId] = useState(centrosCosto[0]?.id || "");
  const [cuentaInventarioId, setCuentaInventarioId] = useState(cuentasInventario[0]?.id || "");
  const [cuentaGastoId, setCuentaGastoId] = useState(cuentasGasto[0]?.id || "");
  const [stockMinimo, setStockMinimo] = useState("10");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    try {
      await crearArticulo({
        codigo,
        nombre,
        categoria,
        unidad_medida: unidadMedida,
        centro_costo_id: centroCostoId || null,
        cuenta_inventario_id: cuentaInventarioId,
        cuenta_gasto_id: cuentaGastoId,
        stock_minimo: Number(stockMinimo) || 0,
      });

      setAbierto(false);
      setCodigo("");
      setNombre("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar artículo");
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("modalArticuloTitulo")}</DialogTitle>
            <DialogDescription>{t("modalArticuloDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20">
              {error}
            </div>
          )}

          <div className="grid gap-4 py-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="art-cod">{t("codigo")}</Label>
                <Input
                  id="art-cod"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="ART-001"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="art-cat">{t("categoria")}</Label>
                <Select
                  value={categoria}
                  onValueChange={(val: any) => setCategoria(val)}
                >
                  <SelectTrigger id="art-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alimentos_comedor">Alimentos y Comedor</SelectItem>
                    <SelectItem value="material_didactico">Material Didáctico</SelectItem>
                    <SelectItem value="suministros_oficina">Suministros Oficina</SelectItem>
                    <SelectItem value="limpieza">Limpieza e Higiene</SelectItem>
                    <SelectItem value="otros">Otros Consumibles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="art-nom">{t("nombre")}</Label>
              <Input
                id="art-nom"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Arroz Selecto en saco 125 lbs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="art-um">{t("unidadMedida")}</Label>
                <Select
                  value={unidadMedida}
                  onValueChange={(val: any) => setUnidadMedida(val)}
                >
                  <SelectTrigger id="art-um">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="libra">Libra</SelectItem>
                    <SelectItem value="kilo">Kilo</SelectItem>
                    <SelectItem value="unidad">Unidad</SelectItem>
                    <SelectItem value="caja">Caja</SelectItem>
                    <SelectItem value="saco">Saco</SelectItem>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="galon">Galón</SelectItem>
                    <SelectItem value="paquete">Paquete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="art-min">{t("stockMinimo")}</Label>
                <Input
                  id="art-min"
                  type="number"
                  value={stockMinimo}
                  onChange={(e) => setStockMinimo(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="art-cta-inv">{t("cuentaInventario")}</Label>
              <Select value={cuentaInventarioId} onValueChange={setCuentaInventarioId} required>
                <SelectTrigger id="art-cta-inv">
                  <SelectValue placeholder="Seleccione cuenta..." />
                </SelectTrigger>
                <SelectContent>
                  {cuentasInventario.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="art-cta-gas">{t("cuentaGasto")}</Label>
              <Select value={cuentaGastoId} onValueChange={setCuentaGastoId} required>
                <SelectTrigger id="art-cta-gas">
                  <SelectValue placeholder="Seleccione cuenta..." />
                </SelectTrigger>
                <SelectContent>
                  {cuentasGasto.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button
              type="submit"
              disabled={cargando || !codigo || !nombre || !cuentaInventarioId || !cuentaGastoId}
              className="bg-[#2096BA] hover:bg-[#187a99] text-white"
            >
              {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cargando ? t("procesando") : t("guardar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
