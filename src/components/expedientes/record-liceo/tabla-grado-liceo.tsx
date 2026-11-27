"use client";

import { AlertCircle, Info, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASE_SELECT } from "@/components/universidades/formularios";
import { anioEscolar, CONFIANZA_REVISAR, GRADO_MAXIMO, GRADO_MINIMO, MAXIMO_NOTAS_POR_GRADO, leerNumero, promediosDelRecord, type GradoLiceo, type NotaLiceo } from "@/lib/record-liceo";

const GRADOS = Array.from({ length: GRADO_MAXIMO - GRADO_MINIMO + 1 }, (_, i) => GRADO_MINIMO + i);

/**
 * Un grado del récord para revisar o escribir: grado, año, centro y una fila por
 * materia. Lo dudoso se marca con icono y texto (no solo con color) para que se
 * lea igual en grises. Es un componente controlado: el estado vive en el editor.
 */
export function TablaGradoLiceo({ valor, onCambio, onQuitar, indice }: { valor: GradoLiceo; onCambio: (g: GradoLiceo) => void; onQuitar: () => void; indice: number }) {
  const t = useTranslations("recordLiceo");
  const promedio = promediosDelRecord([valor]).global;

  const cambiarNota = (i: number, cambio: Partial<NotaLiceo>) => onCambio({ ...valor, notas: valor.notas.map((n, j) => (j === i ? { ...n, ...cambio } : n)) });

  return (
    <div className="space-y-3 rounded-card border border-linea p-4">
      <div className="grid gap-3 sm:grid-cols-[8rem_8rem_1fr_auto] sm:items-end">
        <label className="space-y-1.5 text-sm font-medium">
          {t("editor.fieldGrade")}
          <select className={CLASE_SELECT} value={valor.grado} onChange={(e) => onCambio({ ...valor, grado: Number(e.target.value) })}>
            {GRADOS.map((g) => <option key={g} value={g}>{t("grade", { grade: g })}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          {t("editor.fieldYear")}
          <Input inputMode="numeric" value={String(valor.anioInicio || "")} onChange={(e) => onCambio({ ...valor, anioInicio: Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || 0 })} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          {t("editor.fieldSchool")}
          <Input value={valor.centro} maxLength={160} onChange={(e) => onCambio({ ...valor, centro: e.target.value })} />
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onQuitar} aria-label={`${t("actions.removeGrade")} ${indice + 1}`}>
          <Trash2 className="size-4" />
          <span className="sm:hidden">{t("actions.removeGrade")}</span>
        </Button>
      </div>

      <p className="texto-meta">
        {valor.anioInicio ? t("schoolYear", { year: anioEscolar(valor.anioInicio) }) : ""}
        {promedio !== null && ` · ${t("gradeAverage", { value: promedio.toFixed(2) })}`}
      </p>

      <ul className="divide-y divide-linea">
        {valor.notas.map((n, i) => {
          const sinLeer = n.nota === null;
          const dudosa = !sinLeer && n.confianza !== null && n.confianza !== undefined && n.confianza < CONFIANZA_REVISAR;

          return (
            <li key={i} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2 py-2 sm:grid-cols-[1fr_6rem_auto_auto]">
              <Input aria-label={t("subject")} value={n.materia} maxLength={120} onChange={(e) => cambiarNota(i, { materia: e.target.value })} />
              <Input
                aria-label={t("score")}
                aria-invalid={sinLeer || (n.nota !== null && (n.nota < 0 || n.nota > 100))}
                inputMode="decimal"
                value={n.nota === null ? "" : String(n.nota)}
                onChange={(e) => {
                  const crudo = e.target.value.replace(",", ".");
                  const num = crudo.trim() === "" ? null : leerNumero(crudo);

                  // Se escribe lo que se pueda leer; lo demás se queda como estaba para no perder lo tecleado.
                  if (crudo.trim() === "" || num !== null) cambiarNota(i, { nota: num, confianza: null });
                }}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => onCambio({ ...valor, notas: valor.notas.filter((_, j) => j !== i) })} aria-label={t("actions.removeSubject")}>
                <Trash2 className="size-4" />
              </Button>
              <label className="col-span-3 flex items-center gap-2 text-xs text-tinta-2 sm:col-span-1 sm:order-3">
                <input type="checkbox" className="size-4 accent-marca-500" checked={n.esModulo} onChange={(e) => cambiarNota(i, { esModulo: e.target.checked })} />
                {t("module")}
              </label>
              {(sinLeer || dudosa) && (
                <p className="col-span-3 flex items-center gap-1.5 text-xs font-medium text-tinta">
                  {sinLeer ? <AlertCircle className="size-3.5" /> : <Info className="size-3.5" />}
                  {sinLeer ? t("editor.missingMark") : t("editor.doubtfulMark")}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {valor.notas.length < MAXIMO_NOTAS_POR_GRADO && (
        <Button type="button" variant="outline" size="sm" onClick={() => onCambio({ ...valor, notas: [...valor.notas, { materia: "", esModulo: false, nota: null }] })}>
          <Plus className="size-4" />
          {t("actions.addSubject")}
        </Button>
      )}
    </div>
  );
}
