"use client";

import { useState, useTransition } from "react";
import { Check, CircleAlert, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { asignarCodigosACuenta } from "@/server/contabilidad/codigos-transaccion/acciones";
import type { CodigoConfigurado } from "@/server/contabilidad/codigos-transaccion/consultas";

/**
 * Casillas de códigos de transacción de una cuenta de movimiento. Se guarda
 * aparte del formulario de la cuenta: darle propósito a una cuenta no depende
 * de que tenga asientos, así que no pasa por las reglas que bloquean cambiar
 * su código o su tipo.
 */
export function CodigosDeCuenta({
  cuentaId,
  codigos,
}: {
  cuentaId: string;
  codigos: CodigoConfigurado[];
}) {
  const t = useTranslations("contab.config.cuenta");
  const tc = useTranslations("contab.config.codigos");
  const te = useTranslations("contab.config.codigos.error");
  const [marcados, setMarcados] = useState(
    () => new Set(codigos.filter((c) => c.cuenta?.id === cuentaId).map((c) => c.codigo)),
  );
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);

  if (codigos.length === 0) return <p className="texto-meta">{t("codigosVacio")}</p>;

  const alternar = (codigo: string, activo: boolean) => {
    setResultado(null);
    setMarcados((previo) => {
      const nuevo = new Set(previo);
      if (activo) nuevo.add(codigo);
      else nuevo.delete(codigo);
      return nuevo;
    });
  };

  const guardar = () =>
    iniciar(async () => {
      const r = await asignarCodigosACuenta(cuentaId, [...marcados]);
      setResultado(r.estado);
    });

  const modulos = [...new Set(codigos.map((c) => c.modulo))];
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-tinta">{t("codigosTitulo")}</legend>
      <p className="texto-meta">{t("codigosAyuda")}</p>
      {modulos.map((modulo) => (
        <div key={modulo} className="space-y-1.5">
          <p className="texto-meta font-semibold">{codigos.find((c) => c.modulo === modulo)?.moduloEtiqueta}</p>
          <ul className="space-y-1">
            {codigos.filter((c) => c.modulo === modulo).map((c) => {
              const enOtra = c.cuenta && c.cuenta.id !== cuentaId ? c.cuenta : null;
              return (
                <li key={c.codigo}>
                  <label className="flex min-h-11 items-start gap-3 rounded-control px-1 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={marcados.has(c.codigo)}
                      onChange={(e) => alternar(c.codigo, e.target.checked)}
                      className="mt-0.5 size-4 accent-marca-500"
                    />
                    <span>
                      <span className="font-medium text-tinta">{c.nombre}</span>
                      <span className="texto-meta"> · {tc(c.naturaleza)}</span>
                      {enOtra && marcados.has(c.codigo) && (
                        <span className="texto-meta flex items-center gap-1">
                          <CircleAlert className="size-4 shrink-0" />
                          {t("codigosMover", { cuenta: `${enOtra.codigo} · ${enOtra.nombre}` })}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={guardar} cargando={pendiente}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("codigosGuardar")}
        </Button>
        <span role="status" aria-live="polite" className="texto-meta inline-flex items-center gap-1">
          {resultado === "ok" ? (
            <><Check className="size-4 text-marca-500" />{t("codigosGuardado")}</>
          ) : resultado ? (
            <><CircleAlert className="size-4" />{te((resultado in ERRORES ? resultado : "error") as "error")}</>
          ) : null}
        </span>
      </div>
    </fieldset>
  );
}

const ERRORES: Record<string, true> = {
  no_permitido: true, codigo_desconocido: true, naturaleza_invalida: true, cuenta_invalida: true, datos_invalidos: true, error: true,
};
