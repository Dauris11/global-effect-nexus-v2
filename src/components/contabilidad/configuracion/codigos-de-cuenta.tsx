"use client";

import { useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, CircleAlert, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ComboboxBuscador } from "@/components/ui/combobox-buscador";
import { asignarCodigosACuenta } from "@/server/contabilidad/codigos-transaccion/acciones";
import type { CodigoConfigurado } from "@/server/contabilidad/codigos-transaccion/consultas";

/**
 * Códigos de transacción de una cuenta de movimiento, con buscador: el
 * catálogo llega a cientos de códigos y una lista de casillas abierta ahogaba
 * el diálogo. Se guarda aparte del formulario de la cuenta: darle propósito a
 * una cuenta no depende de que tenga asientos, así que no pasa por las reglas
 * que bloquean cambiar su código o su tipo.
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
  const [elegidos, setElegidos] = useState<string[]>(
    () => codigos.filter((c) => c.cuenta?.id === cuentaId).map((c) => c.codigo),
  );
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);

  if (codigos.length === 0) return <p className="texto-meta">{t("codigosVacio")}</p>;

  const guardar = () =>
    iniciar(async () => {
      const r = await asignarCodigosACuenta(cuentaId, elegidos);
      setResultado(r.estado);
    });

  // El lado va con icono además del texto: débito y crédito no se distinguen por color.
  const Lado = ({ c }: { c: CodigoConfigurado }) => {
    const Icono = c.naturaleza === "debito" ? ArrowDownLeft : ArrowUpRight;
    return (
      <span className="texto-meta inline-flex items-center gap-1">
        <Icono className="size-4 shrink-0" />
        {tc(c.naturaleza)}
      </span>
    );
  };
  const enOtra = (c: CodigoConfigurado) => (c.cuenta && c.cuenta.id !== cuentaId ? c.cuenta : null);
  const aviso = (c: CodigoConfigurado) => {
    const otra = enOtra(c);
    return otra ? (
      <span className="texto-meta flex items-start gap-1">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        {t("codigosMover", { cuenta: `${otra.codigo} · ${otra.nombre}` })}
      </span>
    ) : null;
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-tinta">{t("codigosTitulo")}</legend>
      <p className="texto-meta">{t("codigosAyuda")}</p>
      <ComboboxBuscador
        opciones={codigos}
        obtenerValor={(c) => c.codigo}
        textoBusqueda={(c) => `${c.nombre} ${c.codigo} ${c.moduloEtiqueta} ${c.proceso}`}
        valores={elegidos}
        onCambiar={(v) => {
          setResultado(null);
          setElegidos(v);
        }}
        etiquetaBusqueda={t("codigosBuscarEtiqueta")}
        placeholder={t("codigosBuscar")}
        textoSinResultados={t("codigosSinResultados")}
        textoMas={(n) => t("codigosMas", { n })}
        anunciarResultados={(n) => t("codigosResultados", { n })}
        etiquetaQuitar={(c) => t("codigosQuitar", { nombre: c.nombre })}
        renderOpcion={(c) => (
          <span className="block">
            <span className="font-medium text-tinta">{c.nombre}</span>
            <span className="texto-meta flex flex-wrap items-center gap-x-3">
              <span>{c.moduloEtiqueta}</span>
              <Lado c={c} />
            </span>
            {aviso(c)}
          </span>
        )}
        renderChip={(c) => (
          <span className="block">
            <span className="font-medium text-tinta">{c.nombre}</span>
            <span className="texto-meta flex flex-wrap items-center gap-x-3">
              <span>{c.moduloEtiqueta}</span>
              <Lado c={c} />
            </span>
            {aviso(c)}
          </span>
        )}
      />
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
