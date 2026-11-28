"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Loader2,
  Paperclip,
  Save,
  Send,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { formatearMonto } from "@/lib/contabilidad/formato";
import {
  DIAS_SEMANA_PASAJE,
  esRncOCedulaFormatoValido,
  esSolicitudDinamica,
  LUGAR_PASAJE_OTRO,
  MAXIMO_TEXTO,
  PERIODOS_PASAJE,
  SOLICITUDES_DINAMICAS,
  type DiaSemanaPasaje,
  type PeriodoPasaje,
  type TipoSolicitudDinamica,
} from "@/lib/solicitudes";
import { cn } from "@/lib/utils";
import type { ProveedorOpcion } from "@/server/contabilidad/proveedores/consultas";
import type {
  LugarPasaje,
  TipoMaterial,
} from "@/server/parametros/catalogos-consultas";
import { guardarSolicitudDinamica } from "@/server/solicitudes/acciones";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

export type CatalogosSolicitud = {
  tiposMaterial: readonly TipoMaterial[];
  proveedoresEstudiantes: readonly ProveedorOpcion[];
  lugaresPasaje: readonly LugarPasaje[];
};

const SELECT =
  "border-linea-fuerte focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-control border bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] text-tinta";

/**
 * Formulario dinámico de creación y edición de solicitudes (Etapa 1):
 * selector principal de Tipo de Solicitud (`MATERIALES`, `PASAJE`, `OTRO`)
 * con campos condicionales, validación en cliente y doble validación en servidor.
 */
