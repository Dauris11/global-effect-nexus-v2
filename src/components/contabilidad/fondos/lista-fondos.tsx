"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { FondoItem, FondoLiberacionItem } from "@/server/contabilidad/fondos/consultas";

export function ListaFondos({
  fondos,
  liberaciones,
}: {
  fondos: FondoItem[];
  liberaciones: FondoLiberacionItem[];
}) {
  const t = useTranslations("contab.fondos");

  return (
    <div className="space-y-8">
      {/* 1. Catálogo de Fondos */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-tinta dark:text-slate-100">
          {t("titulo")}
        </h3>

        {fondos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
            {t("sinFondos")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t("nombre")}</th>
                  <th className="px-4 py-3">{t("tipoRestriccion")}</th>
                  <th className="px-4 py-3">{t("donante")}</th>
                  <th className="px-4 py-3 text-right">{t("montoOriginal")}</th>
                  <th className="px-4 py-3 text-right">{t("montoLiberado")}</th>
                  <th className="px-4 py-3 text-right">{t("saldoDisponible")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {fondos.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-tinta dark:text-slate-100">{f.nombre}</div>
                      {f.codigo && <div className="font-mono text-xs text-muted-foreground">{f.codigo}</div>}
                      {f.propositoRestringido && (
                        <div className="text-xs text-muted-foreground italic max-w-xs truncate">{f.propositoRestringido}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          f.tipoRestriccion === "no_restringido"
                            ? "border-linea bg-muted text-tinta"
                            : "border-marca-200 bg-marca-50 text-marca-700"
                        }
                      >
                        {t(f.tipoRestriccion as keyof typeof t)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">
                      {f.donanteNombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-tinta-2 dark:text-slate-300">
                      {f.tipoRestriccion === "no_restringido"
                        ? "—"
                        : `RD$ ${f.montoRestringidoOriginal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-tinta-2 dark:text-slate-300">
                      {f.tipoRestriccion === "no_restringido"
                        ? "—"
                        : `RD$ ${f.montoLiberadoAcumulado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-tinta dark:text-slate-100">
                      {f.tipoRestriccion === "no_restringido"
                        ? "Ilimitado"
                        : `RD$ ${f.saldoRestringidoDisponible.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Historial de Liberaciones */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-tinta dark:text-slate-100">
          {t("historialLiberaciones")}
        </h3>

        {liberaciones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
            {t("sinLiberaciones")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t("fecha")}</th>
                  <th className="px-4 py-3">{t("nombre")}</th>
                  <th className="px-4 py-3">{t("justificacion")}</th>
                  <th className="px-4 py-3">{t("soporte")}</th>
                  <th className="px-4 py-3 text-right">{t("montoLiberado")}</th>
                  <th className="px-4 py-3 text-right">{t("usuario")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {liberaciones.map((lib) => (
                  <tr key={lib.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-tinta-2 dark:text-slate-400">
                      {lib.fechaLiberacion}
                    </td>
                    <td className="px-4 py-3 font-medium text-tinta dark:text-slate-100">
                      {lib.fondoNombre}
                    </td>
                    <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-300 max-w-sm">
                      {lib.justificacion}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {lib.asientoNumero ? (
                        <span className="font-mono font-medium text-marca-600">
                          AS-{String(lib.asientoNumero).padStart(6, "0")}
                        </span>
                      ) : (
                        lib.documentoReferencia || "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-tinta dark:text-slate-100">
                      RD$ {lib.montoLiberado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {lib.creadoPorNombre}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
