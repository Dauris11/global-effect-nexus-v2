"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AvisoError, AvisoOk, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { AccionesFormulario, FormularioGuiado, PasoFormulario } from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectBuscable } from "@/components/ui/select-buscable";
import { Textarea } from "@/components/ui/textarea";
import { TooltipAyuda } from "@/components/ui/tooltip-ayuda";
import { Link, useRouter } from "@/i18n/navigation";
import { BANCOS_RD } from "@/lib/contabilidad/bancos-rd";
import {
  formatearMonto,
  MONEDAS,
  montoValido,
  restarMontos,
  sumarMontos,
} from "@/lib/contabilidad/formato";
import { limpiarIdentificacion, ncfValido, rncOCedulaValida } from "@/lib/contabilidad/identificacion";
import { PROGRAMAS_INSTITUCIONALES } from "@/lib/contabilidad/programas";
import {
  calcularItbis,
  calcularMontoRetencion,
  retencionesParaProveedor,
} from "@/lib/contabilidad/retenciones-dgii";
import { PILARES_COSTO } from "@/lib/costos";
import { cn } from "@/lib/utils";
import {
  agregarCuentaProveedor,
  consultarRncProveedorAction,
  guardarFactura,
  guardarProveedor,
  type EstadoProveedor,
} from "@/server/contabilidad/proveedores/acciones";
import type { DetalleFactura, DetalleProveedor, UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";
import type { Opcion } from "@/server/contabilidad/recibos/consultas";


const INICIAL: EstadoProveedor = { estado: "inicial" };

function useError(estado: EstadoProveedor): string | null {
  const t = useTranslations("contab");
  return estado.estado === "inicial" || estado.estado === "ok"
    ? null
    : t(`error.${estado.estado}` as never, { codigo: estado.codigo ?? "" } as never);
}

/** Tras guardar, a la ficha que corresponde. */
function useIrA(estado: EstadoProveedor, destino: (id: string) => string) {
  const router = useRouter();
  useEffect(() => {
    if (estado.estado === "ok" && estado.id) router.push(destino(estado.id));
  }, [estado, router, destino]);
}

function Campo({
  id,
  etiqueta,
  obligatorio,
  tooltip,
  etiquetaTooltip,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  obligatorio?: boolean;
  tooltip?: string | string[];
  etiquetaTooltip?: string;
  ayuda?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {etiqueta}
          {obligatorio && (
            <span aria-hidden className="ml-0.5 text-status-danger-fg">
              *
            </span>
          )}
        </Label>
        {tooltip && <TooltipAyuda texto={tooltip} etiqueta={etiquetaTooltip ?? etiqueta} />}
      </div>
      {children}
      {ayuda && <div className="texto-meta">{ayuda}</div>}
    </div>
  );
}

const fichaProveedor = (id: string) => `/contabilidad/proveedores/${id}`;
const listaProveedores = () => "/contabilidad/proveedores";
const fichaFactura = (id: string) => `/contabilidad/facturas/${id}`;

export function FormularioProveedor({
  proveedor,
}: {
  proveedor?: DetalleProveedor;
}) {
  const t = useTranslations("contab.proveedorForm");
  const tc = useTranslations("contab");
  const [estado, enviar, enviando] = useActionState(guardarProveedor, INICIAL);
  const [tipo, setTipo] = useState<"fisica" | "juridica">(proveedor?.tipo ?? "juridica");
  const [identificacion, setIdentificacion] = useState(proveedor?.identificacion ?? "");
  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [nombreComercial, setNombreComercial] = useState(proveedor?.nombre_comercial ?? "");
  const [actividadEconomica, setActividadEconomica] = useState(proveedor?.actividad_economica ?? "");
  const [administracionLocal, setAdministracionLocal] = useState(proveedor?.administracion_local ?? "");
  const [consultandoRnc, setConsultandoRnc] = useState(false);
  const [errorRnc, setErrorRnc] = useState<string | null>(null);
  const error = useError(estado);
  useIrA(estado, proveedor ? fichaProveedor : listaProveedores);

  const esJuridica = tipo === "juridica";
  const limpia = limpiarIdentificacion(identificacion);
  const completa = limpia.length === 9 || limpia.length === 11;
  const malDigito = completa && !rncOCedulaValida(limpia);
  const puedeConsultarDgii = /^[0-9]{9}$|^[0-9]{11}$/.test(limpia);
  const etiquetaInfo = t("masInformacion");

  async function onConsultarDgii() {
    setErrorRnc(null);
    const entrada = limpiarIdentificacion(identificacion.trim());
    if (!/^[0-9]{9}$|^[0-9]{11}$/.test(entrada)) {
      setErrorRnc(t("rncError.formato_invalido"));
      return;
    }

    setConsultandoRnc(true);
    try {
      const res = await consultarRncProveedorAction(entrada);
      if (res.ok) {
        if (res.datos.nombreRazonSocial) setNombre(res.datos.nombreRazonSocial);
        setNombreComercial(res.datos.nombreComercial);
        setActividadEconomica(res.datos.actividadEconomica);
        setAdministracionLocal(res.datos.administracionLocal);
      } else {
        setErrorRnc(t(`rncError.${res.error}` as never));
      }
    } catch {
      setErrorRnc(t("rncError.servicio_no_disponible"));
    } finally {
      setConsultandoRnc(false);
    }
  }

  return (
    <form action={enviar} className="space-y-5">
      {proveedor && <input type="hidden" name="id" value={proveedor.id} />}
      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.identificacion")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo
              id="tipo"
              etiqueta={t("tipo")}
              tooltip={t("tipoAyuda")}
              etiquetaTooltip={etiquetaInfo}
            >
              <select
                id="tipo"
                name="tipo"
                className={SELECT}
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as "fisica" | "juridica");
                  if (errorRnc) setErrorRnc(null);
                }}
              >
                <option value="juridica">{tc("tipoProveedor.juridica")}</option>
                <option value="fisica">{tc("tipoProveedor.fisica")}</option>
              </select>
            </Campo>
            <Campo
              id="identificacion"
              etiqueta={t("identificacion")}
              obligatorio
              tooltip={esJuridica ? t("identificacionAyudaJuridica") : t("identificacionAyudaFisica")}
              etiquetaTooltip={etiquetaInfo}
              ayuda={malDigito ? tc("error.identificacion_invalida") : undefined}
            >
              <div className="flex gap-2">
                <Input
                  id="identificacion"
                  name="identificacion"
                  inputMode="numeric"
                  required
                  value={identificacion}
                  onChange={(e) => {
                    setIdentificacion(e.target.value);
                    if (errorRnc) setErrorRnc(null);
                  }}
                  aria-invalid={malDigito || undefined}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onConsultarDgii}
                  disabled={consultandoRnc || !puedeConsultarDgii}
                  className="shrink-0"
                >
                  {consultandoRnc ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  {consultandoRnc ? t("consultandoDgii") : t("consultarDgii")}
                </Button>
              </div>
            </Campo>
            {errorRnc && (
              <div className="md:col-span-2">
                <AvisoError>{errorRnc}</AvisoError>
              </div>
            )}
            <Campo
              id="nombre"
              etiqueta={t("nombre")}
              obligatorio
              tooltip={t("nombreAyuda")}
              etiquetaTooltip={etiquetaInfo}
            >
              <Input
                id="nombre"
                name="nombre"
                required
                maxLength={160}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </Campo>
            <Campo
              id="nombre_comercial"
              etiqueta={t("nombreComercial")}
              tooltip={t("nombreComercialAyuda")}
              etiquetaTooltip={etiquetaInfo}
            >
              <Input
                id="nombre_comercial"
                name="nombre_comercial"
                maxLength={160}
                value={nombreComercial}
                onChange={(e) => setNombreComercial(e.target.value)}
              />
            </Campo>
            <Campo
              id="actividad_economica"
              etiqueta={t("actividadEconomica")}
              obligatorio
              tooltip={t("actividadEconomicaAyuda")}
              etiquetaTooltip={etiquetaInfo}
            >
              <Input
                id="actividad_economica"
                name="actividad_economica"
                required
                maxLength={300}
                value={actividadEconomica}
                onChange={(e) => setActividadEconomica(e.target.value)}
              />
            </Campo>
            <Campo
              id="administracion_local"
              etiqueta={t("administracionLocal")}
              tooltip={t("administracionLocalAyuda")}
              etiquetaTooltip={etiquetaInfo}
            >
              <Input
                id="administracion_local"
                name="administracion_local"
                maxLength={160}
                value={administracionLocal}
                onChange={(e) => setAdministracionLocal(e.target.value)}
              />
            </Campo>
          </div>
        </PasoFormulario>
        <PasoFormulario titulo={t("pasos.contacto")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo id="contacto" etiqueta={t("contacto")}>
              <Input id="contacto" name="contacto" maxLength={120} defaultValue={proveedor?.contacto ?? ""} />
            </Campo>
            <Campo id="telefono" etiqueta={t("telefono")}>
              <Input id="telefono" name="telefono" type="tel" maxLength={40} defaultValue={proveedor?.telefono ?? ""} />
            </Campo>
            <Campo id="email" etiqueta={t("email")}>
              <Input id="email" name="email" type="email" maxLength={120} defaultValue={proveedor?.email ?? ""} />
            </Campo>
            <Campo
              id="proposito"
              etiqueta={t("proposito")}
              obligatorio
            >
              <select
                id="proposito"
                name="proposito"
                className={SELECT}
                required
                defaultValue={proveedor?.proposito ?? ""}
              >
                <option value="" disabled>{t("seleccionarProposito")}</option>
                <option value="gasto">{tc("propositoProveedor.gasto")}</option>
                <option value="estudiantes">{tc("propositoProveedor.estudiantes")}</option>
              </select>
            </Campo>
          </div>
          <Campo
            id="direccion"
            etiqueta={t("direccion")}
            obligatorio
            tooltip={t("direccionAyuda")}
            etiquetaTooltip={etiquetaInfo}
          >
            <Textarea id="direccion" name="direccion" rows={2} required maxLength={300} defaultValue={proveedor?.direccion ?? ""} />
          </Campo>
        </PasoFormulario>
        <PasoFormulario titulo={t("pasos.condiciones")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo
              id="condiciones"
              etiqueta={t("condiciones")}
              obligatorio
              tooltip={t("condicionesAyuda")}
              etiquetaTooltip={etiquetaInfo}
            >
              <Input id="condiciones" name="condiciones" type="number" required min={0} max={365} defaultValue={proveedor?.condiciones_pago_dias ?? 30} />
            </Campo>
            <Campo
              id="estado"
              etiqueta={t("estado")}
              obligatorio
              tooltip={t("estadoAyuda")}
              etiquetaTooltip={etiquetaInfo}
            >
              <select id="estado" name="estado" className={SELECT} required defaultValue={proveedor?.estado ?? "activo"}>
                <option value="activo">{tc("estadoProveedor.activo")}</option>
                <option value="inactivo">{tc("estadoProveedor.inactivo")}</option>
              </select>
            </Campo>
          </div>
        </PasoFormulario>
        {error && <AvisoError>{error}</AvisoError>}
        <AccionesFormulario>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" cargando={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("guardar")}
            </Button>
            <Button asChild variant="ghost">
              <Link href={proveedor ? fichaProveedor(proveedor.id) : "/contabilidad/proveedores"}>{t("cancelar")}</Link>
            </Button>
          </div>
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}

const OPCIONES_BANCOS_RD = BANCOS_RD.map((b) => ({ value: b, label: b }));

export function FormularioCuentaProveedor({
  proveedorId,
  identificacionProveedor,
}: {
  proveedorId: string;
  identificacionProveedor?: string;
}) {
  const t = useTranslations("contab.proveedor");
  const tc = useTranslations("contab");
  const [estado, enviar, enviando] = useActionState(agregarCuentaProveedor, INICIAL);
  const [banco, setBanco] = useState("");
  const error = useError(estado);

  const selectAlineado = cn(SELECT, "h-[38px] pointer-coarse:h-11 text-sm");

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="proveedor" value={proveedorId} />
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Campo id="banco" etiqueta={t("banco")} obligatorio>
          <SelectBuscable
            id="banco"
            name="banco"
            required
            opciones={OPCIONES_BANCOS_RD}
            value={banco}
            onChange={setBanco}
            placeholder={t("seleccionarBanco")}
            placeholderBuscar={t("buscarBanco")}
            sinResultados={t("sinBancos")}
          />
        </Campo>
        <Campo id="tipo_cuenta" etiqueta={t("tipoCuenta")} obligatorio>
          <select id="tipo_cuenta" name="tipo" className={selectAlineado} defaultValue="ahorro">
            <option value="ahorro">{tc("tipoCuenta.ahorro")}</option>
            <option value="corriente">{tc("tipoCuenta.corriente")}</option>
          </select>
        </Campo>
        <Campo id="moneda_cuenta" etiqueta={t("moneda")} obligatorio>
          <select id="moneda_cuenta" name="moneda" className={selectAlineado}>
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo id="numero" etiqueta={t("numero")} obligatorio>
          <Input id="numero" name="numero" required inputMode="numeric" maxLength={40} className="font-mono text-sm" />
        </Campo>
        <Campo id="identificacion_cuenta" etiqueta={t("rncCedula")} obligatorio>
          <Input
            id="identificacion_cuenta"
            name="identificacion"
            required
            inputMode="numeric"
            maxLength={20}
            defaultValue={identificacionProveedor ?? ""}
            className="font-mono text-sm"
          />
        </Campo>
      </div>
      {error && <AvisoError>{error}</AvisoError>}
      {estado.estado === "ok" && <AvisoOk>{tc("cxp.ok")}</AvisoOk>}
      <Button type="submit" variant="secondary" cargando={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t("guardarCuenta")}
      </Button>
    </form>
  );
}

/**
 * Factura de proveedor. El tipo de gasto enlaza directamente con las cuentas
 * contables marcadas con «Agregar a Facturas» (mostrando solo su nombre), el
 * check «Exento de ITBIS» controla si se suma 18% de ITBIS al total, las
 * retenciones se eligen en listas simples con cálculo automático en centavos
 * exactos y las asignaciones opcionales se muestran bajo demanda.
 */
export function FormularioFactura({
  proveedores,
  proveedorId,
  factura,
  tiposGasto,
  fondos,
  proyectos,
  solicitantes = [],
  estudiantes = [],
  hoy,
  solicitudId,
  ncfOpcional = false,
  valoresIniciales,
  enModal = false,
  puedeAprobar = false,
  alGuardar,
  alCancelar,
}: {
  proveedores: (Opcion & { tipo: "fisica" | "juridica"; dias: number; identificacion?: string })[];
  proveedorId?: string;
  factura?: DetalleFactura;
  tiposGasto: Opcion[];
  fondos: Opcion[];
  proyectos: Opcion[];
  solicitantes?: UsuarioSolicitante[];
  /** Becados a quienes se puede imputar el gasto (costo por estudiante). */
  estudiantes?: Opcion[];
  hoy: string;
  /** Solicitud de Materiales que origina esta factura (Etapa 2). */
  solicitudId?: string;
  /** Permite guardar el borrador sin NCF / e-CF (se exige al aprobar). */
  ncfOpcional?: boolean;
  /** Valores sugeridos para el primer guardado desde una solicitud. */
  valoresIniciales?: {
    subtotal?: string;
    concepto?: string;
    moneda?: "DOP" | "USD";
    solicitanteId?: string | null;
    estudianteId?: string | null;
  };
  /** En modal no navega al proveedor: refresca y llama `alGuardar`. */
  enModal?: boolean;
  /** Habilita el botón «Aprobar» al editar un borrador con NCF / e-CF válido. */
  puedeAprobar?: boolean;
  alGuardar?: () => void;
  alCancelar?: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("contab.facturaForm");
  const tc = useTranslations("contab");
  const [estado, enviar, enviando] = useActionState(guardarFactura, INICIAL);
  const error = useError(estado);

  const [proveedor, setProveedor] = useState(factura?.proveedor_id ?? proveedorId ?? proveedores[0]?.id ?? "");
  const datosProveedor = proveedores.find((p) => p.id === proveedor);
  const [moneda, setMoneda] = useState<string>(factura?.moneda ?? valoresIniciales?.moneda ?? "DOP");
  const [emision, setEmision] = useState(factura?.fecha_emision ?? hoy);
  const [monto, setMonto] = useState(factura?.subtotal ?? valoresIniciales?.subtotal ?? "");
  const [exentoItbis, setExentoItbis] = useState(
    factura ? Number(factura.itbis) === 0 : true,
  );
  const [itbis, setItbis] = useState(
    factura ? Number(factura.itbis).toFixed(2) : "0.00",
  );
  const [tipoRetencionIsr, setTipoRetencionIsr] = useState(factura?.tipo_retencion_isr ?? "");
  const [tipoRetencionItbis, setTipoRetencionItbis] = useState(factura?.tipo_retencion_itbis ?? "");
  const [ncf, setNcf] = useState(factura?.ncf ?? "");
  const [concepto, setConcepto] = useState(factura?.concepto ?? valoresIniciales?.concepto ?? "");
  const [cuentaGastoId, setCuentaGastoId] = useState(factura?.cuenta_gasto_id ?? "");
  const solicitanteInicial = factura?.solicitante_id ?? valoresIniciales?.solicitanteId ?? "";
  const estudianteInicial = factura?.estudiante_id ?? valoresIniciales?.estudianteId ?? "";
  const [incluirAsignaciones, setIncluirAsignaciones] = useState(
    Boolean(
      solicitanteInicial ||
        factura?.programa_codigo ||
        factura?.proyecto_id ||
        estudianteInicial,
    ),
  );
  const [fondo, setFondo] = useState(factura?.fondo_id ?? fondos[0]?.id ?? "");
  const [proyecto, setProyecto] = useState(factura?.proyecto_id ?? "");
  const [solicitante, setSolicitante] = useState(solicitanteInicial);
  const [programa, setPrograma] = useState(factura?.programa_codigo ?? "");
  const [estudiante, setEstudiante] = useState(estudianteInicial);

  // Tras guardar la factura: en modal cierra y refresca; en página navega al proveedor.
  useEffect(() => {
    if (estado.estado === "ok") {
      if (enModal) {
        router.refresh();
        alGuardar?.();
      } else {
        const destino = estado.proveedorId ?? proveedor;
        router.push(destino ? fichaProveedor(destino) : "/contabilidad/proveedores");
      }
    }
  }, [estado, proveedor, router, enModal, alGuardar]);

  function manejarCambioMonto(nuevoMonto: string) {
    setMonto(nuevoMonto);
    if (!exentoItbis) {
      setItbis(calcularItbis(montoValido(nuevoMonto) ?? "0"));
    }
  }

  function manejarCambioExento(marcado: boolean) {
    setExentoItbis(marcado);
    if (marcado) {
      setItbis("0.00");
    } else {
      setItbis(calcularItbis(montoValido(monto) ?? "0"));
    }
  }

  function manejarCambioItbis(nuevoItbis: string) {
    setItbis(nuevoItbis);
    const limpio = nuevoItbis.replace(/,/g, "").trim();
    if (exentoItbis && /^\d+(?:\.\d{1,2})?$/.test(limpio) && Number(limpio) > 0) {
      setExentoItbis(false);
    }
  }

  // Vencimiento sugerido = emisión + días de crédito del proveedor.
  const sugerido = (() => {
    const d = new Date(`${emision}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return emision;
    d.setUTCDate(d.getUTCDate() + (datosProveedor?.dias ?? 30));
    return d.toISOString().slice(0, 10);
  })();

  const opcionesIsr = retencionesParaProveedor("isr", datosProveedor?.tipo);
  const opcionesItbis = retencionesParaProveedor("itbis", datosProveedor?.tipo);
  const opcionesGasto = tiposGasto.map((g) => ({ value: g.id, label: g.nombre }));

  const base = montoValido(monto) ?? "0";
  const itbisLimpio = itbis.replace(/,/g, "").trim();
  const itbisAplicado = exentoItbis
    ? "0.00"
    : /^\d+(?:\.\d{1,2})?$/.test(itbisLimpio)
      ? Number(itbisLimpio).toFixed(2)
      : "0.00";
  const totalFactura = sumarMontos([base, itbisAplicado]);
  const retencionIsr = calcularMontoRetencion(base, tipoRetencionIsr);
  const retencionItbis = calcularMontoRetencion(base, tipoRetencionItbis);
  const totalRetenciones = sumarMontos([retencionIsr, retencionItbis]);
  const neto = restarMontos(totalFactura, totalRetenciones);
  const monedaVista = moneda === "USD" ? "USD" : "DOP";

  const mostrarBotonAprobar = puedeAprobar && Boolean(factura && factura.estado === "borrador");
  const ncfLimpio = ncf.trim().toUpperCase();
  const ncfCompletoYValido = ncfLimpio.length > 0 && ncfValido(ncfLimpio);

  return (
    <div className="space-y-6">
      <form action={enviar} className="space-y-5">
        {factura && <input type="hidden" name="id" value={factura.id} />}
        {solicitudId && <input type="hidden" name="solicitud_id" value={solicitudId} />}
        <input type="hidden" name="exento_itbis" value={exentoItbis ? "1" : "0"} />
        {!incluirAsignaciones && <input type="hidden" name="fondo" value={fondo} />}

        <div className="space-y-4">
          {/* Fila 1: Proveedor + RNC automático + NCF o e-CF */}
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-6">
              <Campo id="proveedor" etiqueta={t("proveedor")}>
                <select
                  id="proveedor"
                  name="proveedor"
                  className={SELECT}
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  required
                >
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({tc(`tipoProveedor.${p.tipo}` as never)})
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <div className="md:col-span-3">
              <Campo id="rnc_proveedor" etiqueta={t("rnc")}>
                <Input
                  id="rnc_proveedor"
                  value={datosProveedor?.identificacion ?? ""}
                  readOnly
                  tabIndex={-1}
                  className="bg-muted/40 font-mono text-tinta-2"
                />
              </Campo>
            </div>
            <div className="md:col-span-3">
              <Campo
                id="ncf"
                etiqueta={t("ncf")}
                obligatorio={!ncfOpcional}
                ayuda={
                  ncfOpcional
                    ? mostrarBotonAprobar && !ncfCompletoYValido
                      ? t("ncfParaAprobarAyuda")
                      : !factura
                        ? t("ncfOpcionalAyuda")
                        : undefined
                    : undefined
                }
              >
                <Input
                  id="ncf"
                  name="ncf"
                  required={!ncfOpcional}
                  maxLength={13}
                  value={ncf}
                  onChange={(e) => setNcf(e.target.value.toUpperCase())}
                  className="uppercase font-mono"
                />
              </Campo>
            </div>
          </div>

          {/* Fila 2: Tipo de gasto con buscador | Fecha de emisión */}
          <div className="grid gap-4 md:grid-cols-2">
            <Campo
              id="cuenta_gasto_id"
              etiqueta={t("tipoGasto")}
              obligatorio
              ayuda={tiposGasto.length === 0 ? t("sinTiposGasto") : undefined}
            >
              <SelectBuscable
                id="cuenta_gasto_id"
                name="cuenta_gasto_id"
                required
                opciones={opcionesGasto}
                value={cuentaGastoId}
                onChange={setCuentaGastoId}
                placeholder={t("seleccionarTipoGasto")}
                placeholderBuscar={t("buscarTipoGasto")}
                sinResultados={t("sinTiposGastoBusqueda")}
              />
            </Campo>
            <Campo id="fecha_emision" etiqueta={t("emision")} obligatorio>
              <Input
                id="fecha_emision"
                name="fecha_emision"
                type="date"
                required
                value={emision}
                onChange={(e) => setEmision(e.target.value)}
              />
            </Campo>
          </div>

          {/* Fila 3: Concepto (izquierda) | Fecha de vencimiento (debajo de Fecha de emisión) */}
          <div className="grid gap-4 md:grid-cols-2">
            <Campo id="concepto" etiqueta={t("concepto")} obligatorio>
              <Input
                id="concepto"
                name="concepto"
                required
                maxLength={200}
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
              />
            </Campo>
            <Campo id="fecha_vencimiento" etiqueta={t("vencimiento")}>
              <Input
                key={sugerido}
                id="fecha_vencimiento"
                name="fecha_vencimiento"
                type="date"
                required
                defaultValue={factura?.fecha_vencimiento ?? sugerido}
              />
            </Campo>
          </div>

          {/* Fila 4: Monto | ITBIS editable | Moneda */}
          <div className="grid items-end gap-4 md:grid-cols-3">
            <Campo id="subtotal" etiqueta={t("monto")} obligatorio>
              <Input
                id="subtotal"
                name="subtotal"
                inputMode="decimal"
                required
                value={monto}
                onChange={(e) => manejarCambioMonto(e.target.value)}
                className="tabular-nums"
              />
            </Campo>
            <Campo id="itbis" etiqueta={t("itbis")}>
              <Input
                id="itbis"
                name="itbis"
                inputMode="decimal"
                value={itbis}
                onChange={(e) => manejarCambioItbis(e.target.value)}
                className="tabular-nums"
              />
            </Campo>
            <Campo id="moneda" etiqueta={t("moneda")} obligatorio>
              <select
                id="moneda"
                name="moneda"
                className={cn(SELECT, "h-[38px] pointer-coarse:h-11 text-sm")}
                required
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {moneda === "USD" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="tasa" etiqueta={t("tasa")} obligatorio>
                <Input
                  id="tasa"
                  name="tasa"
                  inputMode="decimal"
                  required
                  defaultValue={factura?.tasa ?? ""}
                />
              </Campo>
            </div>
          )}

          {/* Fila 5: Retenciones (debajo de Monto y Moneda) + Check «Exento de ITBIS» al lado */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <Campo id="tipo_retencion_isr" etiqueta={t("retencionIsr")}>
              <select
                id="tipo_retencion_isr"
                name="tipo_retencion_isr"
                className={SELECT}
                value={tipoRetencionIsr}
                onChange={(e) => setTipoRetencionIsr(e.target.value)}
              >
                <option value="">{t("sinRetencion")}</option>
                {opcionesIsr.map((r) => (
                  <option key={r.codigo} value={r.codigo}>
                    {r.etiquetaTasa} — {locale === "en" ? r.nombre.en : r.nombre.es}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="tipo_retencion_itbis" etiqueta={t("retencionItbis")}>
              <select
                id="tipo_retencion_itbis"
                name="tipo_retencion_itbis"
                className={SELECT}
                value={tipoRetencionItbis}
                onChange={(e) => setTipoRetencionItbis(e.target.value)}
              >
                <option value="">{t("sinRetencion")}</option>
                {opcionesItbis.map((r) => (
                  <option key={r.codigo} value={r.codigo}>
                    {r.etiquetaTasa} — {locale === "en" ? r.nombre.en : r.nombre.es}
                  </option>
                ))}
              </select>
            </Campo>

            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-control border border-linea px-3 text-sm font-medium text-tinta whitespace-nowrap">
              <input
                type="checkbox"
                checked={exentoItbis}
                onChange={(e) => manejarCambioExento(e.target.checked)}
                className="size-4 accent-marca-500"
              />
              <span>{t("exentoItbis")}</span>
            </label>
          </div>

          {/* Fila 6: Totales (debajo de las retenciones) */}
          <dl className="grid gap-4 rounded-control bg-superficie/60 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="texto-meta">{t("monto")}</dt>
              <dd className="font-medium text-tinta">{formatearMonto(base, monedaVista)}</dd>
            </div>
            <div>
              <dt className="texto-meta">{t("itbis")}</dt>
              <dd className="font-medium text-tinta">{formatearMonto(itbisAplicado, monedaVista)}</dd>
            </div>
            <div>
              <dt className="texto-meta">{t("total")}</dt>
              <dd className="font-semibold text-tinta">{formatearMonto(totalFactura, monedaVista)}</dd>
            </div>
            <div>
              <dt className="texto-meta">{t("retencionIsr")}</dt>
              <dd className="font-medium text-tinta">−{formatearMonto(retencionIsr, monedaVista)}</dd>
            </div>
            <div>
              <dt className="texto-meta">{t("retencionItbis")}</dt>
              <dd className="font-medium text-tinta">−{formatearMonto(retencionItbis, monedaVista)}</dd>
            </div>
            <div>
              <dt className="texto-meta">{t("neto")}</dt>
              <dd className="font-semibold text-marca-700">{formatearMonto(neto, monedaVista)}</dd>
            </div>
          </dl>

          {/* Fila 7: Check «Incluir asignaciones» */}
          <div className="space-y-4 rounded-control border border-linea p-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-tinta">
              <input
                type="checkbox"
                checked={incluirAsignaciones}
                onChange={(e) => setIncluirAsignaciones(e.target.checked)}
                className="size-4 accent-marca-500"
              />
              <span>{t("incluirAsignaciones")}</span>
            </label>

            {incluirAsignaciones && (
              <div className="space-y-4 border-t border-linea pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Campo id="fondo" etiqueta={t("fondo")}>
                    <select
                      id="fondo"
                      name="fondo"
                      className={SELECT}
                      value={fondo}
                      onChange={(e) => setFondo(e.target.value)}
                      required
                    >
                      {fondos.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo id="proyecto" etiqueta={t("proyecto")}>
                    <select
                      id="proyecto"
                      name="proyecto"
                      className={SELECT}
                      value={proyecto}
                      onChange={(e) => setProyecto(e.target.value)}
                    >
                      <option value="">{t("ninguno")}</option>
                      {proyectos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Campo id="solicitante" etiqueta={t("solicitante")}>
                    <select
                      id="solicitante"
                      name="solicitante"
                      className={SELECT}
                      value={solicitante}
                      onChange={(e) => setSolicitante(e.target.value)}
                    >
                      <option value="">{t("ninguno")}</option>
                      {solicitantes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} ({s.rol})
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo id="programa" etiqueta={t("programa")}>
                    <select
                      id="programa"
                      name="programa"
                      className={SELECT}
                      value={programa}
                      onChange={(e) => setPrograma(e.target.value)}
                    >
                      <option value="">{t("ninguno")}</option>
                      {PROGRAMAS_INSTITUCIONALES.map((prg) => (
                        <option key={prg.codigo} value={prg.codigo}>
                          {prg.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>

                {estudiantes.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Campo id="estudiante" etiqueta={t("estudiante")}>
                      <select
                        id="estudiante"
                        name="estudiante"
                        className={SELECT}
                        value={estudiante}
                        onChange={(e) => setEstudiante(e.target.value)}
                      >
                        <option value="">{t("ninguno")}</option>
                        {estudiantes.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    {estudiante && (
                      <Campo id="pilar_costo" etiqueta={t("pilar")}>
                        <select
                          id="pilar_costo"
                          name="pilar_costo"
                          className={SELECT}
                          defaultValue={factura?.pilar_costo ?? "universidad"}
                        >
                          {PILARES_COSTO.map((p) => (
                            <option key={p} value={p}>
                              {t(`pilares.${p}`)}
                            </option>
                          ))}
                        </select>
                      </Campo>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {error && <AvisoError>{error}</AvisoError>}
        <AccionesFormulario>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant={mostrarBotonAprobar ? "outline" : "default"} cargando={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("guardar")}
            </Button>
            {mostrarBotonAprobar && (
              <Button
                type="submit"
                name="aprobar_despues"
                value="1"
                disabled={enviando || !ncfCompletoYValido}
                cargando={enviando}
              >
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {t("aprobar")}
              </Button>
            )}
            {enModal ? (
              <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
                {t("cancelar")}
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link href={factura ? fichaFactura(factura.id) : proveedor ? fichaProveedor(proveedor) : "/contabilidad/proveedores"}>
                  {t("cancelar")}
                </Link>
              </Button>
            )}
          </div>
        </AccionesFormulario>
      </form>
    </div>
  );
}
