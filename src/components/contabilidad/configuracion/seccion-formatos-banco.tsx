"use client";

import { useState } from "react";
import { CheckCircle2, CircleSlash, Landmark, Loader2, Pencil, Plus, Power, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoEstado, useAccionConfig } from "@/components/contabilidad/configuracion/aviso-estado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormatoEstadoBanco } from "@/lib/contabilidad/formato-estado-banco";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import {
  cambiarEstadoFormatoEstadoBanco,
  guardarFormatoEstadoBanco,
} from "@/server/contabilidad/configuracion/acciones";

export function SeccionFormatosBanco({
  formatos,
  puedeEditar,
}: {
  formatos: FormatoEstadoBanco[];
  puedeEditar: boolean;
}) {
  const t = useTranslations("contab.config.formatosBanco");
  const [editando, setEditando] = useState<FormatoEstadoBanco | "nuevo" | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<FormatoEstadoBanco | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="texto-titulo-seccion">{t("titulo")}</h2>
        {puedeEditar && (
          <Button type="button" size="sm" onClick={() => setEditando("nuevo")}>
            <Plus className="size-4" />
            {t("nuevo")}
          </Button>
        )}
      </div>

      {formatos.length === 0 ? (
        <EstadoVacio icono={Landmark} titulo={t("vacioTitulo")} />
      ) : (
        <div className="space-y-3">
          {formatos.map((f) => (
            <div
              key={f.id}
              className={`${TARJETA.contenido} flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between`}
            >
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-tinta">{f.nombre}</p>
                  <Badge className={f.activo ? INSIGNIA_SEMAFORO.dentro : INSIGNIA_SEMAFORO.alerta}>
                    {f.activo ? <CheckCircle2 /> : <CircleSlash />}
                    {f.activo ? t("estado.activo") : t("estado.inactivo")}
                  </Badge>
                </div>
                <p className="texto-meta">
                  {t("reglasResumen", {
                    filas: f.filasOmitirInicio,
                    ultima: f.omitirUltimaFila ? t("si") : t("no"),
                  })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {f.columnas.map((col, idx) => (
                    <span
                      key={`${f.id}-${idx}`}
                      className="rounded-control border border-linea bg-muted/40 px-2 py-0.5 text-xs text-tinta-2"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {puedeEditar && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditando(f)}>
                    <Pencil className="size-4" />
                    {t("editar")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCambiandoEstado(f)}
                  >
                    {f.activo ? <CircleSlash className="size-4" /> : <Power className="size-4" />}
                    {f.activo ? t("desactivar") : t("activar")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editando && (
        <DialogoFormatoBanco
          formato={editando === "nuevo" ? null : editando}
          alCerrar={() => setEditando(null)}
        />
      )}

      {cambiandoEstado && (
        <DialogoEstadoFormato
          formato={cambiandoEstado}
          alCerrar={() => setCambiandoEstado(null)}
        />
      )}
    </div>
  );
}

function DialogoFormatoBanco({
  formato,
  alCerrar,
}: {
  formato: FormatoEstadoBanco | null;
  alCerrar: () => void;
}) {
  const t = useTranslations("contab.config.formatosBanco");
  const [estado, enviar, enviando] = useAccionConfig(guardarFormatoEstadoBanco, alCerrar);
  const [omitirUltima, setOmitirUltima] = useState(formato ? formato.omitirUltimaFila : true);

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formato ? t("dialogoEditar") : t("dialogoNuevo")}</DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          {formato && <input type="hidden" name="id" value={formato.id} />}
          <input type="hidden" name="omitir_ultima_fila" value={omitirUltima ? "1" : "0"} />

          <div className="space-y-1.5">
            <Label htmlFor="fmt-nombre" className="text-sm font-medium">
              {t("nombre")}
            </Label>
            <Input
              id="fmt-nombre"
              name="nombre"
              required
              maxLength={120}
              defaultValue={formato?.nombre ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fmt-filas-inicio" className="text-sm font-medium">
                {t("filasOmitirInicio")}
              </Label>
              <Input
                id="fmt-filas-inicio"
                name="filas_omitir_inicio"
                type="number"
                required
                min={0}
                max={100}
                defaultValue={formato?.filasOmitirInicio ?? 0}
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-tinta">
                <input
                  type="checkbox"
                  checked={omitirUltima}
                  onChange={(e) => setOmitirUltima(e.target.checked)}
                  className="size-4 accent-marca-500"
                />
                <span>{t("omitirUltimaFila")}</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fmt-columnas" className="text-sm font-medium">
              {t("columnas")}
            </Label>
            <Textarea
              id="fmt-columnas"
              name="columnas"
              required
              rows={3}
              maxLength={1000}
              defaultValue={formato ? formato.columnas.join(", ") : ""}
            />
          </div>

          <AvisoEstado estado={estado} />

          <DialogFooter>
            <Button type="submit" cargando={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("guardar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoEstadoFormato({
  formato,
  alCerrar,
}: {
  formato: FormatoEstadoBanco;
  alCerrar: () => void;
}) {
  const t = useTranslations("contab.config.formatosBanco");
  const [estado, enviar, enviando] = useAccionConfig(cambiarEstadoFormatoEstadoBanco, alCerrar);
  const activar = !formato.activo;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {activar ? t("confirmarActivar", { nombre: formato.nombre }) : t("confirmarDesactivar", { nombre: formato.nombre })}
          </DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="id" value={formato.id} />
          <input type="hidden" name="activo" value={activar ? "1" : "0"} />
          <AvisoEstado estado={estado} />
          <DialogFooter>
            <Button type="submit" variant={activar ? "default" : "destructive"} cargando={enviando}>
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : activar ? (
                <Power className="size-4" />
              ) : (
                <CircleSlash className="size-4" />
              )}
              {activar ? t("activar") : t("desactivar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
