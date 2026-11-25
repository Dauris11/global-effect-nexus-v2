"use client";

import { useState, useTransition } from "react";
import { BookOpen, Check, CircleAlert, ListChecks, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { TARJETA } from "@/lib/paleta";
import { guardarNaturalezaCodigo } from "@/server/contabilidad/codigos-transaccion/acciones";
import type { CodigoConfigurado } from "@/server/contabilidad/codigos-transaccion/consultas";

type Resultado = { tipo: "guardado" } | { tipo: "error"; estado: string };

/**
 * Los códigos de transacción agrupados por módulo. Aquí solo se elige el lado
 * (débito o crédito); la cuenta se asigna desde el Catálogo, y los códigos
 * nuevos se añaden en el código del sistema, no en pantalla.
 */
export function SeccionCodigos({
  codigos,
  puedeEditar,
}: {
  codigos: CodigoConfigurado[];
  puedeEditar: boolean;
}) {
  const t = useTranslations("contab.config.codigos");
  const [pendiente, iniciar] = useTransition();
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  // El valor mostrado cambia al instante; si el servidor rechaza, se revierte.
  const [elegidos, setElegidos] = useState<Record<string, string>>({});

  if (codigos.length === 0) return <EstadoVacio icono={ListChecks} titulo={t("vacioTitulo")} />;

  const cambiar = (c: CodigoConfigurado, valor: string) => {
    setElegidos((p) => ({ ...p, [c.codigo]: valor }));
    setEnCurso(c.codigo);
    iniciar(async () => {
      const r = await guardarNaturalezaCodigo(c.codigo, valor);
      setResultados((p) => ({ ...p, [c.codigo]: r.estado === "ok" ? { tipo: "guardado" } : { tipo: "error", estado: r.estado } }));
      if (r.estado !== "ok") setElegidos((p) => ({ ...p, [c.codigo]: c.naturaleza }));
      setEnCurso(null);
    });
  };

  const selector = (c: CodigoConfigurado) => {
    const valor = elegidos[c.codigo] ?? c.naturaleza;
    const r = resultados[c.codigo];
    return (
      <div className="flex items-center gap-2">
        <Select value={valor} onValueChange={(v) => cambiar(c, v)} disabled={!puedeEditar || (pendiente && enCurso === c.codigo)}>
          <SelectTrigger className="w-36" aria-label={t("ladoDe", { codigo: c.nombre })}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="debito">{t("debito")}</SelectItem>
            <SelectItem value="credito">{t("credito")}</SelectItem>
          </SelectContent>
        </Select>
        <span role="status" aria-live="polite" className="texto-meta inline-flex min-w-20 items-center gap-1">
          {enCurso === c.codigo && pendiente ? (
            <><Loader2 className="size-4 animate-spin" />{t("guardando")}</>
          ) : r?.tipo === "guardado" ? (
            <><Check className="size-4 text-marca-500" />{t("guardado")}</>
          ) : r?.tipo === "error" ? (
            <><CircleAlert className="size-4" />{t(`error.${r.estado}` as "error.error")}</>
          ) : null}
        </span>
      </div>
    );
  };

  const cuenta = (c: CodigoConfigurado) =>
    c.cuenta ? (
      <span className="inline-flex items-center gap-1.5 text-sm text-tinta">
        <BookOpen className="size-4 shrink-0 text-tinta-2" />
        <span className="font-mono text-xs text-tinta-2">{c.cuenta.codigo}</span>
        <span>{c.cuenta.nombre}</span>
        {!c.cuenta.usable && <Badge variant="solida">{t("cuentaInactiva")}</Badge>}
      </span>
    ) : (
      <Link
        href="/contabilidad/configuracion?tab=catalogo"
        className="inline-flex items-center gap-1.5 text-sm text-tinta-2 underline-offset-2 hover:text-marca-600 hover:underline"
        title={t("asignarEnCatalogo")}
      >
        <CircleAlert className="size-4 shrink-0" />
        {t("sinCuenta")}
      </Link>
    );

  const modulos = [...new Set(codigos.map((c) => c.modulo))];
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-[15px] text-tinta-2">{t("explicacion")}</p>
      {modulos.map((modulo) => {
        const filas = codigos.filter((c) => c.modulo === modulo);
        return (
          <section key={modulo} className="space-y-3" aria-labelledby={`modulo-${modulo}`}>
            <h2 id={`modulo-${modulo}`} className="texto-titulo-tarjeta">{filas[0].moduloEtiqueta}</h2>

            <div className={`${TARJETA.contenido} hidden overflow-hidden md:block`}>
              <table className="w-full text-sm">
                <thead className="texto-meta border-b border-linea text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">{t("nombre")}</th>
                    <th className="px-5 py-3 font-medium">{t("proceso")}</th>
                    <th className="px-5 py-3 font-medium">{t("lado")}</th>
                    <th className="px-5 py-3 font-medium">{t("cuenta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((c) => (
                    <tr key={c.codigo} className="border-b border-linea align-middle last:border-0">
                      <td className="px-5 py-2.5">
                        <p className="font-medium text-tinta">{c.nombre}</p>
                        <p className="font-mono text-xs text-tinta-3">{c.codigo}</p>
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs text-tinta-2">{c.proceso}</td>
                      <td className="px-5 py-2.5">{selector(c)}</td>
                      <td className="px-5 py-2.5">{cuenta(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {filas.map((c) => (
                <li key={c.codigo} className={`${TARJETA.contenido} space-y-3 p-4`}>
                  <div>
                    <p className="text-[15px] font-medium text-tinta">{c.nombre}</p>
                    <p className="font-mono text-xs text-tinta-3">{c.codigo} · {c.proceso}</p>
                  </div>
                  {selector(c)}
                  {cuenta(c)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
