"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeftRight, Loader2, Save, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, AvisoOk, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { AccionesFormulario, FormularioGuiado, PasoFormulario } from "@/components/ui/formulario-guiado";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  importarEstadoCuenta,
  registrarTasa,
  transferirEntreCuentas,
  type EstadoBanco,
} from "@/server/contabilidad/bancos/acciones";
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
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </Label>
      {children}
      {ayuda && <p className="texto-meta">{ayuda}</p>}
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
          <DialogDescription>{t("descripcion")}</DialogDescription>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
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
                  <Campo id="monto_destino" etiqueta={`${t("montoDestino")} (${monedaDestino})`} ayuda={t("montoDestinoAyuda")}>
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
              <Button type="submit" disabled={enviando}>
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
      <Button type="submit" variant="secondary" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t("guardar")}
      </Button>
    </form>
  );
}

/**
 * Importar el estado de cuenta. Las columnas vienen precargadas con la
 * configuración del banco (`banco.config_estado`): el contable solo las
 * toca si el banco cambió el formato de su exportación.
 */
export function ImportarEstado({
  cuentaId,
  config,
  desde,
  hasta,
}: {
  cuentaId: string;
  config: Record<string, string>;
  desde: string;
  hasta: string;
}) {
  const t = useTranslations("contab.conciliacion.importar");
  const router = useRouter();
  const [estado, enviar, enviando] = useActionState(importarEstadoCuenta, INICIAL);
  const error = useError(estado);

  useEffect(() => {
    if (estado.estado === "ok" && estado.id) {
      router.push(`/contabilidad/bancos/${cuentaId}/conciliacion/${estado.id}`);
    }
  }, [estado, router, cuentaId]);

  const columnas: [string, string][] = [
    ["col_fecha", "fecha"],
    ["col_descripcion", "descripcion"],
    ["col_referencia", "referencia"],
    ["col_debito", "debito"],
    ["col_credito", "credito"],
    ["col_monto", "monto"],
    ["col_saldo", "saldo"],
  ];
  const etiquetas: Record<string, string> = {
    fecha: t("colFecha"),
    descripcion: t("colDescripcion"),
    referencia: t("colReferencia"),
    debito: t("colDebito"),
    credito: t("colCredito"),
    monto: t("colMonto"),
    saldo: t("colSaldo"),
  };

  return (
    <form action={enviar} className="space-y-5">
      <input type="hidden" name="cuenta" value={cuentaId} />
      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.archivo")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo id="archivo_ec" etiqueta={t("archivo")}>
              <Input id="archivo_ec" name="archivo" type="file" accept=".csv,text/csv" required />
            </Campo>
            <Campo id="desde_ec" etiqueta={t("desde")}>
              <Input id="desde_ec" name="desde" type="date" defaultValue={desde} required />
            </Campo>
            <Campo id="hasta_ec" etiqueta={t("hasta")}>
              <Input id="hasta_ec" name="hasta" type="date" defaultValue={hasta} required />
            </Campo>
            <Campo id="saldo_banco" etiqueta={t("saldo")}>
              <Input id="saldo_banco" name="saldo_banco" inputMode="decimal" required />
            </Campo>
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("columnas")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {columnas.map(([nombre, clave]) => (
              <Campo key={nombre} id={nombre} etiqueta={etiquetas[clave]}>
                <Input id={nombre} name={nombre} defaultValue={config[clave] ?? ""} maxLength={60} />
              </Campo>
            ))}
            <Campo id="formato_fecha" etiqueta={t("formatoFecha")}>
              <select id="formato_fecha" name="formato_fecha" className={SELECT} defaultValue={config.formatoFecha ?? "DD/MM/YYYY"}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </Campo>
            <Campo id="separador" etiqueta={t("separador")}>
              <select id="separador" name="separador" className={SELECT} defaultValue={config.separadorDecimal ?? "."}>
                <option value=".">{t("punto")}</option>
                <option value=",">{t("coma")}</option>
              </select>
            </Campo>
          </div>
        </PasoFormulario>

        {error && <AvisoError>{error}</AvisoError>}
        <AccionesFormulario>
          <Button type="submit" disabled={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {t("guardar")}
          </Button>
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}
