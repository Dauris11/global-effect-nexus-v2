"use client";

import { useState } from "react";
import { Loader2, Receipt, Save, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { formatearMonto } from "@/lib/contabilidad/formato";
import { registrarMovimientoCajaAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen, CategoriaGastoCaja } from "@/server/contabilidad/cajas/consultas";
import type { UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";

/**
 * Gasto o vale de caja. El gasto pide categoría porque se contabiliza al
 * guardarlo; el vale pide persona porque es dinero que alguien debe rendir.
 */
export function FormularioMovimientoCaja({
  caja,
  personas,
  categorias,
  hoy,
}: {
  caja: CajaResumen;
  personas: UsuarioSolicitante[];
  categorias: CategoriaGastoCaja[];
  hoy: string;
}) {
  const t = useTranslations("contab.cajas");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"gasto" | "vale">("gasto");
  const [monto, setMonto] = useState("");
  const [archivo, setArchivo] = useState<string | null>(null);

  const umbral = Number(caja.umbralAdjunto);
  const requiereAdjunto = tipo === "gasto" && (Number(monto) || 0) >= umbral;

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    setGuardando(true);
    setError(null);
    const datos = new FormData(formulario);
    datos.set("cajaId", caja.id);
    datos.set("tipo", tipo);
    const res = await registrarMovimientoCajaAction(datos);
    setGuardando(false);
    if (res.exito) {
      formulario.reset();
      setMonto("");
      setArchivo(null);
      setAbierto(false);
    } else {
      setError(t(`errores.${res.error}`));
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={caja.estado !== "activa"}>
          <Receipt className="size-4" />
          {t("nuevoMovimiento")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("nuevoMovimiento")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={enviar} className="space-y-4">
          <FormularioGuiado>
            <PasoFormulario titulo={t("pasos.movimiento")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mov-tipo">{t("tipo")}</Label>
                  <select
                    id="mov-tipo"
                    className={SELECT}
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as "gasto" | "vale")}
                  >
                    <option value="gasto">{t("tipoGasto")}</option>
                    <option value="vale">{t("tipoVale")}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mov-fecha">{t("fecha")}</Label>
                  <Input id="mov-fecha" name="fecha" type="date" required defaultValue={hoy} max={hoy} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mov-monto">
                  {t("monto")} ({caja.moneda})
                </Label>
                <Input
                  id="mov-monto"
                  name="monto"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max={caja.saldoActual}
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
                <p className="texto-meta">
                  {t("efectivo")}: {formatearMonto(caja.saldoActual, caja.moneda)}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mov-concepto">{t("concepto")}</Label>
                <Input id="mov-concepto" name="concepto" required minLength={3} maxLength={200} />
              </div>
            </PasoFormulario>

            <PasoFormulario titulo={t("pasos.soporte")}>

              {tipo === "gasto" && (
                <div className="space-y-1.5">
                  <Label htmlFor="mov-categoria">{t("categoria")}</Label>
                  <select id="mov-categoria" name="categoriaId" className={SELECT} required defaultValue="">
                    <option value="" disabled>
                      {t("elegirCategoria")}
                    </option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} · {c.cuenta}
                      </option>
                    ))}
                  </select>
                  <p className="texto-meta">{t("contabilizaGasto")}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="mov-persona">{t("persona")}</Label>
                <select
                  id="mov-persona"
                  name="personaId"
                  className={SELECT}
                  required={tipo === "vale"}
                  defaultValue=""
                >
                  <option value="">{t("elegirPersona")}</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="mov-adjunto">{t("adjunto")}</Label>
                  {requiereAdjunto && <span className="texto-meta font-medium">{t("obligatorio")}</span>}
                </div>
                <label
                  htmlFor="mov-adjunto"
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-dashed border-linea-fuerte p-3 text-sm text-tinta-2 hover:bg-muted/50"
                >
                  <Upload className="size-4 text-marca-600" />
                  <span className="truncate">{archivo ?? t("subirAdjunto")}</span>
                </label>
                <input
                  id="mov-adjunto"
                  name="adjunto"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  required={requiereAdjunto}
                  onChange={(e) => setArchivo(e.target.files?.[0]?.name ?? null)}
                />
                <p className="texto-meta">
                  {t("reglaSoporte", { monto: formatearMonto(caja.umbralAdjunto, caja.moneda) })}
                </p>
              </div>
            </PasoFormulario>

            {error && <AvisoError>{error}</AvisoError>}

            <AccionesFormulario>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  {t("cancelar")}
                </Button>
                <Button type="submit" disabled={guardando}>
                  {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {t("registrar")}
                </Button>
              </div>
            </AccionesFormulario>
          </FormularioGuiado>
        </form>
      </DialogContent>
    </Dialog>
  );
}
