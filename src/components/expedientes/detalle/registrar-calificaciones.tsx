"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { CLASE_SELECT } from "@/components/universidades/formularios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { registrarCalificaciones, type EstadoCalificaciones } from "@/server/universidades/calificaciones";

export type MateriaPorCalificar = {
  codigo: string;
  nombre: string;
  creditos: number;
  periodoSugerido: number | null;
  /** `pendiente` o `cursando` faltan por dar; `reprobada` y `retirada` se pueden volver a cursar. */
  estado: "pendiente" | "cursando" | "reprobada" | "retirada";
};

export type LetraDeUniversidad = { letra: string; puntos: number };

/** Cuatrimestre del año según el mes, para que casi siempre quede bien sin tocarlo. */
const rondaSugerida = () => {
  const mes = new Date().getMonth();

  return mes < 4 ? 1 : mes < 8 ? 2 : 3;
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Poner las notas de un estudiante sin escribir nada a mano: se elige el período,
 * se ven SOLO las materias que le faltan y se marca la nota de cada una. Lo que se
 * deja sin nota no se toca. El pénsum, el índice y las alertas se actualizan solos.
 * Por debajo usa `registrarCalificaciones`, que valida contra su pénsum y las
 * letras de su universidad (todo o nada).
 */
export function RegistrarCalificaciones({
  estudianteId,
  materias,
  letras,
}: {
  estudianteId: string;
  materias: MateriaPorCalificar[];
  letras: LetraDeUniversidad[];
}) {
  const t = useTranslations("catalog.grades");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [ronda, setRonda] = useState(rondaSugerida());
  const [verTodas, setVerTodas] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [notas, setNotas] = useState<Record<string, { letra: string; nota: string }>>({});
  const [estado, enviar, enviando] = useActionState<EstadoCalificaciones, FormData>(async (previo, datos) => {
    const r = await registrarCalificaciones(previo, datos);

    if (r.estado === "ok") setNotas({});

    return r;
  }, { estado: "inicial" });

  const faltan = materias.filter((m) => m.estado === "pendiente" || m.estado === "cursando").length;
  const visibles = useMemo(() => {
    const q = sinAcentos(buscar).trim();

    return materias
      .filter((m) => verTodas || m.estado === "pendiente" || m.estado === "cursando")
      .filter((m) => !q || sinAcentos(`${m.codigo} ${m.nombre}`).includes(q))
      .sort((a, b) => (a.periodoSugerido ?? 99) - (b.periodoSugerido ?? 99) || a.codigo.localeCompare(b.codigo));
  }, [materias, verTodas, buscar]);

  const puestas = Object.entries(notas).filter(([, v]) => v.letra);
  const lista = puestas.map(([codigo, v]) => `${codigo};${v.letra};${v.nota}`).join("\n");

  const poner = (codigo: string, cambio: Partial<{ letra: string; nota: string }>) =>
    setNotas((n) => ({ ...n, [codigo]: { ...(n[codigo] ?? { letra: "", nota: "" }), ...cambio } }));

  return (
    <form action={enviar} className="space-y-5 rounded-card border border-linea bg-card p-4 sm:p-6">
      <input type="hidden" name="estudiante" value={estudianteId} />
      <input type="hidden" name="periodo" value={`${anio}-${ronda}`} />
      <input type="hidden" name="lista" value={lista} />

      <section className="space-y-2">
        <h3 className="texto-titulo-tarjeta">{t("step1")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cal-anio">{t("year")}</Label>
            <Input id="cal-anio" type="number" inputMode="numeric" min={2000} max={new Date().getFullYear() + 1} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cal-ronda">{t("term")}</Label>
            <select id="cal-ronda" value={ronda} onChange={(e) => setRonda(Number(e.target.value))} className={CLASE_SELECT}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{t("termOption", { n })}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="texto-titulo-tarjeta">{t("step2")}</h3>
        <p className="texto-meta">{faltan > 0 ? t("missing", { count: faltan }) : t("nothingMissing")}</p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-3" />
          <Input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} className="size-4" />
          {t("showRetakes")}
        </label>

        {visibles.length === 0 ? (
          <p className="texto-meta">{t("noMatches")}</p>
        ) : (
          <ul className="max-h-[28rem] divide-y divide-linea overflow-y-auto rounded-control border border-linea">
            {visibles.map((m) => {
              const actual = notas[m.codigo];

              return (
                <li key={m.codigo} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">{m.nombre}</p>
                    <p className="texto-meta">
                      {m.codigo} · {t("credits", { count: m.creditos })}
                      {m.estado === "reprobada" && ` · ${t("failed")}`}
                      {m.estado === "retirada" && ` · ${t("withdrawn")}`}
                    </p>
                  </div>
                  <select
                    aria-label={t("gradeFor", { subject: m.nombre })}
                    value={actual?.letra ?? ""}
                    onChange={(e) => poner(m.codigo, { letra: e.target.value })}
                    className={`${CLASE_SELECT} w-44`}
                  >
                    <option value="">{t("noGrade")}</option>
                    {letras.map((l) => <option key={l.letra} value={l.letra}>{t("letterOption", { letter: l.letra, points: l.puntos })}</option>)}
                    <option value="R">{t("withdrawnOption")}</option>
                  </select>
                  {actual?.letra && actual.letra !== "R" && (
                    <Input
                      aria-label={t("scoreFor", { subject: m.nombre })}
                      inputMode="decimal"
                      placeholder={t("score")}
                      value={actual.nota}
                      onChange={(e) => poner(m.codigo, { nota: e.target.value })}
                      className="w-24"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {estado.estado === "ok" && (
        <p role="status" className="flex items-start gap-2 text-sm font-medium">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-marca-700" />
          {t("saved", { count: estado.guardadas ?? 0 })}
        </p>
      )}
      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{t(`errors.${estado.estado}`)}</span>
        </p>
      )}

      <Button type="submit" disabled={enviando || puestas.length === 0} className="w-full sm:w-auto">
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {puestas.length === 0 ? t("saveNone") : t("saveCount", { count: puestas.length })}
      </Button>
    </form>
  );
}
