"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearTercero } from "@/server/contabilidad/terceros/acciones";

export function DialogoTercero() {
  const t = useTranslations("contab.terceros");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tipoPersona, setTipoPersona] = useState<"fisica" | "juridica" | "gubernamental">("juridica");
  const [tipoId, setTipoId] = useState<"rnc" | "cedula" | "pasaporte">("rnc");
  const [identificacion, setIdentificacion] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [esDonante, setEsDonante] = useState(true);
  const [esProveedor, setEsProveedor] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await crearTercero({
      tipoPersona,
      tipoId,
      identificacion,
      nombreRazonSocial: nombre,
      nombreComercial: nombreComercial || undefined,
      contactoPrincipal: contacto || undefined,
      telefono: telefono || undefined,
      email: email || undefined,
      direccion: direccion || undefined,
      esDonante,
      esProveedor,
    });

    setCargando(false);

    if (!res.ok) {
      setError(res.error || t("errorGuardar"));
      return;
    }

    setAbierto(false);
    setIdentificacion("");
    setNombre("");
    setNombreComercial("");
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 size-4" />
          {t("nuevoTercero")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("registrarTercero")}</DialogTitle>
            <DialogDescription>{t("descripcionTercero")}</DialogDescription>
          </DialogHeader>

          {error && <div className="rounded-md border border-linea-fuerte bg-muted p-3 text-sm text-tinta">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("tipoPersona")}</Label>
              <Select
                value={tipoPersona}
                onValueChange={(v: "fisica" | "juridica" | "gubernamental") => {
                  setTipoPersona(v);
                  if (v === "fisica") setTipoId("cedula");
                  else setTipoId("rnc");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridica">{t("juridica")}</SelectItem>
                  <SelectItem value="fisica">{t("fisica")}</SelectItem>
                  <SelectItem value="gubernamental">{t("gubernamental")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("tipoId")}</Label>
              <Select value={tipoId} onValueChange={(v: "rnc" | "cedula" | "pasaporte") => setTipoId(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rnc">RNC (9 dígitos)</SelectItem>
                  <SelectItem value="cedula">Cédula (11 dígitos)</SelectItem>
                  <SelectItem value="pasaporte">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("identificacion")}</Label>
              <Input
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                placeholder={tipoId === "rnc" ? "101000000" : "04700000000"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("nombreRazonSocial")}</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("nombreComercial")}</Label>
              <Input value={nombreComercial} onChange={(e) => setNombreComercial(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("contactoPrincipal")}</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("telefono")}</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("direccion")}</Label>
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>

          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={esDonante}
                onChange={(e) => setEsDonante(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t("esDonante")}
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={esProveedor}
                onChange={(e) => setEsProveedor(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t("esProveedor")}
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button type="submit" disabled={cargando}>
              {cargando ? t("guardando") : t("guardar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