export function FormularioSolicitudDinamica({
  catalogos,
  solicitud,
  tipoInicial,
  hrefLista,
  alGuardar,
}: {
  catalogos: CatalogosSolicitud;
  /** Cuando viene definida, el formulario edita esa solicitud abierta. */
  solicitud?: FilaSolicitud;
  tipoInicial?: TipoSolicitudDinamica;
  hrefLista?: string;
  alGuardar?: () => void;
}) {
  const t = useTranslations("requests");
  const td = useTranslations("requests.dinamica");
  const tn = useTranslations("listas.nuevaSolicitud");
  const avisar = useToast();
  const router = useRouter();

  const esEdicion = Boolean(solicitud);
  const tipoDefault: TipoSolicitudDinamica =
    solicitud && esSolicitudDinamica(solicitud.tipo)
      ? solicitud.tipo
      : tipoInicial ?? "MATERIALES";

  const [tipo, setTipo] = useState<TipoSolicitudDinamica>(tipoDefault);
  const [tipoMaterialId, setTipoMaterialId] = useState(solicitud?.tipo_material_id ?? "");
  const [proveedorId, setProveedorId] = useState(solicitud?.proveedor_id ?? "");
  const [monto, setMonto] = useState(
    solicitud?.monto !== null && solicitud?.monto !== undefined ? String(solicitud.monto) : "",
  );
  const [lugar, setLugar] = useState(() => {
    if (solicitud?.lugar_pasaje_otro) return LUGAR_PASAJE_OTRO;
    return solicitud?.lugar_pasaje_id ?? "";
  });
  const [motivoPasaje, setMotivoPasaje] = useState(solicitud?.motivo_pasaje ?? "");
  const [periodoPasaje, setPeriodoPasaje] = useState<PeriodoPasaje | "">(
    solicitud?.periodo_pasaje ?? "hoy",
  );
  const [diasPasaje, setDiasPasaje] = useState<DiaSemanaPasaje[]>(
    solicitud?.dias_pasaje ?? [],
  );
  const [propositoOtro, setPropositoOtro] = useState(solicitud?.proposito_otro ?? "");
  const [proveedorNombre, setProveedorNombre] = useState(solicitud?.proveedor_nombre ?? "");
  const [proveedorRnc, setProveedorRnc] = useState(solicitud?.proveedor_rnc ?? "");
  const [detalle, setDetalle] = useState(solicitud?.detalle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  // Si se edita una solicitud cuyo catálogo fue desactivado después, lo mantenemos visible como opción.
  const opcionesMaterial = useMemo(() => {
    const lista = [...catalogos.tiposMaterial];
    if (
      solicitud?.tipo_material_id &&
      solicitud.tipo_material &&
      !lista.some((m) => m.id === solicitud.tipo_material_id)
    ) {
      lista.push({
        id: solicitud.tipo_material_id,
        nombre: solicitud.tipo_material,
        activo: false,
      });
    }
    return lista;
  }, [catalogos.tiposMaterial, solicitud]);

  const opcionesLugar = useMemo(() => {
    const lista = [...catalogos.lugaresPasaje];
    if (
      solicitud?.lugar_pasaje_id &&
      solicitud.lugar_pasaje &&
      !lista.some((l) => l.id === solicitud.lugar_pasaje_id)
    ) {
      lista.push({
        id: solicitud.lugar_pasaje_id,
        nombre: solicitud.lugar_pasaje,
        monto: solicitud.monto ?? 0,
        multiplicar_por_dias: true,
        activo: false,
      });
    }
    return lista;
  }, [catalogos.lugaresPasaje, solicitud]);

  const lugarSeleccionado = useMemo(
    () => opcionesLugar.find((l) => l.id === lugar) ?? null,
    [opcionesLugar, lugar],
  );
  const esLugarOtro = lugar === LUGAR_PASAJE_OTRO;
  const rncObligatorio = tipo === "OTRO" && proveedorNombre.trim().length > 0;
  const rncConError =
    tipo === "OTRO" &&
    ((rncObligatorio && proveedorRnc.trim() === "") ||
      (proveedorRnc.trim() !== "" && !esRncOCedulaFormatoValido(proveedorRnc)));

  function toggleDia(dia: DiaSemanaPasaje) {
    setDiasPasaje((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia],
    );
    setError(null);
  }

  function validarCliente(): string | null {
    if (tipo === "MATERIALES") {
      if (!tipoMaterialId) return t("form.error.material_requerido");
      const m = Number(monto);
      if (!Number.isFinite(m) || m <= 0) return t("form.error.monto_invalido");
    } else if (tipo === "PASAJE") {
      if (!lugar) return t("form.error.lugar_requerido");
      if (esLugarOtro) {
        if (motivoPasaje.trim().length < 2) return t("form.error.motivo_requerido");
        const m = Number(monto);
        if (!Number.isFinite(m) || m <= 0) return t("form.error.monto_invalido");
      }
      if (!periodoPasaje) return t("form.error.periodo_requerido");
      if (periodoPasaje === "personalizado" && diasPasaje.length === 0) {
        return t("form.error.dias_requeridos");
      }
    } else if (tipo === "OTRO") {
      if (propositoOtro.trim().length < 2) return t("form.error.proposito_requerido");
      const m = Number(monto);
      if (!Number.isFinite(m) || m <= 0) return t("form.error.monto_invalido");
      if (proveedorNombre.trim().length > 0) {
        if (!proveedorRnc.trim()) return t("form.error.rnc_requerido");
        if (!esRncOCedulaFormatoValido(proveedorRnc)) return t("form.error.rnc_invalido");
      } else if (proveedorRnc.trim() && !esRncOCedulaFormatoValido(proveedorRnc)) {
        return t("form.error.rnc_invalido");
      }
    }
    return null;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errCliente = validarCliente();
    if (errCliente) {
      setError(errCliente);
      return;
    }

    const datos = new FormData(e.currentTarget);
    datos.set("tipo", tipo);
    if (solicitud?.id) datos.set("id", solicitud.id);

    if (tipo === "PASAJE") {
      datos.delete("dias_pasaje");
      if (periodoPasaje === "personalizado") {
        for (const d of diasPasaje) datos.append("dias_pasaje", d);
      }
      if (!esLugarOtro && lugarSeleccionado) {
        datos.set("monto", String(lugarSeleccionado.monto));
      }
    }

    setError(null);
    iniciar(async () => {
      const res = await guardarSolicitudDinamica({ estado: "inicial" }, datos);
      if (res.estado !== "ok") {
        setError(t(`form.error.${res.estado}` as never));
        return;
      }

      avisar({
        titulo: esEdicion ? td("actualizada") : tn("creada"),
        accion:
          !esEdicion && hrefLista && res.id
            ? { etiqueta: tn("ver"), href: `${hrefLista}?nuevo=${res.id}` }
            : undefined,
      });

      if (!esEdicion) {
        setTipoMaterialId("");
        setProveedorId("");
        setMonto("");
        setLugar("");
        setMotivoPasaje("");
        setPeriodoPasaje("hoy");
        setDiasPasaje([]);
        setPropositoOtro("");
        setProveedorNombre("");
        setProveedorRnc("");
        setDetalle("");
      }

      alGuardar?.();
      if (!esEdicion && hrefLista && res.id) router.replace(`${hrefLista}?nuevo=${res.id}`);
      else router.refresh();
    });
  }

  const controlAlineado = "h-9 px-3 py-0 text-sm";

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-sm">
      {solicitud?.id && <input type="hidden" name="id" value={solicitud.id} />}

      {/* Selector principal de Tipo de Solicitud */}
      <div className="space-y-1.5">
        <Label htmlFor="sol-tipo" className="text-xs font-medium text-tinta-2">
          {td("tipoSolicitud")}
          <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
        </Label>
        <select
          id="sol-tipo"
          name="tipo"
          required
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoSolicitudDinamica);
            setError(null);
          }}
          className={SELECT}
        >
          {SOLICITUDES_DINAMICAS.map((opcion) => (
            <option key={opcion} value={opcion}>
              {t(`type.${opcion}` as never)}
            </option>
          ))}
        </select>
      </div>

      {/* TIPO 1: MATERIALES */}
      {tipo === "MATERIALES" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sol-material" className="text-xs font-medium text-tinta-2">
              {td("tipoMaterial")}
              <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
            </Label>
            <select
              id="sol-material"
              name="tipo_material_id"
              required
              value={tipoMaterialId}
              onChange={(e) => {
                setTipoMaterialId(e.target.value);
                setError(null);
              }}
              className={SELECT}
            >
              <option value="">{td("seleccionarMaterial")}</option>
              {opcionesMaterial.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            {opcionesMaterial.length === 0 && (
              <p className="texto-meta">{td("sinMaterialesCatalogo")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-prov-est" className="text-xs font-medium text-tinta-2">
              {td("proveedorOpcional")}
            </Label>
            <select
              id="sol-prov-est"
              name="proveedor_id"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              className={SELECT}
            >
              <option value="">{td("sinProveedor")}</option>
              {catalogos.proveedoresEstudiantes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-monto-mat" className="text-xs font-medium text-tinta-2">
              {td("montoSolicitado")}
              <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
            </Label>
            <Input
              id="sol-monto-mat"
              name="monto"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={cn(controlAlineado, "font-mono tabular-nums")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-cot-mat" className="flex items-center gap-1.5 text-xs font-medium text-tinta-2">
              <Paperclip className="size-3.5" />
              {td("cotizacionOpcional")}
            </Label>
            <Input
              id="sol-cot-mat"
              name="cotizacion"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="h-9 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium"
            />
            {solicitud?.cotizacion && (
              <p className="texto-meta">
                {td("cotizacionActual", { nombre: solicitud.cotizacion.nombre })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* TIPO 2: PASAJE */}
      {tipo === "PASAJE" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sol-lugar" className="text-xs font-medium text-tinta-2">
              {td("lugar")}
              <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
            </Label>
            <select
              id="sol-lugar"
              name="lugar"
              required
              value={lugar}
              onChange={(e) => {
                const val = e.target.value;
                setLugar(val);
                if (val !== LUGAR_PASAJE_OTRO) {
                  setMotivoPasaje("");
                  const encontrado = opcionesLugar.find((l) => l.id === val);
                  setMonto(encontrado ? String(encontrado.monto) : "");
                } else {
                  setMonto("");
                }
                setError(null);
              }}
              className={SELECT}
            >
              <option value="">{td("seleccionarLugar")}</option>
              {opcionesLugar.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
              <option value={LUGAR_PASAJE_OTRO}>{td("lugarOtro")}</option>
            </select>
          </div>

          {lugarSeleccionado && !esLugarOtro && (
            <div className="space-y-1.5">
              <Label htmlFor="sol-monto-auto" className="text-xs font-medium text-tinta-2">
                {td("monto")}
              </Label>
              <Input
                id="sol-monto-auto"
                readOnly
                tabIndex={-1}
                value={formatearMonto(lugarSeleccionado.monto.toFixed(2), "DOP")}
                className={cn(controlAlineado, "bg-muted/40 font-mono tabular-nums text-tinta-2")}
              />
            </div>
          )}

          {esLugarOtro && (
            <div className="grid grid-cols-1 gap-3 rounded-control border border-linea bg-muted/30 p-3.5 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sol-motivo" className="text-xs font-medium text-tinta-2">
                  {td("motivo")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="sol-motivo"
                  name="motivo_pasaje"
                  required
                  minLength={2}
                  maxLength={300}
                  value={motivoPasaje}
                  onChange={(e) => setMotivoPasaje(e.target.value)}
                  className={controlAlineado}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sol-monto-pas" className="text-xs font-medium text-tinta-2">
                  {td("montoDop")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Input
                  id="sol-monto-pas"
                  name="monto"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={cn(controlAlineado, "font-mono tabular-nums")}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sol-periodo" className="text-xs font-medium text-tinta-2">
              {td("periodo")}
              <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
            </Label>
            <select
              id="sol-periodo"
              name="periodo_pasaje"
              required
              value={periodoPasaje}
              onChange={(e) => {
                const val = e.target.value as PeriodoPasaje;
                setPeriodoPasaje(val);
                if (val !== "personalizado") setDiasPasaje([]);
                setError(null);
              }}
              className={SELECT}
            >
              {PERIODOS_PASAJE.map((p) => (
                <option key={p} value={p}>
                  {td(`periodos.${p}` as never)}
                </option>
              ))}
            </select>
          </div>

          {periodoPasaje === "personalizado" && (
            <fieldset className="space-y-2 rounded-control border border-linea bg-muted/30 p-3.5">
              <legend className="text-xs font-medium text-tinta-2">
                {td("diasSemana")}
                <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DIAS_SEMANA_PASAJE.map((dia) => {
                  const activo = diasPasaje.includes(dia);
                  return (
                    <label
                      key={dia}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-control border px-2.5 py-2 text-xs font-medium transition-colors",
                        activo
                          ? "border-marca-500 bg-marca-50 text-marca-800"
                          : "border-linea bg-background text-tinta-2 hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => toggleDia(dia)}
                        className="size-3.5 accent-marca-600"
                      />
                      <span>{td(`dias.${dia}` as never)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      )}

      {/* TIPO 3: OTRO */}
      {tipo === "OTRO" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sol-proposito" className="text-xs font-medium text-tinta-2">
              {td("proposito")}
              <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
            </Label>
            <Input
              id="sol-proposito"
              name="proposito_otro"
              required
              minLength={2}
              maxLength={300}
              value={propositoOtro}
              onChange={(e) => setPropositoOtro(e.target.value)}
              className={controlAlineado}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-monto-otro" className="text-xs font-medium text-tinta-2">
              {td("montoDop")}
              <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
            </Label>
            <Input
              id="sol-monto-otro"
              name="monto"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={cn(controlAlineado, "font-mono tabular-nums")}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sol-prov-txt" className="text-xs font-medium text-tinta-2">
                {td("proveedorEditable")}
              </Label>
              <Input
                id="sol-prov-txt"
                name="proveedor_nombre"
                maxLength={160}
                value={proveedorNombre}
                onChange={(e) => {
                  setProveedorNombre(e.target.value);
                  setError(null);
                }}
                className={controlAlineado}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sol-rnc" className="text-xs font-medium text-tinta-2">
                {td("rncProveedor")}
                {rncObligatorio && (
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                )}
              </Label>
              <Input
                id="sol-rnc"
                name="proveedor_rnc"
                inputMode="numeric"
                required={rncObligatorio}
                maxLength={15}
                value={proveedorRnc}
                onChange={(e) => {
                  setProveedorRnc(e.target.value);
                  setError(null);
                }}
                aria-invalid={rncConError || undefined}
                className={cn(
                  controlAlineado,
                  "font-mono tabular-nums",
                  rncConError && "border-status-danger-border",
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-cot-otro" className="flex items-center gap-1.5 text-xs font-medium text-tinta-2">
              <Paperclip className="size-3.5" />
              {td("cotizacionOpcional")}
            </Label>
            <Input
              id="sol-cot-otro"
              name="cotizacion"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="h-9 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium"
            />
            {solicitud?.cotizacion && (
              <p className="texto-meta">
                {td("cotizacionActual", { nombre: solicitud.cotizacion.nombre })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Observaciones opcionales */}
      <div className="space-y-1.5">
        <Label htmlFor="sol-detalle" className="text-xs font-medium text-tinta-2">
          {t("form.detail")}
        </Label>
        <Textarea
          id="sol-detalle"
          name="detalle"
          rows={2}
          maxLength={MAXIMO_TEXTO}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
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

      <div className="flex items-center justify-end gap-2 border-t border-linea pt-4">
        <Button type="submit" cargando={enviando} disabled={enviando}>
          {enviando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : esEdicion ? (
            <Save className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
          {enviando
            ? t("form.sending")
            : esEdicion
              ? td("guardarCambios")
              : t("form.submit")}
        </Button>
      </div>
    </form>
  );
}
