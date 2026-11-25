"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { AlertCircle, ExternalLink, GitBranch, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { fechaCorta } from "@/lib/fechas";
import {
  diasEntre,
  type BarraTiempo,
  type CambioDeFechas,
  type SeccionTiempo,
} from "@/lib/linea-tiempo";
import { cn } from "@/lib/utils";

import type { EnlaceGantt, EscalaGantt, TareaGantt } from "./gantt-base-lienzo";

/** SVAR toca el DOM al importarse: solo se carga en el navegador. */
const GanttLienzo = dynamic(() => import("./gantt-base-lienzo").then((m) => m.GanttLienzo), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full rounded-card" />,
});

const claveDe = (barra: BarraTiempo) => `${barra.clase}:${barra.id}`;

/** Misma regla de siempre: lo corto se ve por días, lo largo por meses. */
const escalaPara = (dias: number): EscalaGantt => (dias <= 75 ? "dia" : dias <= 220 ? "semana" : "mes");

const ESCALAS: { valor: EscalaGantt; clave: "dayScale" | "weekScale" | "monthScale" }[] = [
  { valor: "dia", clave: "dayScale" },
  { valor: "semana", clave: "weekScale" },
  { valor: "mes", clave: "monthScale" },
];

/** El diagrama necesita ancho: bajo `md` se dibuja una lista por fechas. */
const consulta = "(min-width: 768px)";
const suscribir = (aviso: () => void) => {
  const m = window.matchMedia(consulta);
  m.addEventListener("change", aviso);
  return () => m.removeEventListener("change", aviso);
};

/**
 * Línea de tiempo y Gantt compartidos (SVAR Gantt con los tokens del sistema):
 * la usan el panorama general, el detalle de un proyecto y los vencimientos de
 * cuentas por pagar, para que se vean y se comporten igual.
 *
 * Es de solo lectura salvo que la página pase `alMover`: entonces las barras
 * `editable` se mueven y se estiran, y el cambio se manda a esa acción de
 * servidor, que vuelve a validar el permiso. Si el servidor lo rechaza se
 * restauran las fechas (se vuelve a montar el diagrama con los datos
 * originales). Aquí `editable` solo evita ofrecer lo que va a fallar.
 */
