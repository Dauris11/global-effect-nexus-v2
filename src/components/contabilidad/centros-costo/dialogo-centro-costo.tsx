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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { crearCentroCosto } from "@/server/contabilidad/centros-costo/acciones";

export function DialogoCentroCosto() {
  const t = useTranslations("contab.centrosCosto");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [programa, setPrograma] = useState<
    "becas" | "formacion_360" | "comedor" | "administrativo" | "institucional" | "proyectos"
  >("becas");
  const [descripcion, setDescripcion] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const res = await crearCentroCosto({
      codigo,
      nombre,
      programa,
      descripcion: descripcion || undefined,
    });

    setGuardando(false);
    if (res.ok) {
      setAbierto(false);
      setCodigo("");
      setNombre("");
      setDescripcion("");
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
            <DialogTitle>{t("crearTitulo")}</DialogTitle>
            <DialogDescription>{t("crearDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm font-medium text-tinta">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("codigo")}</Label>
              <Input
                placeholder="CC-BECAS"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("programa")}</Label>
              <Select value={programa} onValueChange={(v: "becas" | "formacion_360" | "comedor" | "administrativo" | "institucional" | "proyectos") => setPrograma(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="becas">{t("becas")}</SelectItem>
                  <SelectItem value="formacion_360">{t("formacion_360")}</SelectItem>
                  <SelectItem value="comedor">{t("comedor")}</SelectItem>
                  <SelectItem value="administrativo">{t("administrativo")}</SelectItem>
                  <SelectItem value="institucional">{t("institucional")}</SelectItem>
                  <SelectItem value="proyectos">{t("proyectos")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("nombre")}</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("descripcion")}</Label>
            <Textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
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
              {guardando ? t("guardando") : t("guardar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
