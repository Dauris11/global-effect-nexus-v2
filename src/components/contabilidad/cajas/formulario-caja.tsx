"use client";

import { useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT } from "@/components/contabilidad/comun";
import { MONEDAS } from "@/lib/contabilidad/formato";
import { crearCajaAction } from "@/server/contabilidad/cajas/acciones";
import type { UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";

export function FormularioCaja({
  responsables,
}: {
  responsables: UsuarioSolicitante[];
}) {
  const t = useTranslations("contab.cajas");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [departamento, setDepartamento] = useState("operaciones");
  const [responsableId, setResponsableId] = useState(responsables[0]?.id ?? "");
  const [moneda, setMoneda] = useState<"DOP" | "USD">("DOP");
  const [fondoFijo, setFondoFijo] = useState("10000");
  const [umbralAdjunto, setUmbralAdjunto] = useState("500");

  async function onCrearCaja(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const ff = parseFloat(fondoFijo);
    const ua = parseFloat(umbralAdjunto);

    if (isNaN(ff) || ff <= 0) {
      setError("El fondo fijo debe ser un valor numérico mayor a cero.");
      setGuardando(false);
      return;
    }

    try {
      const res = await crearCajaAction({
        codigo,
        nombre,
        departamento,
        responsableId,
        moneda,
        fondoFijo: ff,
        umbralAdjunto: isNaN(ua) ? 500 : ua,
      });

      if (res.exito) {
        setAbierto(false);
        setCodigo("");
        setNombre("");
      } else {
        setError(res.error);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Error al crear la caja.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          <span>{t("nuevaCaja")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("crearCaja")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onCrearCaja} className="space-y-4 pt-2 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="codigo">{t("codigo")}</Label>
              <Input
                id="codigo"
                placeholder="CJ-OP-01"
                required
                className="uppercase font-mono"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="departamento">{t("departamento")}</Label>
              <select
                id="departamento"
                className={SELECT}
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value)}
              >
                <option value="operaciones">Operaciones</option>
                <option value="direccion">Dirección</option>
                <option value="academico">Académico</option>
                <option value="habitudes">Habitudes</option>
                <option value="comedor">Comedor</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="nombre">{t("nombre")}</Label>
            <Input
              id="nombre"
              placeholder="Caja Chica Operaciones Sede La Vega"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="responsable">{t("responsable")}</Label>
            <select
              id="responsable"
              className={SELECT}
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              required
            >
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.rol})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="moneda">{t("moneda")}</Label>
              <select
                id="moneda"
                className={SELECT}
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as "DOP" | "USD")}
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fondoFijo">{t("fondoFijo")}</Label>
              <Input
                id="fondoFijo"
                type="number"
                step="0.01"
                required
                value={fondoFijo}
                onChange={(e) => setFondoFijo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="umbralAdjunto">Umbral Req.</Label>
              <Input
                id="umbralAdjunto"
                type="number"
                step="0.01"
                required
                value={umbralAdjunto}
                onChange={(e) => setUmbralAdjunto(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-control bg-semaforo-alerta/15 p-2.5 text-xs text-semaforo-alerta">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>{t("crearCaja")}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
