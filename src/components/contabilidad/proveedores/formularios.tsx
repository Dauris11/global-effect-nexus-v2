"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, Save, Sparkles, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, AvisoOk, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { AccionesFormulario, FormularioGuiado, PasoFormulario } from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { MONEDAS, montoValido, restarMontos, sumarMontos } from "@/lib/contabilidad/formato";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { identificacionValida, limpiarIdentificacion } from "@/lib/contabilidad/identificacion";
import { PROGRAMAS_INSTITUCIONALES } from "@/lib/contabilidad/programas";
import {
  agregarCuentaProveedor,
  guardarFactura,
  guardarProveedor,
  procesarFacturaOcrAction,
  type EstadoProveedor,
} from "@/server/contabilidad/proveedores/acciones";
import type { DetalleFactura, DetalleProveedor, UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";
import type { Opcion, OpcionCategoria } from "@/server/contabilidad/recibos/consultas";


const INICIAL: EstadoProveedor = { estado: "inicial" };

function useError(estado: EstadoProveedor): string | null {
  const t = useTranslations("contab");
  return estado.estado === "inicial" || estado.estado === "ok" ? null : t(`error.${estado.estado}` as never);
}

/** Tras guardar, a la ficha que corresponde. */
function useIrA(estado: EstadoProveedor, destino: (id: string) => string) {
  const router = useRouter();
  useEffect(() => {
    if (estado.estado === "ok" && estado.id) router.push(destino(estado.id));
  }, [estado, router, destino]);
}

function Campo({ id, etiqueta, ayuda, children }: { id: string; etiqueta: string; ayuda?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{etiqueta}</Label>
      {children}
      {ayuda && <div className="texto-meta">{ayuda}</div>}
    </div>
  );
}

const fichaProveedor = (id: string) => `/contabilidad/proveedores/${id}`;
const fichaFactura = (id: string) => `/contabilidad/facturas/${id}`;

export function FormularioProveedor({
  proveedor,
  categorias,
}: {
  proveedor?: DetalleProveedor;
  categorias: Opcion[];
}) {
  const t = useTranslations("contab.proveedorForm");
  const tc = useTranslations("contab");
  const [estado, enviar, enviando] = useActionState(guardarProveedor, INICIAL);
  const [tipo, setTipo] = useState<"fisica" | "juridica">(proveedor?.tipo ?? "juridica");
  const [identificacion, setIdentificacion] = useState(proveedor?.identificacion ?? "");
  const error = useError(estado);
  useIrA(estado, fichaProveedor);

  // Aviso mientras se escribe; el servidor vuelve a comprobarlo.
  const limpia = limpiarIdentificacion(identificacion);
  const completa = limpia.length === (tipo === "juridica" ? 9 : 11);
  const malDigito = completa && !identificacionValida(limpia, tipo);

  return (
    <form action={enviar} className="space-y-5">
      {proveedor && <input type="hidden" name="id" value={proveedor.id} />}
      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.identificacion")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo id="tipo" etiqueta={t("tipo")}>
              <select id="tipo" name="tipo" className={SELECT} value={tipo} onChange={(e) => setTipo(e.target.value as "fisica" | "juridica")}>
                <option value="juridica">{tc("tipoProveedor.juridica")}</option>
                <option value="fisica">{tc("tipoProveedor.fisica")}</option>
              </select>
            </Campo>
            <Campo id="identificacion" etiqueta={t("identificacion")} ayuda={malDigito ? tc("error.identificacion_invalida") : t("identificacionAyuda")}>
              <Input
                id="identificacion"
                name="identificacion"
                inputMode="numeric"
                required
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                aria-invalid={malDigito || undefined}
              />
            </Campo>
            <Campo id="nombre" etiqueta={t("nombre")}>
              <Input id="nombre" name="nombre" required maxLength={160} defaultValue={proveedor?.nombre ?? ""} />
            </Campo>
            <Campo id="nombre_comercial" etiqueta={t("nombreComercial")}>
              <Input id="nombre_comercial" name="nombre_comercial" maxLength={160} defaultValue={proveedor?.nombre_comercial ?? ""} />
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
          </div>
          <Campo id="direccion" etiqueta={t("direccion")}>
            <Textarea id="direccion" name="direccion" rows={2} maxLength={300} defaultValue={proveedor?.direccion ?? ""} />
          </Campo>
        </PasoFormulario>
        <PasoFormulario titulo={t("pasos.condiciones")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo id="condiciones" etiqueta={t("condiciones")}>
              <Input id="condiciones" name="condiciones" type="number" min={0} max={365} defaultValue={proveedor?.condiciones_pago_dias ?? 30} />
            </Campo>
            <Campo id="categoria" etiqueta={t("categoria")}>
              <select id="categoria" name="categoria" className={SELECT} defaultValue={proveedor?.categoria_id ?? ""}>
                <option value="">{t("ninguna")}</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
            <Campo id="estado" etiqueta={t("estado")}>
              <select id="estado" name="estado" className={SELECT} defaultValue={proveedor?.estado ?? "activo"}>
                <option value="activo">{tc("estadoProveedor.activo")}</option>
                <option value="inactivo">{tc("estadoProveedor.inactivo")}</option>
              </select>
            </Campo>
          </div>
        </PasoFormulario>
        {error && <AvisoError>{error}</AvisoError>}
        <AccionesFormulario>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={enviando}>
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

export function FormularioCuentaProveedor({ proveedorId }: { proveedorId: string }) {
  const t = useTranslations("contab.proveedor");
  const tc = useTranslations("contab");
  const [estado, enviar, enviando] = useActionState(agregarCuentaProveedor, INICIAL);
  const error = useError(estado);

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="proveedor" value={proveedorId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo id="banco" etiqueta={t("banco")}><Input id="banco" name="banco" required maxLength={120} /></Campo>
        <Campo id="tipo_cuenta" etiqueta={t("tipoCuenta")}>
          <select id="tipo_cuenta" name="tipo" className={SELECT}>
            <option value="corriente">{tc("tipoCuenta.corriente")}</option>
            <option value="ahorro">{tc("tipoCuenta.ahorro")}</option>
          </select>
        </Campo>
        <Campo id="moneda_cuenta" etiqueta={t("moneda")}>
          <select id="moneda_cuenta" name="moneda" className={SELECT}>
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo id="numero" etiqueta={t("numero")}><Input id="numero" name="numero" required inputMode="numeric" maxLength={40} /></Campo>
      </div>
      <p className="texto-meta">{t("nuevaCuentaAyuda")}</p>
      {error && <AvisoError>{error}</AvisoError>}
      {estado.estado === "ok" && <AvisoOk>{tc("cxp.ok")}</AvisoOk>}
      <Button type="submit" variant="secondary" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t("guardarCuenta")}
      </Button>
    </form>
  );
}

/**
 * Factura de proveedor. El total y el neto se calculan a la vista con
 * aritmética de centavos (nada de float); el servidor guarda los
 * componentes y la base calcula total y neto como columnas generadas.
 */
export function FormularioFactura({
  proveedores,
  proveedorId,
  factura,
  categorias,
  fondos,
  proyectos,
  solicitantes = [],
  hoy,
}: {
  proveedores: (Opcion & { tipo: "fisica" | "juridica"; dias: number; categoria_id: string | null; identificacion?: string })[];
  proveedorId?: string;
  factura?: DetalleFactura;
  categorias: OpcionCategoria[];
  fondos: Opcion[];
  proyectos: Opcion[];
  solicitantes?: UsuarioSolicitante[];
  hoy: string;
}) {
  const t = useTranslations("contab.facturaForm");
  const tp = useTranslations("contab.proveedor");
  const [estado, enviar, enviando] = useActionState(guardarFactura, INICIAL);
  const error = useError(estado);
  useIrA(estado, fichaFactura);

  const [proveedor, setProveedor] = useState(factura?.proveedor_id ?? proveedorId ?? proveedores[0]?.id ?? "");
  const datosProveedor = proveedores.find((p) => p.id === proveedor);
  const [moneda, setMoneda] = useState<string>(factura?.moneda ?? "DOP");
  const [emision, setEmision] = useState(factura?.fecha_emision ?? hoy);
  const [montos, setMontos] = useState({
    subtotal: factura?.subtotal ?? "",
    itbis: factura?.itbis ?? "",
    retencion_isr: factura?.retencion_isr ?? "",
    retencion_itbis: factura?.retencion_itbis ?? "",
  });
  const [ncf, setNcf] = useState(factura?.ncf ?? "");
  const [concepto, setConcepto] = useState(factura?.concepto ?? "");
  const [solicitante, setSolicitante] = useState(factura?.solicitante_id ?? "");
  const [programa, setPrograma] = useState(factura?.programa_codigo ?? "");

  // Estado del motor OCR
  const [escaneandoOcr, setEscaneandoOcr] = useState(false);
  const [ocrResultado, setOcrResultado] = useState<{ exito: boolean; confianza?: number; mensaje?: string } | null>(null);

  async function onSeleccionarArchivoOcr(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setEscaneandoOcr(true);
    setOcrResultado(null);

    const fd = new FormData();
    fd.append("archivo", archivo);

    try {
      const res = await procesarFacturaOcrAction(fd);
      if (res.exito) {
        const d = res.datos;
        if (d.ncf) setNcf(d.ncf);
        if (d.fechaEmision) setEmision(d.fechaEmision);
        if (d.moneda) setMoneda(d.moneda);
        if (d.concepto) setConcepto(d.concepto);

        setMontos({
          subtotal: d.subtotal !== null ? String(d.subtotal) : montos.subtotal,
          itbis: d.itbis ? String(d.itbis) : "0",
          retencion_isr: d.retencionIsr ? String(d.retencionIsr) : "0",
          retencion_itbis: d.retencionItbis ? String(d.retencionItbis) : "0",
        });

        if (d.rnc) {
          const coincidente = proveedores.find(
            (p) => p.identificacion && p.identificacion.replace(/\D/g, "") === d.rnc,
          );
          if (coincidente) {
            setProveedor(coincidente.id);
          }
        }

        setOcrResultado({
          exito: true,
          confianza: d.confianza,
          mensaje: t("ocrExito", { confianza: d.confianza }),
        });
      } else {
        setOcrResultado({
          exito: false,
          mensaje: t("ocrError", { error: res.error }),
        });
      }
    } catch (err: unknown) {
      setOcrResultado({
        exito: false,
        mensaje: (err as Error).message || "Error al procesar escaneo",
      });
    } finally {
      setEscaneandoOcr(false);
      e.target.value = "";
    }
  }

  // Vencimiento sugerido = emisión + días de crédito del proveedor.
  const sugerido = (() => {
    const d = new Date(`${emision}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return emision;
    d.setUTCDate(d.getUTCDate() + (datosProveedor?.dias ?? 30));
    return d.toISOString().slice(0, 10);
  })();

  const valor = (v: string) => montoValido(v) ?? "0";
  const total = sumarMontos([valor(montos.subtotal), valor(montos.itbis)]);
  const neto = restarMontos(total, sumarMontos([valor(montos.retencion_isr), valor(montos.retencion_itbis)]));
  const monedaVista = moneda === "USD" ? "USD" : "DOP";

  return (
    <div className="space-y-6">
      {/* Zona de escaneo OCR inteligente */}
      <div className="rounded-tarjeta border border-marca-200 bg-marca-50/50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-marca-600" />
              <h3 className="text-sm font-semibold text-tinta">{t("ocrTitulo")}</h3>
            </div>
            <p className="text-xs text-tinta-2">{t("ocrSubtitulo")}</p>
          </div>
          <div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-control bg-marca px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-marca-hover transition-colors">
              {escaneandoOcr ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{t("ocrProcesando")}</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  <span>{t("ocrBoton")}</span>
                </>
              )}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={escaneandoOcr}
                onChange={onSeleccionarArchivoOcr}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {ocrResultado && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-control p-2.5 text-xs ${
              ocrResultado.exito
                ? "bg-marca-100 text-marca-800"
                : "bg-semaforo-alerta/15 text-semaforo-alerta"
            }`}
          >
            {ocrResultado.exito && <CheckCircle2 className="size-4 shrink-0 text-marca-600" />}
            <span>{ocrResultado.mensaje}</span>
          </div>
        )}
      </div>

      <form action={enviar} className="space-y-5">
        {factura && <input type="hidden" name="id" value={factura.id} />}
        <FormularioGuiado>
          <PasoFormulario titulo={t("pasos.comprobante")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="proveedor" etiqueta={t("proveedor")}>
                <select id="proveedor" name="proveedor" className={SELECT} value={proveedor} onChange={(e) => setProveedor(e.target.value)} required>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </Campo>
              <Campo id="ncf" etiqueta={t("ncf")} ayuda={t("ncfAyuda")}>
                <Input id="ncf" name="ncf" maxLength={13} value={ncf} onChange={(e) => setNcf(e.target.value.toUpperCase())} className="uppercase font-mono" />
              </Campo>
              <Campo id="fecha_emision" etiqueta={t("emision")}>
                <Input id="fecha_emision" name="fecha_emision" type="date" required value={emision} onChange={(e) => setEmision(e.target.value)} />
              </Campo>
              <Campo id="fecha_vencimiento" etiqueta={t("vencimiento")}>
                <Input key={sugerido} id="fecha_vencimiento" name="fecha_vencimiento" type="date" required defaultValue={factura?.fecha_vencimiento ?? sugerido} />
              </Campo>
              <Campo id="moneda" etiqueta={t("moneda")}>
                <select id="moneda" name="moneda" className={SELECT} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                  {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Campo>
              {moneda === "USD" && (
                <Campo id="tasa" etiqueta={t("tasa")}>
                  <Input id="tasa" name="tasa" inputMode="decimal" required defaultValue={factura?.tasa ?? ""} />
                </Campo>
              )}
            </div>

            {datosProveedor?.tipo === "fisica" && !ncf && (
              <p className="rounded-control bg-marca-50 px-3 py-2.5 text-sm text-marca-700">{tp("sinComprobante")}</p>
            )}
          </PasoFormulario>

          <PasoFormulario titulo={t("pasos.montos")}>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["subtotal", "itbis", "retencion_isr", "retencion_itbis"] as const).map((campo) => (
                <Campo key={campo} id={campo} etiqueta={t(campo === "subtotal" ? "subtotal" : campo === "itbis" ? "itbis" : campo === "retencion_isr" ? "retencionIsr" : "retencionItbis")}>
                  <Input
                    id={campo}
                    name={campo}
                    inputMode="decimal"
                    required={campo === "subtotal"}
                    placeholder="0.00"
                    value={montos[campo]}
                    onChange={(e) => setMontos((m) => ({ ...m, [campo]: e.target.value }))}
                  />
                </Campo>
              ))}
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div><dt className="texto-meta">{t("total")}</dt><dd className="font-semibold">{formatearMonto(total, monedaVista)}</dd></div>
              <div><dt className="texto-meta">{t("neto")}</dt><dd className="font-semibold text-marca-700">{formatearMonto(neto, monedaVista)}</dd></div>
            </dl>

            <Campo id="concepto" etiqueta={t("concepto")}>
              <Input id="concepto" name="concepto" required maxLength={200} value={concepto} onChange={(e) => setConcepto(e.target.value)} />
            </Campo>
          </PasoFormulario>

          <PasoFormulario titulo={t("pasos.asignacion")}>

            {/* Asignación Institucional (Persona y Programa) */}
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

            <div className="grid gap-4 md:grid-cols-3">
              <Campo id="categoria" etiqueta={t("categoria")}>
                <select key={proveedor} id="categoria" name="categoria" className={SELECT} required
                  defaultValue={factura?.categoria_id ?? datosProveedor?.categoria_id ?? ""}>
                  {categorias.filter((c) => c.tipo !== "ingreso").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
              <Campo id="fondo" etiqueta={t("fondo")}>
                <select id="fondo" name="fondo" className={SELECT} defaultValue={factura?.fondo_id ?? ""} required>
                  {fondos.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </Campo>
              <Campo id="proyecto" etiqueta={t("proyecto")}>
                <select id="proyecto" name="proyecto" className={SELECT} defaultValue={factura?.proyecto_id ?? ""}>
                  <option value="">{t("ninguno")}</option>
                  {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </Campo>
            </div>
          </PasoFormulario>
          {error && <AvisoError>{error}</AvisoError>}
          <AccionesFormulario>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={enviando}>
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("guardar")}
              </Button>
              <Button asChild variant="ghost">
                <Link href={factura ? fichaFactura(factura.id) : proveedor ? fichaProveedor(proveedor) : "/contabilidad/proveedores"}>
                  {t("cancelar")}
                </Link>
              </Button>
            </div>
          </AccionesFormulario>
        </FormularioGuiado>
      </form>
    </div>
  );
}

