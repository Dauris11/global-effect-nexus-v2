"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Info, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Monto, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  validarLineas,
  type LineaEntrada,
  type ResultadoAsiento,
} from "@/lib/contabilidad/asientos";
import { cn } from "@/lib/utils";
import type { CuentaMovimiento } from "@/server/contabilidad/asientos/consultas";

/**
 * Editor de líneas de partida doble, compartido por el asiento manual y la
 * plantilla recurrente.
 *
 * El estado vive en `useLineas` (del formulario que lo usa) para que el
 * formulario pueda habilitar su botón con el mismo `ResultadoAsiento` que
 * pinta los totales. Las cifras se guardan como el texto que se escribió:
 * convertirlas a número en cada pulsación las redondearía en float.
 */

type Fila = LineaEntrada & { clave: number };

const vacia = (clave: number): Fila => ({ clave, cuenta_id: "", descripcion: "", debe: "", haber: "" });

export function useLineas() {
  const [filas, setFilas] = useState<Fila[]>(() => [vacia(1), vacia(2)]);
  const resultado = useMemo(() => validarLineas(filas), [filas]);

  return {
    filas,
    resultado,
    /** Lo que viaja en el campo oculto `lineas`; la clave de React no sale del navegador. */
    json: JSON.stringify(filas.map(({ cuenta_id, descripcion, debe, haber }) => ({ cuenta_id, descripcion, debe, haber }))),
    cambiar: (clave: number, campo: keyof LineaEntrada, valor: string) =>
      setFilas((actuales) => actuales.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f))),
    agregar: () => setFilas((actuales) => [...actuales, vacia(Math.max(0, ...actuales.map((f) => f.clave)) + 1)]),
    quitar: (clave: number) =>
      setFilas((actuales) => (actuales.length > 2 ? actuales.filter((f) => f.clave !== clave) : actuales)),
  };
}

export function EditorLineas({
  cuentas,
  lineas,
}: {
  cuentas: CuentaMovimiento[];
  lineas: ReturnType<typeof useLineas>;
}) {
  const t = useTranslations("contab.asientos.editor");
  const { filas, resultado, cambiar, agregar, quitar } = lineas;
  // Solo se señala la línea cuando el error es de esa línea y no por estar
  // a medio escribir: una fila con cuenta y sin monto todavía no es un error.
  const culpable =
    !resultado.ok && (resultado.error === "monto_invalido" || resultado.error === "linea_ambos_lados")
      ? resultado.linea
      : undefined;

  return (
    <fieldset className="space-y-3">
      <legend className="texto-titulo-tarjeta mb-2">{t("titulo")}</legend>

      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8rem_8rem_2.75rem] gap-2 px-1 text-sm font-medium text-tinta-3 md:grid">
        <span>{t("cuenta")}</span>
        <span>{t("descripcion")}</span>
        <span className="text-right">{t("debe")}</span>
        <span className="text-right">{t("haber")}</span>
        <span className="sr-only">{t("acciones")}</span>
      </div>

      <ol className="space-y-3 md:space-y-2">
        {filas.map((fila, indice) => {
          const n = indice + 1;
          const invalida = culpable === indice;
          return (
            <li
              key={fila.clave}
              className={cn(
                "grid gap-2 rounded-card border border-linea p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8rem_8rem_2.75rem] md:items-center md:rounded-none md:border-0 md:p-0",
              )}
            >
              <p className="texto-meta md:hidden">{t("linea", { n })}</p>
              <select
                aria-label={t("cuentaDe", { n })}
                className={SELECT}
                value={fila.cuenta_id}
                onChange={(e) => cambiar(fila.clave, "cuenta_id", e.target.value)}
              >
                <option value="">{t("elegirCuenta")}</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} · {c.nombre}
                  </option>
                ))}
              </select>
              <Input
                aria-label={t("descripcionDe", { n })}
                maxLength={200}
                value={fila.descripcion ?? ""}
                onChange={(e) => cambiar(fila.clave, "descripcion", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2 md:contents">
                <Input
                  aria-label={t("debeDe", { n })}
                  aria-invalid={invalida || undefined}
                  inputMode="decimal"
                  placeholder={t("debe")}
                  className="text-right tabular-nums"
                  value={fila.debe}
                  onChange={(e) => cambiar(fila.clave, "debe", e.target.value)}
                />
                <Input
                  aria-label={t("haberDe", { n })}
                  aria-invalid={invalida || undefined}
                  inputMode="decimal"
                  placeholder={t("haber")}
                  className="text-right tabular-nums"
                  value={fila.haber}
                  onChange={(e) => cambiar(fila.clave, "haber", e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("quitar", { n })}
                disabled={filas.length <= 2}
                onClick={() => quitar(fila.clave)}
                className="justify-self-end"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ol>

      <Button type="button" variant="secondary" onClick={agregar}>
        <Plus className="size-4" />
        {t("agregar")}
      </Button>

      <Totales resultado={resultado} />
    </fieldset>
  );
}

function Totales({ resultado }: { resultado: ResultadoAsiento }) {
  const t = useTranslations("contab.asientos.editor");
  const te = useTranslations("contab.asientos.error");
  const diferencia = resultado.diferencia.replace("-", "");

  return (
    <div className="space-y-3 border-t border-linea pt-4" aria-live="polite">
      <dl className="grid grid-cols-3 gap-3">
        <Cifra etiqueta={t("totalDebe")} valor={resultado.totalDebe} />
        <Cifra etiqueta={t("totalHaber")} valor={resultado.totalHaber} />
        <Cifra etiqueta={t("diferencia")} valor={diferencia} />
      </dl>
      {resultado.ok ? (
        <p className="flex items-center gap-2 text-sm font-medium text-marca-700">
          <CheckCircle2 className="size-4 shrink-0" />
          {t("cuadra")}
        </p>
      ) : (
        <p className="flex items-start gap-2 text-sm text-tinta-2">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            {resultado.linea !== undefined && `${t("linea", { n: resultado.linea + 1 })}: `}
            {te(resultado.error)}
          </span>
        </p>
      )}
    </div>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="texto-meta">{etiqueta}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-semibold text-tinta">
        <Monto valor={valor} moneda="DOP" />
      </dd>
    </div>
  );
}
