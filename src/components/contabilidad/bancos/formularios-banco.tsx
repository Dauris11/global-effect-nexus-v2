"use client";

import { useActionState, useRef, useState } from "react";
import { ArrowLeftRight, CheckCircle2, CloudUpload, FileSpreadsheet, Link2, Loader2, Save, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { BotonAsiento } from "@/components/contabilidad/asiento/boton-asiento";
import { AvisoError, AvisoOk, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { AccionesFormulario, FormularioGuiado, PasoFormulario } from "@/components/ui/formulario-guiado";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipAyuda } from "@/components/ui/tooltip-ayuda";
import { useRouter } from "@/i18n/navigation";
import {
  decodificarCsvBanco,
  parsearVistaPreviaEstadoBanco,
  type FormatoEstadoBanco,
  type ResultadoVistaPreviaCsv,
} from "@/lib/contabilidad/formato-estado-banco";
import {
  registrarTasa,
  subirEstadoFormatoBanco,
  transferirEntreCuentas,
  vincularCuentaContable,
  type EstadoBanco,
} from "@/server/contabilidad/bancos/acciones";
import { asientoPreviaTransferencia } from "@/server/contabilidad/bancos/acciones-asiento";
import type { OpcionCuenta } from "@/server/contabilidad/recibos/consultas";

const INICIAL: EstadoBanco = { estado: "inicial" };

function useError(estado: EstadoBanco): string | null {
  const t = useTranslations("contab");
  if (estado.estado === "inicial" || estado.estado === "ok") return null;
  const mensaje = t(`error.${estado.estado}` as never);
  // El detalle del lector de CSV ("Línea 12: …") es dato y se muestra tal cual.
  return estado.detalle ? `${mensaje} ${estado.detalle}` : mensaje;
}

function Campo({
  id,
  etiqueta,
  children,
}: {
  id: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </Label>
      {children}
    </div>
  );
}

/**
 * Transferencia entre cuentas propias. El segundo monto solo se pide si
 * las monedas difieren: entre dos cuentas en pesos sale y entra lo mismo,
 * y pedirlo dos veces solo abre la puerta a un error de tecleo.
 */
export function DialogoTransferencia({ cuentas, hoy }: { cuentas: OpcionCuenta[]; hoy: string }) {
  const t = useTranslations("contab.bancos.transferencia");
  const tb = useTranslations("contab.bancos");
  const [abierto, setAbierto] = useState(false);
  // El diálogo se cierra desde la acción misma, al volver "ok", y no con
  // un efecto que observe el estado.
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoBanco, datos: FormData) => {
      const resultado = await transferirEntreCuentas(previo, datos);
      if (resultado.estado === "ok") setAbierto(false);
      return resultado;
    },
    INICIAL,
  );
  const [origen, setOrigen] = useState(cuentas[0]?.id ?? "");
  const [destino, setDestino] = useState(cuentas[1]?.id ?? "");
  const error = useError(estado);
  // «Asiento» lee lo escrito hasta ahora en el formulario (los pasos ocultos
  // siguen montados, ver FormularioGuiado) y calcula la diferencia cambiaria.
  const formulario = useRef<HTMLFormElement>(null);
  const monedaOrigen = cuentas.find((c) => c.id === origen)?.moneda;
  const monedaDestino = cuentas.find((c) => c.id === destino)?.moneda;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <ArrowLeftRight className="size-4" />
          {tb("transferir")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("titulo")}</DialogTitle>
        </DialogHeader>
        <form ref={formulario} action={enviar} className="space-y-4">
          <FormularioGuiado>
            <PasoFormulario titulo={t("pasos.cuentas")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="origen" etiqueta={t("origen")}>
                  <select id="origen" name="origen" className={SELECT} value={origen} onChange={(e) => setOrigen(e.target.value)}>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </Campo>
                <Campo id="destino" etiqueta={t("destino")}>
                  <select id="destino" name="destino" className={SELECT} value={destino} onChange={(e) => setDestino(e.target.value)}>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </Campo>
                <Campo id="fecha_tr" etiqueta={t("fecha")}>
                  <Input id="fecha_tr" name="fecha" type="date" defaultValue={hoy} required />
                </Campo>
                <Campo id="monto_origen" etiqueta={`${t("montoOrigen")} (${monedaOrigen ?? ""})`}>
                  <Input id="monto_origen" name="monto_origen" inputMode="decimal" required />
                </Campo>
                {monedaOrigen && monedaDestino && monedaOrigen !== monedaDestino && (
                  <Campo id="monto_destino" etiqueta={`${t("montoDestino")} (${monedaDestino})`}>
                    <Input id="monto_destino" name="monto_destino" inputMode="decimal" required />
                  </Campo>
                )}
              </div>
            </PasoFormulario>
            <PasoFormulario titulo={t("pasos.detalle")}>
              <Campo id="concepto_tr" etiqueta={t("concepto")}>
                <Input id="concepto_tr" name="concepto" required maxLength={200} />
              </Campo>
              <Campo id="referencia_tr" etiqueta={t("referencia")}>
                <Input id="referencia_tr" name="referencia" maxLength={120} />
              </Campo>
            </PasoFormulario>
            {error && <AvisoError>{error}</AvisoError>}
            <AccionesFormulario>
              <BotonAsiento
                cargar={() => asientoPreviaTransferencia(new FormData(formulario.current ?? undefined))}
              />
              <Button type="submit" cargando={enviando}>
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("guardar")}
              </Button>
            </AccionesFormulario>
          </FormularioGuiado>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FormularioTasa({ hoy }: { hoy: string }) {
  const t = useTranslations("contab.bancos.tasaForm");
  const [estado, enviar, enviando] = useActionState(registrarTasa, INICIAL);
  const error = useError(estado);

  return (
    <form action={enviar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo id="fecha_tasa" etiqueta={t("fecha")}>
          <Input id="fecha_tasa" name="fecha" type="date" defaultValue={hoy} required />
        </Campo>
        <Campo id="compra" etiqueta={t("compra")}>
          <Input id="compra" name="compra" inputMode="decimal" required />
        </Campo>
        <Campo id="venta" etiqueta={t("venta")}>
          <Input id="venta" name="venta" inputMode="decimal" required />
        </Campo>
        <Campo id="fuente" etiqueta={t("fuente")}>
          <Input id="fuente" name="fuente" defaultValue="BCRD" maxLength={60} />
        </Campo>
      </div>
      {error && <AvisoError>{error}</AvisoError>}
      {estado.estado === "ok" && <AvisoOk>{t("ok")}</AvisoOk>}
      <Button type="submit" variant="secondary" cargando={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t("guardar")}
      </Button>
    </form>
  );
}

const COLUMNAS_NUMERICAS = new Set(["retiros", "depositos", "balance", "debito", "credito", "monto", "saldo"]);

function esColumnaNumerica(nombre: string): boolean {
  const normalizada = nombre
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return COLUMNAS_NUMERICAS.has(normalizada);
}

/**
 * Subir estado de cuenta (.csv) en dos pasos claros:
 *   1. «Cargar»: lee y previsualiza en la misma ventana con las reglas del
 *      formato configurado (p. ej. Santa Cruz).
 *   2. «Subir»: guarda las transacciones nuevas (saltando duplicados),
 *      concilia automáticamente las coincidencias exactas de referencia y
 *      monto, y lleva a la pestaña Movimientos.
 */
export function DialogoSubirEstado({
  cuentaId,
  formatos,
}: {
  cuentaId: string;
  formatos: FormatoEstadoBanco[];
}) {
  const t = useTranslations("contab.conciliacion.importar");
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [formatoId, setFormatoId] = useState(formatos[0]?.id ?? "");
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<{
    archivoNombre: string;
    formatoNombre: string;
    resultado: ResultadoVistaPreviaCsv;
  } | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const formatoActual = formatos.find((f) => f.id === formatoId) ?? formatos[0] ?? null;

  function reiniciar() {
    setArchivoSeleccionado(null);
    setErrorLectura(null);
    setVistaPrevia(null);
    setLeyendo(false);
    setSubiendo(false);
    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
  }

  function manejarCambioAbierto(siguiente: boolean) {
    setAbierto(siguiente);
    if (!siguiente) reiniciar();
  }

  async function onCargarVistaPrevia() {
    setErrorLectura(null);
    if (!formatoActual) {
      setErrorLectura(t("sinFormatos"));
      return;
    }
    if (!archivoSeleccionado) {
      setErrorLectura(t("archivoRequerido"));
      return;
    }

    setLeyendo(true);
    try {
      const buffer = await archivoSeleccionado.arrayBuffer();
      const texto = decodificarCsvBanco(buffer);
      const resultado = parsearVistaPreviaEstadoBanco(texto, formatoActual);
      setVistaPrevia({
        archivoNombre: archivoSeleccionado.name,
        formatoNombre: formatoActual.nombre,
        resultado,
      });
    } catch {
      setErrorLectura(t("errorLectura"));
    } finally {
      setLeyendo(false);
    }
  }

  async function onSubirDefinitivo() {
    setErrorLectura(null);
    if (!formatoActual || !archivoSeleccionado) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("cuenta", cuentaId);
      fd.append("formato_id", formatoActual.id);
      fd.append("archivo", archivoSeleccionado);
      const resultado = await subirEstadoFormatoBanco(INICIAL, fd);
      if (resultado.estado === "ok") {
        setAbierto(false);
        reiniciar();
        router.push(`/contabilidad/bancos/${cuentaId}?vista=movimientos`);
        router.refresh();
      } else {
        setErrorLectura(resultado.detalle ? `${t("errorLectura")} ${resultado.detalle}` : t("errorLectura"));
      }
    } catch {
      setErrorLectura(t("errorLectura"));
    } finally {
      setSubiendo(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vistaPrevia) {
      await onCargarVistaPrevia();
      return;
    }
    await onSubirDefinitivo();
  }

  const listoParaSubir =
    vistaPrevia !== null &&
    vistaPrevia.resultado.columnasFaltantes.length === 0 &&
    vistaPrevia.resultado.filas.length > 0;

  return (
    <Dialog open={abierto} onOpenChange={manejarCambioAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 rounded-full px-4 shadow-sm">
          <CloudUpload className="size-4" />
          {t("boton")}
        </Button>
      </DialogTrigger>
      <DialogContent className={vistaPrevia ? "max-h-[90dvh] overflow-y-auto md:max-w-5xl" : "max-h-[90dvh] overflow-y-auto md:max-w-xl"}>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center justify-center gap-1.5">
            <span>{t("titulo")}</span>
            <TooltipAyuda texto={t("tituloAyuda")} etiqueta={t("masInformacion")} />
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {formatos.length === 0 ? (
            <AvisoError>{t("sinFormatos")}</AvisoError>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="formato_banco" className="text-sm font-medium">
                    {t("formato")}
                  </Label>
                  <TooltipAyuda texto={t("formatoAyuda")} etiqueta={t("masInformacion")} />
                </div>
                <select
                  id="formato_banco"
                  className={SELECT}
                  value={formatoActual?.id ?? ""}
                  onChange={(e) => {
                    setFormatoId(e.target.value);
                    setVistaPrevia(null);
                    setErrorLectura(null);
                  }}
                >
                  {formatos.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="archivo_ec" className="text-sm font-medium">
                  {t("archivo")}
                </Label>
                <label
                  htmlFor="archivo_ec"
                  className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control border border-dashed border-marca-500/60 bg-marca-500/5 px-3 py-2 text-sm text-tinta transition-colors hover:bg-marca-500/10"
                >
                  <FileSpreadsheet className="size-4 shrink-0 text-marca-600" />
                  <span className="min-w-0 flex-1 truncate">
                    {archivoSeleccionado ? archivoSeleccionado.name : t("elegirArchivo")}
                  </span>
                  <input
                    ref={inputArchivoRef}
                    id="archivo_ec"
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) => {
                      setArchivoSeleccionado(e.target.files?.[0] ?? null);
                      setVistaPrevia(null);
                      setErrorLectura(null);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {errorLectura && <AvisoError>{errorLectura}</AvisoError>}

          {vistaPrevia && (
            <div className="space-y-3 border-t border-linea pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 font-medium text-tinta">
                  <CheckCircle2 className="size-4 shrink-0 text-marca-600" />
                  <span>
                    {t("resumenLectura", {
                      archivo: vistaPrevia.archivoNombre,
                      filas: vistaPrevia.resultado.filas.length,
                      columnas: vistaPrevia.resultado.columnas.length - vistaPrevia.resultado.columnasFaltantes.length,
                    })}
                  </span>
                </div>
                <span className="texto-meta">{vistaPrevia.formatoNombre}</span>
              </div>

              {vistaPrevia.resultado.columnasFaltantes.length > 0 && (
                <AvisoError>
                  {t("columnasFaltantes", {
                    lista: vistaPrevia.resultado.columnasFaltantes.join(", "),
                  })}
                </AvisoError>
              )}

              {vistaPrevia.resultado.filas.length === 0 ? (
                <AvisoError>{t("sinFilas")}</AvisoError>
              ) : (
                <div className="max-h-96 overflow-auto rounded-control border border-linea bg-card">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 border-b border-linea bg-muted/80 text-tinta-3 backdrop-blur-xs">
                      <tr>
                        {vistaPrevia.resultado.columnas.map((col) => (
                          <th
                            key={col}
                            className={`whitespace-nowrap px-3 py-2.5 font-medium ${esColumnaNumerica(col) ? "text-right" : ""}`}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vistaPrevia.resultado.filas.map((fila, idx) => (
                        <tr key={idx} className="border-b border-linea last:border-b-0">
                          {vistaPrevia.resultado.columnas.map((col) => (
                            <td
                              key={col}
                              className={`px-3 py-2 text-tinta ${
                                esColumnaNumerica(col)
                                  ? "whitespace-nowrap text-right tabular-nums"
                                  : col.toLowerCase().includes("fecha") || col.toLowerCase().includes("no.")
                                    ? "whitespace-nowrap tabular-nums"
                                    : "min-w-48"
                              }`}
                            >
                              {fila[col] || <span className="text-tinta-3">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => manejarCambioAbierto(false)}
            >
              <X className="size-4" />
              {t("cerrar")}
            </Button>
            {vistaPrevia ? (
              <Button
                type="submit"
                disabled={!listoParaSubir || subiendo}
                cargando={subiendo}
                className="gap-2"
              >
                {subiendo ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
                {t("guardar")}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={formatos.length === 0 || !archivoSeleccionado || leyendo}
                cargando={leyendo}
                className="gap-2"
              >
                {leyendo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {t("cargar")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Vincular el banco con su cuenta contable auxiliar. */
export function DialogoVincularCuenta({
  cuentaId,
  actual,
  opciones,
}: {
  cuentaId: string;
  actual: string;
  opciones: { id: string; codigo: string; nombre: string }[];
}) {
  const t = useTranslations("contab.conciliacion.vincular");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoBanco, datos: FormData) => {
      const resultado = await vincularCuentaContable(previo, datos);
      if (resultado.estado === "ok") setAbierto(false);
      return resultado;
    },
    INICIAL,
  );
  const error = useError(estado);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Link2 className="size-4" />
          {t("boton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("titulo")}</DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="cuenta" value={cuentaId} />
          <Campo id="cuenta_contable" etiqueta={t("cuenta")}>
            <select id="cuenta_contable" name="cuenta_contable" className={SELECT} defaultValue={actual} required>
              {opciones.map((c) => (
                <option key={c.id} value={c.id}>{`${c.codigo} · ${c.nombre}`}</option>
              ))}
            </select>
          </Campo>
          {error && <AvisoError>{error}</AvisoError>}
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
