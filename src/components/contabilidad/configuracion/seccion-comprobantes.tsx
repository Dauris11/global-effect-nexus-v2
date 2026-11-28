"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, ReceiptText, Save, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { SELECT } from "@/components/contabilidad/comun";
import { AvisoEstado } from "@/components/contabilidad/configuracion/aviso-estado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COMPROBANTES_RD,
  etiquetaComprobanteRd,
} from "@/lib/contabilidad/comprobantes-rd";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  agregarComprobanteSecuencia,
  definirVigenciaComprobante,
  type EstadoConfig,
} from "@/server/contabilidad/configuracion/acciones";
import type { ComprobanteSecuencia } from "@/server/contabilidad/configuracion/consultas";

const INICIAL: EstadoConfig = { estado: "inicial" };

export function SeccionComprobantes({
  comprobantes,
  puedeEditar,
}: {
  comprobantes: ComprobanteSecuencia[];
  puedeEditar: boolean;
}) {
  const t = useTranslations("contab.config.comprobantes");
  const [abiertoAgregar, setAbiertoAgregar] = useState(false);
  const [tipo, setTipo] = useState<string>("B11");
  const [cantidad, setCantidad] = useState<string>("");

  const [estadoAgregar, enviarAgregar, guardando] = useActionState(
    async (previo: EstadoConfig, datos: FormData) => {
      const res = await agregarComprobanteSecuencia(previo, datos);
      if (res.estado === "ok") {
        setCantidad("");
        setAbiertoAgregar(false);
      }
      return res;
    },
    INICIAL,
  );

  // Última secuencia `hasta` registrada para el tipo elegido.
  const ultimaPorTipo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of comprobantes) {
      const prev = mapa.get(c.tipo) ?? 0;
      if (c.hasta > prev) mapa.set(c.tipo, c.hasta);
    }
    return mapa;
  }, [comprobantes]);

  const desdeCalculado = (ultimaPorTipo.get(tipo) ?? 0) + 1;
  const cantidadNum = Number.parseInt(cantidad, 10);
  const hastaCalculado =
    Number.isInteger(cantidadNum) && cantidadNum > 0
      ? desdeCalculado + cantidadNum
      : "";

  const controlAlineado = "h-9 px-3 py-0 text-sm";
  const selectAlineado = cn(SELECT, "h-9 px-3 text-sm");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="texto-titulo-seccion">{t("titulo")}</h2>

        {puedeEditar && (
          <Dialog open={abiertoAgregar} onOpenChange={setAbiertoAgregar}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" />
                {t("agregar")}
              </Button>
            </DialogTrigger>
            <DialogContent className="md:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("agregarTitulo")}</DialogTitle>
              </DialogHeader>

              <form action={enviarAgregar} className="space-y-5 pt-2 text-sm">
                <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5 sm:col-span-2">
                    <Label htmlFor="comp-tipo" className="block text-xs font-medium leading-none text-tinta-2">
                      {t("tipo")}
                      <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                    </Label>
                    <select
                      id="comp-tipo"
                      name="tipo"
                      className={selectAlineado}
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      required
                    >
                      {COMPROBANTES_RD.map((c) => (
                        <option key={c.codigo} value={c.codigo}>
                          {c.codigo} · {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="comp-cantidad" className="block text-xs font-medium leading-none text-tinta-2">
                      {t("cantidad")}
                      <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                    </Label>
                    <Input
                      id="comp-cantidad"
                      name="cantidad"
                      inputMode="numeric"
                      required
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))}
                      className={cn(controlAlineado, "tabular-nums")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="comp-desde" className="block text-xs font-medium leading-none text-tinta-2">
                        {t("desde")}
                      </Label>
                      <Input
                        id="comp-desde"
                        readOnly
                        tabIndex={-1}
                        value={String(desdeCalculado)}
                        className={cn(controlAlineado, "bg-muted/40 font-mono tabular-nums text-tinta-2")}
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="comp-hasta" className="block text-xs font-medium leading-none text-tinta-2">
                        {t("hasta")}
                      </Label>
                      <Input
                        id="comp-hasta"
                        readOnly
                        tabIndex={-1}
                        value={String(hastaCalculado)}
                        className={cn(controlAlineado, "bg-muted/40 font-mono tabular-nums text-tinta-2")}
                      />
                    </div>
                  </div>
                </div>

                <AvisoEstado estado={estadoAgregar} />

                <div className="flex justify-end gap-2 border-t border-linea pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAbiertoAgregar(false)}
                  >
                    {t("cancelar")}
                  </Button>
                  <Button type="submit" cargando={guardando}>
                    {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {t("guardar")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {comprobantes.length === 0 ? (
        <EstadoVacio icono={ReceiptText} titulo={t("vacio")} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-linea text-xs text-tinta-3">
              <tr>
                <th className="px-4 py-3 font-medium">{t("col.tipo")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t("col.cantidad")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t("col.desde")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t("col.hasta")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t("col.usados")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-center font-medium">{t("col.vigente")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {comprobantes.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-tinta">
                    {etiquetaComprobanteRd(c.tipo)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-tinta">
                    {c.cantidad}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-tinta-2">
                    {c.desde}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-tinta-2">
                    {c.hasta}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-tinta">
                    {c.usados}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    {c.vigente === true ? (
                      <Badge className={INSIGNIA_SEMAFORO.dentro}>
                        <CheckCircle2 />
                        {t("si")}
                      </Badge>
                    ) : c.vigente === false ? (
                      <Badge className={INSIGNIA_SEMAFORO.alerta}>
                        <XCircle />
                        {t("no")}
                      </Badge>
                    ) : puedeEditar ? (
                      <BotonDefinirVigencia id={c.id} />
                    ) : (
                      <span className="text-xs text-tinta-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BotonDefinirVigencia({ id }: { id: string }) {
  const t = useTranslations("contab.config.comprobantes");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoConfig, datos: FormData) => {
      const res = await definirVigenciaComprobante(previo, datos);
      if (res.estado === "ok") setAbierto(false);
      return res;
    },
    INICIAL,
  );

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="px-2.5">
          {t("abrir")}
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("preguntaVigente")}</DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4 pt-2">
          <input type="hidden" name="id" value={id} />
          <AvisoEstado estado={estado} />
          <div className="flex justify-center gap-3">
            <Button
              type="submit"
              name="vigente"
              value="si"
              disabled={enviando}
              className="min-w-24"
            >
              {t("si")}
            </Button>
            <Button
              type="submit"
              name="vigente"
              value="no"
              variant="outline"
              disabled={enviando}
              className="min-w-24"
            >
              {t("no")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
