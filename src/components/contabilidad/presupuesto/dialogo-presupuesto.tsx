"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { crearPresupuesto } from "@/server/contabilidad/presupuesto/acciones";

export function DialogoPresupuesto() {
  const t = useTranslations("contab.presupuesto");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anioActual = new Date().getFullYear();
  const [ejercicio, setEjercicio] = useState(String(anioActual));
  const [nombre, setNombre] = useState(`Presupuesto Institucional ${anioActual}`);
  const [notas, setNotas] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const res = await crearPresupuesto({
      ejercicio: Number(ejercicio),
      nombre,
      notas: notas || undefined,
    });

    setGuardando(false);
    if (res.ok) {
      setAbierto(false);
      setNotas("");
    } else {
      setError(res.error || "Error");
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          {t("nuevo")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("modalCrearTitulo")}</DialogTitle>
            <DialogDescription>{t("modalCrearDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm font-medium text-tinta">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("ejercicio")}</Label>
              <Input
                type="number"
                min="2020"
                max="2100"
                value={ejercicio}
                onChange={(e) => {
                  setEjercicio(e.target.value);
                  setNombre(`Presupuesto Institucional ${e.target.value}`);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("nombre")}</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas o justificación</Label>
            <Textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Base de cálculo, supuestos económicos..."
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAbierto(false)}
            >
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Creando..." : t("guardar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
