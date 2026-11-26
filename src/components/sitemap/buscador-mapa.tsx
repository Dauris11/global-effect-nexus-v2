"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Lock, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { EntradaIndice } from "@/server/mapa-sitio/indice";

/**
 * «¿Dónde está…?». Busca en el índice derivado de los menús reales y dice cómo
 * llegar (el camino por el menú) y si la cuenta puede abrirlo.
 *
 * La búsqueda no exige que cada palabra coincida: «dónde veo la base de
 * conocimientos del agente ia» no es una frase que aparezca en ninguna etiqueta.
 * Se quitan las palabras vacías, se ignoran tildes y plurales y se ordena por
 * cuántas palabras acierta cada pantalla.
 */

const VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "en", "a", "al", "que", "por", "para",
  "donde", "dónde", "esta", "está", "ver", "veo", "puedo", "como", "cómo", "se", "mi", "mis", "hay",
  "where", "is", "the", "of", "to", "see", "find", "how", "do", "i", "can", "my", "a", "an", "and",
]);

const limpiar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** «conocimientos» → «conocimiento»: un plural simple no debe impedir el acierto. */
const raiz = (p: string) => (p.length > 4 && p.endsWith("s") ? p.slice(0, -1) : p);

type Textos = {
  placeholder: string;
  vacio: string;
  comoLlegar: string;
  abrir: string;
  sinAcceso: string;
  roles: string;
  resultados: string;
};

export function BuscadorMapa({ entradas, textos }: { entradas: readonly EntradaIndice[]; textos: Textos }) {
  const [consulta, setConsulta] = useState("");

  const indexadas = useMemo(
    () =>
      entradas.map((e) => ({
        e,
        palabras: limpiar(`${e.etiqueta} ${e.descripcion ?? ""} ${e.camino} ${e.claves} ${e.href} ${e.permiso ?? ""}`)
          .split(/[^a-z0-9]+/)
          .filter(Boolean)
          .map(raiz),
      })),
    [entradas],
  );

  const resultados = useMemo(() => {
    const tokens = limpiar(consulta)
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !VACIAS.has(t))
      .map(raiz);

    if (tokens.length === 0) return [];

    return indexadas
      .map(({ e, palabras }) => ({
        e,
        puntos: tokens.filter((t) => palabras.some((p) => p.startsWith(t))).length,
      }))
      .filter((r) => r.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos || Number(b.e.puedo) - Number(a.e.puedo) || a.e.etiqueta.localeCompare(b.e.etiqueta))
      .slice(0, 8);
  }, [consulta, indexadas]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-tinta-3 pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
        <Input
          type="search"
          value={consulta}
          onChange={(ev) => setConsulta(ev.target.value)}
          placeholder={textos.placeholder}
          aria-label={textos.placeholder}
          className="pl-12"
        />
      </div>

      {consulta.trim() === "" ? null : resultados.length === 0 ? (
        <p role="status" className="text-sm">
          {textos.vacio}
        </p>
      ) : (
        <ul className="space-y-2" aria-label={textos.resultados}>
          {resultados.map(({ e }) => (
            <li key={e.id} className="rounded-card border border-linea p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold break-words">{e.etiqueta}</p>
                </div>

                {e.puedo ? (
                  <Link
                    href={e.href}
                    className="text-marca-700 hover:text-marca-600 inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
                  >
                    {textos.abrir}
                    <ChevronRight className="size-4" />
                  </Link>
                ) : (
                  <span className="text-tinta-3 inline-flex min-h-11 items-center gap-1 text-sm">
                    <Lock className="size-4" />
                    {textos.sinAcceso}
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm">
                <span className="text-tinta-3">{textos.comoLlegar}: </span>
                {e.camino}
              </p>
              <p className="texto-meta font-mono break-all">{e.href}</p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="texto-meta">{textos.roles}:</span>
                {e.roles.map((r) => (
                  <Badge key={r} variant="neutra">
                    {r}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
