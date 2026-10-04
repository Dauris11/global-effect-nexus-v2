"use client";

import { useActionState, useState } from "react";
import { Calendar, CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, AvisoOk, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pagarCxp, programarCxp, type EstadoCxpAccion } from "@/server/contabilidad/cxp/acciones";
import type { FilaCxp } from "@/server/contabilidad/cxp/consultas";
import type { Opcion, OpcionCategoria, OpcionCuenta } from "@/server/contabilidad/recibos/consultas";

const INICIAL: EstadoCxpAccion = { estado: "inicial" };

export function AccionesCxp({
  cxp,
  cuentasBancarias,
  categorias,
  fondos,
  proyectos,
  hoy,
  puedeRegistrar,
  puedeAprobar,
}: {
  cxp: FilaCxp;
  cuentasBancarias: OpcionCuenta[];
  categorias: OpcionCategoria[];
  fondos: Opcion[];
  proyectos: Opcion[];
  hoy: string;
  puedeRegistrar: boolean;
  puedeAprobar: boolean;
}) {
  const t = useTranslations("contab.cxp");
  const tc = useTranslations("contab");

  const [estadoProgramar, enviarProgramar, programando] = useActionState(programarCxp, INICIAL);
  const [estadoPagar, enviarPagar, pagando] = useActionState(pagarCxp, INICIAL);

  const [montoPago, setMontoPago] = useState(cxp.saldo);
  const [formaPago, setFormaPago] = useState<string>("transferencia");

  const cuentasMismaMoneda = cuentasBancarias.filter(
    (c) => c.moneda === cxp.moneda,
  );

  const errorProgramar =
    estadoProgramar.estado !== "inicial" && estadoProgramar.estado !== "ok"
      ? tc(`error.${estadoProgramar.estado}` as never)
      : null;

  const errorPagar =
    estadoPagar.estado !== "inicial" && estadoPagar.estado !== "ok"
      ? tc(`error.${estadoPagar.estado}` as never)
      : null;

  const abierta = cxp.estado !== "pagada" && cxp.estado !== "anulada";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Programar pago */}
      {abierta && puedeRegistrar && (
        <div className="rounded-tarjeta border border-linea bg-background p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-tinta flex items-center gap-2">
              <Calendar className="size-4 text-tinta-2" />
              {t("programar")}
            </h3>
            <p className="text-xs text-tinta-2 mt-1">{t("programarAyuda")}</p>
          </div>

          <form action={enviarProgramar} className="space-y-4">
            <input type="hidden" name="id" value={cxp.id} />

            <div className="space-y-1.5">
              <Label htmlFor="fecha" className="text-sm font-medium">
                {t("fechaProgramada")}
              </Label>
              <Input
                id="fecha"
                name="fecha"
                type="date"
                required
                defaultValue={cxp.fecha_programada ?? hoy}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cuenta" className="text-sm font-medium">
                {t("cuentaSalida")} ({cxp.moneda})
              </Label>
              <select
                id="cuenta"
                name="cuenta"
                className={SELECT}
                required
                defaultValue={cxp.cuenta_salida_id ?? cuentasMismaMoneda[0]?.id ?? ""}
              >
                {cuentasMismaMoneda.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoria" className="text-sm font-medium">
                {t("categoria")}
              </Label>
              <select
                id="categoria"
                name="categoria"
                className={SELECT}
                required
                defaultValue={cxp.categoria_id}
              >
                {categorias
                  .filter((c) => c.tipo !== "ingreso")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fondo" className="text-sm font-medium">
                {t("fondo")}
              </Label>
              <select
                id="fondo"
                name="fondo"
                className={SELECT}
                required
                defaultValue={cxp.fondo_id}
              >
                {fondos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proyecto" className="text-sm font-medium">
                {t("proyecto")}
              </Label>
              <select
                id="proyecto"
                name="proyecto"
                className={SELECT}
                defaultValue={cxp.proyecto_id ?? ""}
              >
                <option value="">{t("ninguno")}</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            {errorProgramar && <AvisoError>{errorProgramar}</AvisoError>}
            {estadoProgramar.estado === "ok" && <AvisoOk>{t("ok")}</AvisoOk>}

            <Button type="submit" variant="secondary" disabled={programando} className="w-full">
              {programando ? <Loader2 className="size-4 animate-spin" /> : <Calendar className="size-4" />}
              {t("guardarProgramacion")}
            </Button>
          </form>
        </div>
      )}

      {/* Registrar pago */}
      {abierta && puedeAprobar && (
        <div className="rounded-tarjeta border border-linea bg-background p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-tinta flex items-center gap-2">
              <DollarSign className="size-4 text-tinta-2" />
              {t("pagar")}
            </h3>
            <p className="text-xs text-tinta-2 mt-1">{t("pagarAyuda")}</p>
          </div>

          <form action={enviarPagar} className="space-y-4">
            <input type="hidden" name="id" value={cxp.id} />
            <input type="hidden" name="moneda" value={cxp.moneda} />

            <div className="space-y-1.5">
              <Label htmlFor="cuenta_pago" className="text-sm font-medium">
                {t("cuentaSalida")} ({cxp.moneda})
              </Label>
              <select
                id="cuenta_pago"
                name="cuenta"
                className={SELECT}
                required
                defaultValue={cxp.cuenta_salida_id ?? cuentasMismaMoneda[0]?.id ?? ""}
              >
                {cuentasMismaMoneda.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fecha_pago" className="text-sm font-medium">
                  {t("fechaPago")}
                </Label>
                <Input id="fecha_pago" name="fecha" type="date" required defaultValue={hoy} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="monto_pago" className="text-sm font-medium">
                  {t("montoPago")} ({cxp.moneda})
                </Label>
                <Input
                  id="monto_pago"
                  name="monto"
                  inputMode="decimal"
                  required
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="forma_pago" className="text-sm font-medium">
                  {t("formaPago")}
                </Label>
                <select
                  id="forma_pago"
                  name="forma_pago"
                  className={SELECT}
                  value={formaPago}
                  onChange={(e) => setFormaPago(e.target.value)}
                  required
                >
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="referencia" className="text-sm font-medium">
                  {t("referencia")}
                </Label>
                <Input
                  id="referencia"
                  name="referencia"
                  maxLength={120}
                  placeholder={formaPago === "cheque" ? "Núm. de cheque" : "Núm. de transferencia"}
                />
              </div>
            </div>

            {cxp.moneda === "USD" && (
              <div className="space-y-1.5">
                <Label htmlFor="tasa" className="text-sm font-medium">
                  {t("tasa")}
                </Label>
                <Input id="tasa" name="tasa" inputMode="decimal" required placeholder="60.0000" />
              </div>
            )}

            {errorPagar && <AvisoError>{errorPagar}</AvisoError>}
            {estadoPagar.estado === "ok" && <AvisoOk>{t("ok")}</AvisoOk>}

            <Button type="submit" disabled={pagando} className="w-full">
              {pagando ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {t("confirmarPago")}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
