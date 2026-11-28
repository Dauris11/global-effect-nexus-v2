"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Bus,
  CheckCircle2,
  Loader2,
  Package,
  Pencil,
  Plus,
  Power,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  FormularioParametros,
  type CampoParametro,
} from "@/components/parametros/formulario-parametros";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { TARJETA } from "@/lib/paleta";
import {
  cambiarEstadoLugarPasajeAction,
  cambiarEstadoTipoMaterialAction,
  guardarLugarPasajeAction,
  guardarTipoMaterialAction,
} from "@/server/parametros/catalogos-acciones";
import type {
  LugarPasaje,
  TipoMaterial,
} from "@/server/parametros/catalogos-consultas";

/**
 * Contenedor con pestañas de Configuración > Parámetros:
 *   1. Parámetros institucionales generales.
 *   2. Tipos de Materiales (CRUD completo: crear, listar, editar, activar/desactivar).
 *   3. Lugares de Pasaje (CRUD completo con monto en DOP; inicia vacío).
 */
export function PanelParametros({
  grupos,
  tiposMaterial,
  lugaresPasaje,
}: {
  grupos: { clave: string; campos: CampoParametro[] }[];
  tiposMaterial: TipoMaterial[];
  lugaresPasaje: LugarPasaje[];
}) {
  const t = useTranslations("parametros");

  return (
    <Tabs defaultValue="generales" className="space-y-6">
      <TabsList className="h-auto flex-wrap gap-1 p-1">
        <TabsTrigger value="generales" className="gap-2">
          <SlidersHorizontal className="size-4" />
          {t("tabs.generales")}
        </TabsTrigger>
        <TabsTrigger value="materiales" className="gap-2">
          <Package className="size-4" />
          {t("tabs.materiales")}
        </TabsTrigger>
        <TabsTrigger value="pasajes" className="gap-2">
          <Bus className="size-4" />
          {t("tabs.pasajes")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="generales">
        <FormularioParametros grupos={grupos} />
      </TabsContent>

      <TabsContent value="materiales">
        <MantenimientoTiposMaterial items={tiposMaterial} />
      </TabsContent>

      <TabsContent value="pasajes">
        <MantenimientoLugaresPasaje items={lugaresPasaje} />
      </TabsContent>
    </Tabs>
  );
}

function MantenimientoTiposMaterial({ items }: { items: TipoMaterial[] }) {
  const t = useTranslations("parametros.catalogos");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<TipoMaterial | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setError(null);
    setAbierto(true);
  }

  function abrirEditar(item: TipoMaterial) {
    setEditando(item);
    setNombre(item.nombre);
    setError(null);
    setAbierto(true);
  }

  function onGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const limpio = nombre.trim();
    if (!limpio) {
      setError(t("errores.datos_invalidos"));
      return;
    }

    iniciar(async () => {
      const res = await guardarTipoMaterialAction({ id: editando?.id, nombre: limpio });
      if (res.ok) {
        setAbierto(false);
        setEditando(null);
        setNombre("");
      } else {
        setError(t(`errores.${res.error}` as never));
      }
    });
  }

  function onAlternar(item: TipoMaterial) {
    setCambiandoId(item.id);
    iniciar(async () => {
      await cambiarEstadoTipoMaterialAction({ id: item.id, activo: !item.activo });
      setCambiandoId(null);
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="texto-titulo-seccion">{t("materialesTitulo")}</h2>
        <Button type="button" size="sm" onClick={abrirNuevo}>
          <Plus className="size-4" />
          {t("agregarMaterial")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EstadoVacio
          icono={Package}
          titulo={t("materialesVacio")}
          accion={
            <Button type="button" size="sm" onClick={abrirNuevo}>
              <Plus className="size-4" />
              {t("agregarMaterial")}
            </Button>
          }
        />
      ) : (
        <div className={`${TARJETA.contenido} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-2">
              <tr>
                <th className="px-4 py-3 font-medium">{t("colNombre")}</th>
                <th className="w-36 px-4 py-3 font-medium">{t("colEstado")}</th>
                <th className="w-56 px-4 py-3 text-right font-medium">{t("colAcciones")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {items.map((item) => {
                const ocupado = guardando && cambiandoId === item.id;
                return (
                  <tr key={item.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-tinta">{item.nombre}</td>
                    <td className="px-4 py-3">
                      {item.activo ? (
                        <Badge className="border border-status-success-border bg-status-success-bg text-status-success-fg">
                          <CheckCircle2 className="size-3.5" />
                          {t("activo")}
                        </Badge>
                      ) : (
                        <Badge variant="neutra">{t("inactivo")}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => abrirEditar(item)}
                        >
                          <Pencil className="size-3.5" />
                          {t("editar")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          disabled={ocupado}
                          onClick={() => onAlternar(item)}
                        >
                          {ocupado ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Power className="size-3.5" />
                          )}
                          {item.activo ? t("desactivar") : t("activar")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editando ? t("editarMaterialTitulo") : t("nuevoMaterialTitulo")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onGuardar} className="space-y-4 pt-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="mat-nombre" className="text-xs font-medium text-tinta-2">
                {t("colNombre")}
                <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
              </Label>
              <Input
                id="mat-nombre"
                required
                maxLength={120}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs text-background"
              >
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-linea pt-4">
              <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                {t("cancelar")}
              </Button>
              <Button type="submit" cargando={guardando} disabled={guardando}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("guardar")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MantenimientoLugaresPasaje({ items }: { items: LugarPasaje[] }) {
  const t = useTranslations("parametros.catalogos");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<LugarPasaje | null>(null);
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setMonto("");
    setError(null);
    setAbierto(true);
  }

  function abrirEditar(item: LugarPasaje) {
    setEditando(item);
    setNombre(item.nombre);
    setMonto(String(item.monto));
    setError(null);
    setAbierto(true);
  }

  function onGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const limpio = nombre.trim();
    const montoNum = Number(monto);
    if (!limpio || !Number.isFinite(montoNum) || montoNum <= 0) {
      setError(t("errores.datos_invalidos"));
      return;
    }

    iniciar(async () => {
      const res = await guardarLugarPasajeAction({
        id: editando?.id,
        nombre: limpio,
        monto: montoNum,
      });
      if (res.ok) {
        setAbierto(false);
        setEditando(null);
        setNombre("");
        setMonto("");
      } else {
        setError(t(`errores.${res.error}` as never));
      }
    });
  }

  function onAlternar(item: LugarPasaje) {
    setCambiandoId(item.id);
    iniciar(async () => {
      await cambiarEstadoLugarPasajeAction({ id: item.id, activo: !item.activo });
      setCambiandoId(null);
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="texto-titulo-seccion">{t("pasajesTitulo")}</h2>
        <Button type="button" size="sm" onClick={abrirNuevo}>
          <Plus className="size-4" />
          {t("agregarLugar")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EstadoVacio
          icono={Bus}
          titulo={t("pasajesVacio")}
          accion={
            <Button type="button" size="sm" onClick={abrirNuevo}>
              <Plus className="size-4" />
              {t("agregarLugar")}
            </Button>
          }
        />
      ) : (
        <div className={`${TARJETA.contenido} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-2">
              <tr>
                <th className="px-4 py-3 font-medium">{t("colLugar")}</th>
                <th className="w-40 px-4 py-3 text-right font-medium">{t("colMontoDop")}</th>
                <th className="w-36 px-4 py-3 font-medium">{t("colEstado")}</th>
                <th className="w-56 px-4 py-3 text-right font-medium">{t("colAcciones")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {items.map((item) => {
                const ocupado = guardando && cambiandoId === item.id;
                return (
                  <tr key={item.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-tinta">{item.nombre}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-tinta">
                      {formatearMonto(item.monto.toFixed(2), "DOP")}
                    </td>
                    <td className="px-4 py-3">
                      {item.activo ? (
                        <Badge className="border border-status-success-border bg-status-success-bg text-status-success-fg">
                          <CheckCircle2 className="size-3.5" />
                          {t("activo")}
                        </Badge>
                      ) : (
                        <Badge variant="neutra">{t("inactivo")}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => abrirEditar(item)}
                        >
                          <Pencil className="size-3.5" />
                          {t("editar")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          disabled={ocupado}
                          onClick={() => onAlternar(item)}
                        >
                          {ocupado ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Power className="size-3.5" />
                          )}
                          {item.activo ? t("desactivar") : t("activar")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editando ? t("editarLugarTitulo") : t("nuevoLugarTitulo")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onGuardar} className="space-y-4 pt-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="pas-nombre" className="text-xs font-medium text-tinta-2">
                {t("colLugar")}
                <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
              </Label>
              <Input
                id="pas-nombre"
                required
                maxLength={120}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pas-monto" className="text-xs font-medium text-tinta-2">
                {t("colMontoDop")}
                <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
              </Label>
              <Input
                id="pas-monto"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="h-9 font-mono text-sm tabular-nums"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs text-background"
              >
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-linea pt-4">
              <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                {t("cancelar")}
              </Button>
              <Button type="submit" cargando={guardando} disabled={guardando}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("guardar")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