export function GanttBase({
  secciones,
  inicio,
  fin,
  hoy,
  alMover,
}: {
  secciones: SeccionTiempo[];
  inicio: string;
  fin: string;
  hoy: string;
  alMover?: (cambio: CambioDeFechas) => Promise<{ ok: boolean }>;
}) {
  const t = useTranslations("lineaTiempo");
  const idioma = useLocale() === "en" ? "en" : "es";
  const escritorio = useSyncExternalStore(
    suscribir,
    () => window.matchMedia(consulta).matches,
    () => true,
  );

  const [escala, setEscala] = useState<EscalaGantt>(() => escalaPara(diasEntre(inicio, fin) + 1));
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [cambios, setCambios] = useState<Record<string, { inicio: string; fin: string }>>({});
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [guardando, iniciar] = useTransition();
  const api = useRef<{ exec: (accion: string, datos?: unknown) => unknown } | null>(null);

  const visibles = useMemo(() => secciones.filter((s) => s.barras.length > 0), [secciones]);
  const todas = useMemo(() => visibles.flatMap((s) => s.barras), [visibles]);
  const porClave = useMemo(() => new Map(todas.map((b) => [claveDe(b), b])), [todas]);
  const clavePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of todas) if (!m.has(b.id)) m.set(b.id, claveDe(b));
    return m;
  }, [todas]);
  const elegida = seleccion ? (porClave.get(seleccion) ?? null) : null;
  const editable = Boolean(alMover) && todas.some((b) => b.editable);

  const dia = (d: string) => {
    const [a, m, n] = d.split("-").map(Number);
    return new Date(a, m - 1, n);
  };

  const { tareas, enlaces } = useMemo(() => {
    const tareas: TareaGantt[] = [];
    const enlaces: EnlaceGantt[] = [];
    for (const seccion of visibles) {
      const idSeccion = `seccion:${seccion.clave}`;
      const desde = seccion.barras.reduce((m, b) => (b.inicio < m ? b.inicio : m), seccion.barras[0].inicio);
      const hasta = seccion.barras.reduce((m, b) => (b.fin > m ? b.fin : m), seccion.barras[0].fin);
      tareas.push({
        id: idSeccion,
        text: seccion.titulo,
        type: "summary",
        open: true,
        seccion: true,
        total: seccion.barras.length,
        start: dia(desde),
        end: new Date(dia(hasta).getTime() + 86_400_000),
      });
      for (const b of seccion.barras) {
        const clave = claveDe(b);
        const hito = Boolean(b.hito);
        tareas.push({
          id: clave,
          parent: idSeccion,
          text: b.titulo,
          type: hito ? "milestone" : "task",
          start: dia(b.inicio),
          // El fin de la librería es exclusivo: la barra de un día va de d a d+1.
          end: new Date(dia(hito ? b.inicio : b.fin).getTime() + 86_400_000),
          progress: b.progreso,
          tono: b.tono ?? "marca",
          aviso: b.aviso,
          editable: b.editable && Boolean(alMover),
          clase: b.clase,
          claseEtiqueta: b.claseEtiqueta,
          grupo: b.grupo,
          detalle: b.detalle,
          marcas: b.marcas,
        });
        for (const origen of b.dependenciasIds ?? []) {
          const claveOrigen = clavePorId.get(origen);
          if (claveOrigen) {
            enlaces.push({ id: `${claveOrigen}->${clave}`, source: claveOrigen, target: clave, type: "e2s" });
          }
        }
      }
    }
    return { tareas, enlaces };
  }, [visibles, clavePorId, alMover]);

  const guardar = useCallback(
    (id: string, desde: string, hasta: string) => {
      const barra = porClave.get(id);
      if (!alMover || !barra?.editable) return;
      const previo = cambios[id] ?? { inicio: barra.inicio, fin: barra.fin };
      if (previo.inicio === desde && previo.fin === hasta) return;

      setError(false);
      setCambios((c) => ({ ...c, [id]: { inicio: desde, fin: hasta } }));
      iniciar(async () => {
        const res = await alMover({ id: barra.id, clase: barra.clase, inicio: desde, fin: hasta });
        if (!res.ok) {
          setCambios((c) => {
            const { [id]: _descartado, ...resto } = c;
            return resto;
          });
          setError(true);
          setVersion((v) => v + 1);
        }
      });
    },
    [alMover, cambios, porClave],
  );

  const fechasDe = (b: BarraTiempo) => cambios[claveDe(b)] ?? { inicio: b.inicio, fin: b.fin };
  const hayHoy = hoy >= inicio && hoy <= fin;

  const irAHoy = () => {
    api.current?.exec("scroll-chart", { date: new Date(dia(hoy).getTime() - 5 * 86_400_000) });
  };

  return (
    <div className="animate-entrada space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("scale")} className="bg-muted inline-flex rounded-full p-1">
          {ESCALAS.map(({ valor, clave }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={escala === valor}
              onClick={() => setEscala(valor)}
              className={cn(
                "min-h-9 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors duration-(--duracion-rapida)",
                escala === valor ? "bg-background text-tinta shadow-card" : "text-tinta-2 hover:text-tinta",
              )}
            >
              {t(clave)}
            </button>
          ))}
        </div>

        {hayHoy && escritorio && (
          <Button type="button" variant="outline" size="sm" onClick={irAHoy}>
            {t("goToToday")}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-3 rounded-card bg-tinta p-4 text-sm text-background">
          <AlertCircle className="size-5 shrink-0" />
          {t("moveError")}
        </p>
      )}

      {escritorio ? (
        <div aria-busy={guardando}>
          <GanttLienzo
            key={`${escala}-${version}`}
            tareas={tareas}
            enlaces={enlaces}
            inicio={inicio}
            fin={fin}
            hoy={hoy}
            escala={escala}
            idioma={idioma}
            editable={editable}
            etiquetas={{
              tarea: t("task"),
              hoy: t("today"),
              programada: t("scheduled"),
              atencion: t("attention"),
            }}
            alCambiarFechas={guardar}
            alSeleccionar={setSeleccion}
            apiRef={(a) => {
              api.current = a;
            }}
          />
        </div>
      ) : (
        // Móvil: lista por fechas; el diagrama no cabe y arrastrar con el pulgar
        // estorbaría al desplazar la página.
        <div className="space-y-6">
          {visibles.map((seccion) => (
            <section key={seccion.clave} className="space-y-2">
              <h3 className="texto-meta font-medium uppercase">{seccion.titulo}</h3>
              <ul className="space-y-2">
                {seccion.barras.map((barra) => {
                  const f = fechasDe(barra);
                  const clave = claveDe(barra);
                  return (
                    <li key={clave}>
                      <button
                        type="button"
                        onClick={() => setSeleccion((a) => (a === clave ? null : clave))}
                        aria-pressed={seleccion === clave}
                        className={cn(
                          "w-full cursor-pointer rounded-card border border-linea bg-card p-4 text-left shadow-card transition-colors",
                          seleccion === clave && "bg-marca-50",
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium text-tinta">
                          {barra.aviso && <AlertCircle className="size-4 shrink-0" aria-label={t("attention")} />}
                          {barra.titulo}
                        </span>
                        <span className="mt-2 block text-xs text-tinta-2 tabular-nums">
                          {fechaCorta(f.inicio, idioma)} → {fechaCorta(f.fin, idioma)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {elegida && (
        <aside
          aria-live="polite"
          className="animate-escala-entrada rounded-card border border-linea bg-card p-5 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="texto-meta">{[elegida.claseEtiqueta, elegida.grupo].filter(Boolean).join(" · ")}</p>
              <h3 className="texto-titulo-tarjeta">{elegida.titulo}</h3>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={t("close")} onClick={() => setSeleccion(null)}>
              <X className="size-4" />
            </Button>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="texto-meta">{t("start")}</dt>
              <dd className="font-medium text-tinta tabular-nums">{fechaCorta(fechasDe(elegida).inicio, idioma)}</dd>
            </div>
            <div>
              <dt className="texto-meta">{t("end")}</dt>
              <dd className="font-medium text-tinta tabular-nums">{fechaCorta(fechasDe(elegida).fin, idioma)}</dd>
            </div>
            {elegida.detalle && (
              <div className="col-span-2">
                <dt className="sr-only">{elegida.claseEtiqueta}</dt>
                <dd className="font-medium text-tinta">{elegida.detalle}</dd>
              </div>
            )}
            {elegida.marcas?.map((m) => (
              <div key={m.fecha}>
                <dt className="texto-meta">{m.etiqueta}</dt>
                <dd className="font-medium text-tinta tabular-nums">{fechaCorta(m.fecha, idioma)}</dd>
              </div>
            ))}
            {elegida.dependenciasIds && elegida.dependenciasIds.length > 0 && (
              <div className="col-span-2 sm:col-span-4">
                <dt className="texto-meta flex items-center gap-1.5">
                  <GitBranch className="size-3.5 text-marca-600" aria-hidden />
                  {t("dependsOn")}
                </dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {elegida.dependenciasIds.map((depId) => {
                    const clave = clavePorId.get(depId);
                    const predecesora = clave ? porClave.get(clave) : undefined;
                    if (!clave || !predecesora) return null;
                    return (
                      <button
                        key={depId}
                        type="button"
                        onClick={() => {
                          setSeleccion(clave);
                          api.current?.exec("select-task", { id: clave, show: "xy" });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-marca-500/15 px-2.5 py-1 text-xs font-medium text-marca-700 transition-colors hover:bg-marca-500/25"
                      >
                        <GitBranch className="size-3" aria-hidden />
                        <span>{predecesora.titulo}</span>
                      </button>
                    );
                  })}
                </dd>
              </div>
            )}
          </dl>

          {elegida.enlace && (
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href={elegida.enlace}>
                <ExternalLink className="size-4" />
                {t("open")}
              </Link>
            </Button>
          )}
        </aside>
      )}
    </div>
  );
}
