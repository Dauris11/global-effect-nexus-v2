"use client";

import { useState } from "react";
import { CheckCircle2, CircleSlash, Loader2, Pencil, Plus, Power, Save, Scale } from "lucide-react";
import { useTranslations } from "next-intl";

import { SELECT } from "@/components/contabilidad/comun";
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
import { formatearMonto } from "@/lib/contabilidad/formato";
import {
  FORMATOS_VALOR_CARGO,
  PROPOSITOS_CARGO,
  TIPOS_VALOR_CARGO,
  type FormatoValorCargo,
  type ImpuestoCargo,
  type ReglaLegal,
  type TipoValorCargo,
} from "@/lib/contabilidad/impuestos-cargos";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  cambiarEstadoImpuestoCargo,
  cambiarEstadoReglaLegal,
  guardarImpuestoCargo,
  guardarReglaLegal,
} from "@/server/contabilidad/configuracion/acciones";
import type { CuentaMovimientoOpcion } from "@/server/contabilidad/configuracion/consultas";

type ListaActiva = "impuestos_cargos" | "reglas_legales";

function Asterisco() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-status-danger-fg">
      *
    </span>
  );
}

function formatearValorCargo(item: ImpuestoCargo): string {
  if (item.tipoValor === "variable" || item.valor === null) return "—";
  if (item.formatoValor === "porcentaje") return `${item.valor}%`;
  return formatearMonto(item.valor, "DOP");
}

/**
 * Parámetros legales en formato lista con selector arriba a la derecha para
 * alternar entre «Impuestos y Cargos» y «Reglas legales».
 */
