"use client";

import { useState } from "react";
import { Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { AccionesFormulario, FormularioGuiado, PasoFormulario } from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { crearOrdenCompra } from "@/server/contabilidad/compras/acciones";

type LineaForm = {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  itbisTasa: string;
};

export function DialogoOrdenCompra({
  proveedores,
  fondos,
  categorias,
}: {
  proveedores: { id: string; nombre: string; identificacion: string }[];
  fondos: { id: string; nombre: string }[];
  categorias: { id: string; nombre: string }[];
}) {
  const t = useTranslations("contab.compras");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [moneda, setMoneda] = useState<"DOP" | "USD">("DOP");
  const [fondoId, setFondoId] = useState(fondos[0]?.id ?? "");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [justificacion, setJustificacion] = useState("");

  const [lineas, setLineas] = useState<LineaForm[]>([
    { descripcion: "", cantidad: "1", precioUnitario: "", itbisTasa: "0.18" },
  ]);

  function agregarLinea() {
    setLineas([...lineas, { descripcion: "", cantidad: "1", precioUnitario: "", itbisTasa: "0.18" }]);
  }

  function eliminarLinea(idx: number) {
    if (lineas.length <= 1) return;
    setLineas(lineas.filter((_, i) => i !== idx));
  }

  function actualizarLinea(idx: number, campo: keyof LineaForm, valor: string) {
    const copia = [...lineas];
    copia[idx] = { ...copia[idx], [campo]: valor };
    setLineas(copia);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const lineasParseadas = lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad || 1),
      precioUnitario: Number(l.precioUnitario || 0),
      itbisTasa: Number(l.itbisTasa || 0.18),
    }));

    const res = await crearOrdenCompra({
      proveedorId,
      fecha,
      fechaEntrega: fechaEntrega || undefined,
      moneda,
      fondoId,
      categoriaId,
      justificacion: justificacion || undefined,
      lineas: lineasParseadas,
    });

    setCargando(false);

    if (!res.ok) {
      setError(res.error || t("errorGuardar"));
      return;
    }

    setAbierto(false);
    setJustificacion("");
    setLineas([{ descripcion: "", cantidad: "1", precioUnitario: "", itbisTasa: "0.18" }]);
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <ShoppingBag className="mr-2 size-4" />
          {t("nuevaOrdenCompra")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("crearOrdenCompra")}</DialogTitle>
            <DialogDescription>{t("descripcionOrdenCompra")}</DialogDescription>
          </DialogHeader>

          {error && <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm font-medium text-tinta">{error}</div>}

          <FormularioGuiado>
            <PasoFormulario titulo={t("pasos.datos")}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("proveedor")}</Label>
                  <Select value={proveedorId} onValueChange={setProveedorId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("seleccioneProveedor")} />
                    </SelectTrigger>
                    <SelectContent>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre} ({p.identificacion})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("fechaEmision")}</Label>
                  <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("moneda")}</Label>
                  <Select value={moneda} onValueChange={(v: "DOP" | "USD") => setMoneda(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOP">DOP (RD$)</SelectItem>
                      <SelectItem value="USD">USD (US$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("fondo")}</Label>
                  <Select value={fondoId} onValueChange={setFondoId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fondos.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("categoriaGasto")}</Label>
                  <Select value={categoriaId} onValueChange={setCategoriaId}>
                    <SelectTrigger>
                      <SelectValue />
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
            </PasoFormulario>

            <PasoFormulario titulo={t("pasos.lineas")}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{t("articulosYServicios")}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={agregarLinea}>
                    <Plus className="mr-1 size-3.5" />
                    {t("agregarLinea")}
                  </Button>
                </div>

                <div className="space-y-2">
                  {lineas.map((l, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-linea p-2 text-xs dark:border-slate-800">
                      <Input
                        placeholder={t("descripcionArticulo")}
                        value={l.descripcion}
                        onChange={(e) => actualizarLinea(idx, "descripcion", e.target.value)}
                        className="flex-1"
                        required
                      />
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder={t("cant")}
                        value={l.cantidad}
                        onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)}
                        className="w-16"
                        required
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={t("precioUnitario")}
                        value={l.precioUnitario}
                        onChange={(e) => actualizarLinea(idx, "precioUnitario", e.target.value)}
                        className="w-24"
                        required
                      />
                      <Select
                        value={l.itbisTasa}
                        onValueChange={(v) => actualizarLinea(idx, "itbisTasa", v)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.18">18% ITBIS</SelectItem>
                          <SelectItem value="0.16">16% ITBIS</SelectItem>
                          <SelectItem value="0">0% Exento</SelectItem>
                        </SelectContent>
                      </Select>
                      {lineas.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-tinta-2 hover:bg-muted hover:text-tinta"
                          onClick={() => eliminarLinea(idx)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </PasoFormulario>

            <PasoFormulario titulo={t("pasos.justificacion")}>
              <div className="space-y-1.5">
                <Label>{t("justificacionCompra")}</Label>
                <Textarea
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  placeholder={t("placeholderJustificacion")}
                  rows={2}
                />
              </div>
            </PasoFormulario>

            <AccionesFormulario>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                  {t("cancelar")}
                </Button>
                <Button type="submit" disabled={cargando}>
                  {cargando ? t("guardando") : t("enviarAAprobacion")}
                </Button>
              </DialogFooter>
            </AccionesFormulario>
          </FormularioGuiado>
        </form>
      </DialogContent>
    </Dialog>
  );
}