export function SeccionParametros({
  impuestosCargos,
  reglasLegales,
  cuentas,
  puedeEditar,
}: {
  impuestosCargos: ImpuestoCargo[];
  reglasLegales: ReglaLegal[];
  cuentas: CuentaMovimientoOpcion[];
  puedeEditar: boolean;
}) {
  const t = useTranslations("contab.config.parametros");
  const [lista, setLista] = useState<ListaActiva>("impuestos_cargos");
  const [editandoCargo, setEditandoCargo] = useState<ImpuestoCargo | "nuevo" | null>(null);
  const [estadoCargo, setEstadoCargo] = useState<ImpuestoCargo | null>(null);
  const [editandoRegla, setEditandoRegla] = useState<ReglaLegal | "nuevo" | null>(null);
  const [estadoRegla, setEstadoRegla] = useState<ReglaLegal | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="texto-titulo-seccion">
          {lista === "impuestos_cargos" ? t("listas.impuestosCargos") : t("listas.reglasLegales")}
        </h2>

        <div className="flex shrink-0 items-center gap-2">
          <select
            aria-label={t("selectorLista")}
            className={cn(SELECT, "w-56 shrink-0")}
            value={lista}
            onChange={(e) => setLista(e.target.value as ListaActiva)}
          >
            <option value="impuestos_cargos">{t("listas.impuestosCargos")}</option>
            <option value="reglas_legales">{t("listas.reglasLegales")}</option>
          </select>

          {puedeEditar && (
            <Button
              type="button"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() =>
                lista === "impuestos_cargos"
                  ? setEditandoCargo("nuevo")
                  : setEditandoRegla("nuevo")
              }
            >
              <Plus className="size-4" />
              {lista === "impuestos_cargos" ? t("nuevoCargo") : t("nuevaRegla")}
            </Button>
          )}
        </div>
      </div>

      {lista === "impuestos_cargos" ? (
        impuestosCargos.length === 0 ? (
          <EstadoVacio icono={Scale} titulo={t("vacioCargos")} />
        ) : (
          <>
            <div className={`${TARJETA.contenido} hidden overflow-x-auto md:block`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-3">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("col.impuestoCargo")}</th>
                    <th className="px-4 py-3 font-medium">{t("col.tipoValor")}</th>
                    <th className="px-4 py-3 font-medium">{t("col.formatoValor")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("col.valor")}</th>
                    <th className="px-4 py-3 font-medium">{t("col.proposito")}</th>
                    <th className="px-4 py-3 font-medium">{t("col.cuentaContable")}</th>
                    {puedeEditar && (
                      <th className="px-4 py-3 text-right font-medium">{t("col.acciones")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {impuestosCargos.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-linea transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-tinta">{item.nombre}</span>
                          {!item.activo && (
                            <Badge className={INSIGNIA_SEMAFORO.alerta}>
                              <CircleSlash />
                              {t("estado.inactivo")}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant="neutra">{t(`tipo.${item.tipoValor}` as never)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-tinta-2">
                        {item.formatoValor ? t(`formato.${item.formatoValor}` as never) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-tinta">
                        {formatearValorCargo(item)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-tinta-2">
                        {t(`proposito.${item.proposito}` as never)}
                      </td>
                      <td className="px-4 py-3 text-tinta-2">
                        <span className="font-mono text-xs text-tinta-3">{item.cuentaCodigo}</span>{" "}
                        · {item.cuentaNombre}
                      </td>
                      {puedeEditar && (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditandoCargo(item)}
                            >
                              <Pencil className="size-3.5" />
                              {t("editar")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEstadoCargo(item)}
                            >
                              {item.activo ? (
                                <CircleSlash className="size-3.5" />
                              ) : (
                                <Power className="size-3.5" />
                              )}
                              {item.activo ? t("desactivar") : t("activar")}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {impuestosCargos.map((item) => (
                <li key={item.id} className={`${TARJETA.contenido} space-y-2.5 p-4 text-sm`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-tinta">{item.nombre}</span>
                    <Badge variant="neutra">{t(`tipo.${item.tipoValor}` as never)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-tinta-2">
                    <div>
                      <span className="text-tinta-3">{t("col.formatoValor")}: </span>
                      {item.formatoValor ? t(`formato.${item.formatoValor}` as never) : "—"}
                    </div>
                    <div className="text-right font-medium tabular-nums text-tinta">
                      {formatearValorCargo(item)}
                    </div>
                    <div>
                      <span className="text-tinta-3">{t("col.proposito")}: </span>
                      {t(`proposito.${item.proposito}` as never)}
                    </div>
                    <div className="col-span-2">
                      <span className="text-tinta-3">{t("col.cuentaContable")}: </span>
                      {`${item.cuentaCodigo} · ${item.cuentaNombre}`}
                    </div>
                  </div>
                  {puedeEditar && (
                    <div className="flex justify-end gap-2 border-t border-linea pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditandoCargo(item)}
                      >
                        <Pencil className="size-3.5" />
                        {t("editar")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEstadoCargo(item)}
                      >
                        {item.activo ? t("desactivar") : t("activar")}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )
      ) : reglasLegales.length === 0 ? (
        <EstadoVacio icono={Scale} titulo={t("vacioReglas")} />
      ) : (
        <div className={`${TARJETA.contenido} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-3">
              <tr>
                <th className="px-4 py-3 font-medium">{t("col.regla")}</th>
                <th className="px-4 py-3 font-medium">{t("col.valor")}</th>
                <th className="px-4 py-3 font-medium">{t("col.descripcion")}</th>
                <th className="px-4 py-3 font-medium">{t("col.estado")}</th>
                {puedeEditar && (
                  <th className="px-4 py-3 text-right font-medium">{t("col.acciones")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {reglasLegales.map((regla) => (
                <tr
                  key={regla.id}
                  className="border-b border-linea transition-colors last:border-b-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium text-tinta">{regla.nombre}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-tinta">
                    {regla.valor ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-tinta-2">{regla.descripcion ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge
                      className={regla.activo ? INSIGNIA_SEMAFORO.dentro : INSIGNIA_SEMAFORO.alerta}
                    >
                      {regla.activo ? <CheckCircle2 /> : <CircleSlash />}
                      {regla.activo ? t("estado.activo") : t("estado.inactivo")}
                    </Badge>
                  </td>
                  {puedeEditar && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditandoRegla(regla)}
                        >
                          <Pencil className="size-3.5" />
                          {t("editar")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEstadoRegla(regla)}
                        >
                          {regla.activo ? (
                            <CircleSlash className="size-3.5" />
                          ) : (
                            <Power className="size-3.5" />
                          )}
                          {regla.activo ? t("desactivar") : t("activar")}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editandoCargo && (
        <DialogoImpuestoCargo
          item={editandoCargo === "nuevo" ? null : editandoCargo}
          cuentas={cuentas}
          alCerrar={() => setEditandoCargo(null)}
        />
      )}

      {estadoCargo && (
        <DialogoEstadoItem
          id={estadoCargo.id}
          nombre={estadoCargo.nombre}
          activoActual={estadoCargo.activo}
          accion={cambiarEstadoImpuestoCargo}
          alCerrar={() => setEstadoCargo(null)}
        />
      )}

      {editandoRegla && (
        <DialogoReglaLegal
          regla={editandoRegla === "nuevo" ? null : editandoRegla}
          alCerrar={() => setEditandoRegla(null)}
        />
      )}

      {estadoRegla && (
        <DialogoEstadoItem
          id={estadoRegla.id}
          nombre={estadoRegla.nombre}
          activoActual={estadoRegla.activo}
          accion={cambiarEstadoReglaLegal}
          alCerrar={() => setEstadoRegla(null)}
        />
      )}
    </div>
  );
}

function DialogoImpuestoCargo({
  item,
  cuentas,
  alCerrar,
}: {
  item: ImpuestoCargo | null;
  cuentas: CuentaMovimientoOpcion[];
  alCerrar: () => void;
}) {
  const t = useTranslations("contab.config.parametros");
  const [estado, enviar, enviando] = useAccionConfig(guardarImpuestoCargo, alCerrar);
  const [tipoValor, setTipoValor] = useState<TipoValorCargo>(item?.tipoValor ?? "fijo");
  const [formatoValor, setFormatoValor] = useState<FormatoValorCargo>(
    item?.formatoValor ?? "porcentaje",
  );

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? t("dialogoEditarCargo") : t("dialogoNuevoCargo")}</DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          {item && <input type="hidden" name="id" value={item.id} />}

          <div className="space-y-1.5">
            <Label htmlFor="ic-nombre" className="text-sm font-medium">
              {t("col.impuestoCargo")}
              <Asterisco />
            </Label>
            <Input
              id="ic-nombre"
              name="nombre"
              required
              maxLength={160}
              defaultValue={item?.nombre ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ic-tipo" className="text-sm font-medium">
                {t("col.tipoValor")}
                <Asterisco />
              </Label>
              <select
                id="ic-tipo"
                name="tipo_valor"
                className={SELECT}
                required
                value={tipoValor}
                onChange={(e) => setTipoValor(e.target.value as TipoValorCargo)}
              >
                {TIPOS_VALOR_CARGO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {t(`tipo.${tipo}` as never)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ic-proposito" className="text-sm font-medium">
                {t("col.proposito")}
                <Asterisco />
              </Label>
              <select
                id="ic-proposito"
                name="proposito"
                className={SELECT}
                required
                defaultValue={item?.proposito ?? "transferencia"}
              >
                {PROPOSITOS_CARGO.map((p) => (
                  <option key={p} value={p}>
                    {t(`proposito.${p}` as never)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tipoValor === "fijo" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ic-formato" className="text-sm font-medium">
                  {t("col.formatoValor")}
                  <Asterisco />
                </Label>
                <select
                  id="ic-formato"
                  name="formato_valor"
                  className={SELECT}
                  required
                  value={formatoValor}
                  onChange={(e) => setFormatoValor(e.target.value as FormatoValorCargo)}
                >
                  {FORMATOS_VALOR_CARGO.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {t(`formato.${fmt}` as never)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ic-valor" className="text-sm font-medium">
                  {t("col.valor")} {formatoValor === "porcentaje" ? "(%)" : "(DOP)"}
                  <Asterisco />
                </Label>
                <Input
                  id="ic-valor"
                  name="valor"
                  inputMode="decimal"
                  required
                  defaultValue={item?.valor ?? ""}
                  className="tabular-nums"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ic-cuenta" className="text-sm font-medium">
              {t("col.cuentaContable")}
              <Asterisco />
            </Label>
            <select
              id="ic-cuenta"
              name="cuenta_id"
              className={SELECT}
              required
              defaultValue={item?.cuentaId ?? ""}
            >
              <option value="">{t("seleccionarCuenta")}</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.codigo} · ${c.nombre}`}
                </option>
              ))}
            </select>
          </div>

          <AvisoEstado estado={estado} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={alCerrar}>
              {t("cancelar")}
            </Button>
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

function DialogoReglaLegal({
  regla,
  alCerrar,
}: {
  regla: ReglaLegal | null;
  alCerrar: () => void;
}) {
  const t = useTranslations("contab.config.parametros");
  const [estado, enviar, enviando] = useAccionConfig(guardarReglaLegal, alCerrar);

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{regla ? t("dialogoEditarRegla") : t("dialogoNuevaRegla")}</DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          {regla && <input type="hidden" name="id" value={regla.id} />}

          <div className="space-y-1.5">
            <Label htmlFor="rl-nombre" className="text-sm font-medium">
              {t("col.regla")}
              <Asterisco />
            </Label>
            <Input
              id="rl-nombre"
              name="nombre"
              required
              maxLength={160}
              defaultValue={regla?.nombre ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rl-valor" className="text-sm font-medium">
              {t("col.valor")}
            </Label>
            <Input
              id="rl-valor"
              name="valor"
              maxLength={120}
              defaultValue={regla?.valor ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rl-desc" className="text-sm font-medium">
              {t("col.descripcion")}
            </Label>
            <Textarea
              id="rl-desc"
              name="descripcion"
              rows={3}
              maxLength={400}
              defaultValue={regla?.descripcion ?? ""}
            />
          </div>

          <AvisoEstado estado={estado} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={alCerrar}>
              {t("cancelar")}
            </Button>
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

function DialogoEstadoItem({
  id,
  nombre,
  activoActual,
  accion,
  alCerrar,
}: {
  id: string;
  nombre: string;
  activoActual: boolean;
  accion: typeof cambiarEstadoImpuestoCargo;
  alCerrar: () => void;
}) {
  const t = useTranslations("contab.config.parametros");
  const [estado, enviar, enviando] = useAccionConfig(accion, alCerrar);
  const activar = !activoActual;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {activar
              ? t("confirmarActivar", { nombre })
              : t("confirmarDesactivar", { nombre })}
          </DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="activo" value={activar ? "1" : "0"} />
          <AvisoEstado estado={estado} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={alCerrar}>
              {t("cancelar")}
            </Button>
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
