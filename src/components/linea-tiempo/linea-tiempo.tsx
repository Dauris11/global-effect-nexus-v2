"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, ExternalLink, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { fechaCorta } from "@/lib/fechas";
import {
  diasEntre,
  escalaPara,
  mesesDelTramo,
  PX_POR_DIA,
  sumarDias,
  type BarraTiempo,
  type CambioDeFechas,
  type EscalaTiempo,
  type SeccionTiempo,
  type TonoBarra,
} from "@/lib/linea-tiempo";
import { cn } from "@/lib/utils";

/** Columna de nombres: queda fija mientras el eje se desplaza. */
const ANCHO_ETIQUETA = 224;

const TONO: Record<TonoBarra, string> = {
  marca: "bg-marca-500 text-white",
  oscuro: "bg-marca-700 text-white",
  tinta: "bg-tinta text-background",
  apagado: "bg-linea-fuerte text-tinta-2",
};

type Modo = "mover" | "inicio" | "fin";

type Arrastre = {
  clave: string;
  modo: Modo;
  x0: number;
  inicio0: string;
  fin0: string;
  dias: number;
};

type Fechas = { inicio: string; fin: string };

const claveDe = (barra: BarraTiempo) => `${barra.clase}:${barra.id}`;

/** Fechas resultantes de un arrastre: nunca deja el fin antes del inicio. */
function derivar({ modo, dias, inicio0, fin0 }: Arrastre): Fechas {
  if (modo === "mover") {
    return { inicio: sumarDias(inicio0, dias), fin: sumarDias(fin0, dias) };
  }
  if (modo === "inicio") {
    const nuevo = sumarDias(inicio0, dias);
    return { inicio: nuevo > fin0 ? fin0 : nuevo, fin: fin0 };
  }
  const nuevo = sumarDias(fin0, dias);
  return { inicio: inicio0, fin: nuevo < inicio0 ? inicio0 : nuevo };
}

/**
 * Línea de tiempo compartida: la usan el panorama general, el detalle de un
 * proyecto y los vencimientos de cuentas por pagar, para que se vean y se
 * comporten igual.
 *
 * Las barras editables se mueven arrastrando el cuerpo y se estiran por los
 * extremos; con teclado, flechas ±1 día y Mayús+flechas para el fin. El cambio
 * se aplica al instante y se revierte si el servidor lo rechaza: el servidor
 * es quien decide, aquí `editable` solo evita ofrecer lo que va a fallar.
 */
export function LineaTiempo({
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

  const totalDias = diasEntre(inicio, fin) + 1;
  const [escala, setEscala] = useState<EscalaTiempo>(() => escalaPara(totalDias));
  const px = PX_POR_DIA[escala];
  const anchoPista = totalDias * px;

  const [cambios, setCambios] = useState<Record<string, Fechas>>({});
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [guardando, iniciar] = useTransition();
  const contenedor = useRef<HTMLDivElement>(null);

  const visibles = useMemo(
    () => secciones.filter((s) => s.barras.length > 0),
    [secciones],
  );
  const todas = useMemo(() => visibles.flatMap((s) => s.barras), [visibles]);
  const elegida = todas.find((b) => claveDe(b) === seleccion) ?? null;

  const fechasDe = (barra: BarraTiempo): Fechas => {
    const clave = claveDe(barra);
    if (arrastre?.clave === clave) return derivar(arrastre);
    return cambios[clave] ?? { inicio: barra.inicio, fin: barra.fin };
  };

  const indiceHoy = diasEntre(inicio, hoy);
  const hayHoy = indiceHoy >= 0 && indiceHoy < totalDias;

  const irAHoy = () => {
    if (!contenedor.current || !hayHoy) return;
    contenedor.current.scrollTo({
      left: Math.max(0, indiceHoy * px - 200),
      behavior: "smooth",
    });
  };

  // Al abrir y al cambiar de escala, lo primero que se ve es hoy.
  useEffect(() => {
    if (!contenedor.current || !hayHoy) return;
    contenedor.current.scrollLeft = Math.max(0, indiceHoy * px - 200);
  }, [hayHoy, indiceHoy, px]);

  const guardar = (barra: BarraTiempo, nuevo: Fechas) => {
    if (!alMover) return;
    const clave = claveDe(barra);
    const previo = cambios[clave] ?? { inicio: barra.inicio, fin: barra.fin };

    setError(false);
    setCambios((c) => ({ ...c, [clave]: nuevo }));
    iniciar(async () => {
      const res = await alMover({
        id: barra.id,
        clase: barra.clase,
        inicio: nuevo.inicio,
        fin: nuevo.fin,
      });
      if (!res.ok) {
        setCambios((c) => ({ ...c, [clave]: previo }));
        setError(true);
      }
    });
  };

  const alternar = (barra: BarraTiempo) => {
    const clave = claveDe(barra);
    setSeleccion((actual) => (actual === clave ? null : clave));
  };

  const puedeEditar = (barra: BarraTiempo) => barra.editable && Boolean(alMover);

  const alPulsar = (e: React.PointerEvent<HTMLDivElement>, barra: BarraTiempo) => {
    if (!puedeEditar(barra)) return;
    const objetivo = (e.target as HTMLElement).dataset.asa as Modo | undefined;
    const { inicio: i, fin: f } = fechasDe(barra);

    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastre({
      clave: claveDe(barra),
      modo: objetivo ?? "mover",
      x0: e.clientX,
      inicio0: i,
      fin0: f,
      dias: 0,
    });
  };

  const alArrastrar = (e: React.PointerEvent<HTMLDivElement>, barra: BarraTiempo) => {
    if (arrastre?.clave !== claveDe(barra)) return;
    const dias = Math.round((e.clientX - arrastre.x0) / px);
    if (dias !== arrastre.dias) setArrastre({ ...arrastre, dias });
  };

  const alSoltar = (barra: BarraTiempo) => {
    if (arrastre?.clave !== claveDe(barra)) return;
    const actual = arrastre;
    setArrastre(null);

    // Sin desplazamiento fue un toque: se abre el detalle.
    if (actual.dias === 0) alternar(barra);
    else guardar(barra, derivar(actual));
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLDivElement>, barra: BarraTiempo) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      alternar(barra);
      return;
    }
    if (!puedeEditar(barra)) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

    e.preventDefault();
    const paso = e.key === "ArrowRight" ? 1 : -1;
    const { inicio: i, fin: f } = fechasDe(barra);
    const nuevo: Fechas = e.shiftKey
      ? { inicio: i, fin: sumarDias(f, paso) < i ? i : sumarDias(f, paso) }
      : { inicio: sumarDias(i, paso), fin: sumarDias(f, paso) };

    guardar(barra, nuevo);
  };

  const meses = useMemo(() => mesesDelTramo(inicio, fin), [inicio, fin]);
  const nombreMes = (mes: number, anio: number) =>
    new Intl.DateTimeFormat(idioma, { month: "short", timeZone: "UTC" })
      .format(Date.UTC(anio, mes, 1))
      .replace(".", "");

  const dias = useMemo(
    () =>
      Array.from({ length: totalDias }, (_, i) => {
        const dia = sumarDias(inicio, i);
        const fecha = new Date(`${dia}T00:00:00Z`);
        return { dia, numero: fecha.getUTCDate(), semana: fecha.getUTCDay() };
      }),
    [inicio, totalDias],
  );

  // Una raya por semana, alineada con el inicio del tramo.
  const rejilla = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${px * 7 - 1}px, var(--color-linea) ${px * 7 - 1}px, var(--color-linea) ${px * 7}px)`,
  };

  const etiquetaBarra = (barra: BarraTiempo) => {
    const f = fechasDe(barra);
    return t("barLabel", {
      title: barra.titulo,
      start: fechaCorta(f.inicio, idioma),
      end: fechaCorta(f.fin, idioma),
    });
  };

  return (
    <div className="animate-entrada space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label={t("scale")}
          className="bg-muted inline-flex rounded-full p-1"
        >
          {(["semana", "mes", "periodo"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              aria-pressed={escala === valor}
              onClick={() => setEscala(valor)}
              className={cn(
                "min-h-9 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors duration-(--duracion-rapida)",
                escala === valor
                  ? "bg-background text-tinta shadow-card"
                  : "text-tinta-2 hover:text-tinta",
              )}
            >
              {t(
                valor === "semana"
                  ? "weekScale"
                  : valor === "mes"
                    ? "monthScale"
                    : "periodScale",
              )}
            </button>
          ))}
        </div>

        {hayHoy && (
          <Button type="button" variant="outline" size="sm" onClick={irAHoy}>
            {t("goToToday")}
          </Button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-3 rounded-card bg-tinta p-4 text-sm text-background"
        >
          <AlertCircle className="size-5 shrink-0" />
          {t("moveError")}
        </p>
      )}

      {/* Escritorio: rejilla con eje. */}
      <div
        ref={contenedor}
        aria-busy={guardando}
        className="sin-barra hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block"
      >
        <div
          className="relative"
          style={{ width: ANCHO_ETIQUETA + anchoPista }}
        >
          <div className="sticky top-0 z-30 flex border-b border-linea bg-card">
            <div
              className="sticky left-0 z-40 shrink-0 border-r border-linea bg-card"
              style={{ width: ANCHO_ETIQUETA }}
            />
            <div style={{ width: anchoPista }}>
              <div className="flex h-7 border-b border-linea">
                {meses.map((m) => (
                  <span
                    key={m.clave}
                    style={{ width: m.dias * px }}
                    className="texto-meta truncate border-r border-linea px-2 py-1 font-medium capitalize last:border-r-0"
                  >
                    {nombreMes(m.mes, m.anio)}
                    {m.mes === 0 || m === meses[0] ? ` ${m.anio}` : ""}
                  </span>
                ))}
              </div>
              {escala !== "periodo" && (
                <div className="flex h-7">
                  {dias.map((d) => (
                    <span
                      key={d.dia}
                      style={{ width: px }}
                      className={cn(
                        "flex items-center justify-center text-[10px] tabular-nums",
                        d.semana === 0 || d.semana === 6
                          ? "text-tinta-3"
                          : "text-tinta-2",
                        d.dia === hoy && "font-semibold text-tinta",
                      )}
                    >
                      {d.numero}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hayHoy && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-tinta"
              style={{ left: ANCHO_ETIQUETA + indiceHoy * px + px / 2 }}
            >
              <span className="absolute top-1 left-1 rounded-full bg-tinta px-2 py-0.5 text-[10px] font-medium text-background">
                {t("today")}
              </span>
            </span>
          )}

          {visibles.map((seccion) => (
            <section key={seccion.clave}>
              <div className="flex border-b border-linea bg-muted/50">
                <p
                  className="texto-meta sticky left-0 z-10 flex items-center justify-between bg-muted/50 px-3 py-1.5 font-medium uppercase"
                  style={{ width: ANCHO_ETIQUETA }}
                >
                  <span className="truncate">{seccion.titulo}</span>
                  <span className="tabular-nums">{seccion.barras.length}</span>
                </p>
              </div>

              {seccion.barras.map((barra) => {
                const clave = claveDe(barra);
                const f = fechasDe(barra);
                const izquierda = diasEntre(inicio, f.inicio) * px;
                const ancho = (diasEntre(f.inicio, f.fin) + 1) * px;
                const editable = puedeEditar(barra);
                const activa = seleccion === clave;
                const moviendo = arrastre?.clave === clave;
                const dentro = ancho >= 110 && !barra.hito;

                return (
                  <div
                    key={clave}
                    className={cn(
                      "flex border-b border-linea transition-colors last:border-b-0",
                      activa && "bg-marca-50/50",
                    )}
                  >
                    <div
                      className={cn(
                        "sticky left-0 z-10 shrink-0 border-r border-linea px-3 py-2",
                        activa ? "bg-marca-50" : "bg-card",
                      )}
                      style={{ width: ANCHO_ETIQUETA }}
                    >
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-tinta">
                        {barra.aviso && (
                          <AlertCircle
                            className="size-3.5 shrink-0"
                            aria-label={t("attention")}
                          />
                        )}
                        <span className="truncate">{barra.titulo}</span>
                      </p>
                      <p className="texto-meta truncate">
                        {[barra.claseEtiqueta, barra.grupo]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <div
                      className="relative h-14"
                      style={{ width: anchoPista, ...rejilla }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={etiquetaBarra(barra)}
                        aria-pressed={activa}
                        onPointerDown={(e) => alPulsar(e, barra)}
                        onPointerMove={(e) => alArrastrar(e, barra)}
                        onPointerUp={() => alSoltar(barra)}
                        onPointerCancel={() => setArrastre(null)}
                        onClick={editable ? undefined : () => alternar(barra)}
                        onKeyDown={(e) => alTeclear(e, barra)}
                        style={{
                          left: izquierda,
                          width: barra.hito ? px : ancho,
                          touchAction: editable ? "none" : undefined,
                        }}
                        className={cn(
                          "absolute top-3 flex h-8 items-center outline-none select-none",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          barra.hito
                            ? "justify-center"
                            : cn(
                                "overflow-hidden rounded-full px-3 text-xs font-medium",
                                TONO[barra.tono ?? "marca"],
                              ),
                          editable
                            ? moviendo
                              ? "cursor-grabbing shadow-elevada"
                              : "cursor-grab hover:shadow-card"
                            : "cursor-pointer",
                          !moviendo &&
                            "transition-[left,width,box-shadow] duration-(--duracion-media) ease-salida",
                        )}
                      >
                        {barra.hito ? (
                          <span
                            aria-hidden
                            className="size-4 rotate-45 rounded-[3px] bg-tinta"
                          />
                        ) : (
                          <>
                            {barra.progreso !== undefined && (
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-y-0 left-0 bg-tinta/20"
                                style={{ width: `${barra.progreso}%` }}
                              />
                            )}
                            {editable && (
                              <>
                                <span
                                  data-asa="inicio"
                                  aria-hidden
                                  className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize"
                                />
                                <span
                                  data-asa="fin"
                                  aria-hidden
                                  className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize"
                                />
                              </>
                            )}
                            {dentro && (
                              <span className="relative truncate">
                                {barra.titulo}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {!dentro && !barra.hito && (
                        <span
                          aria-hidden
                          className="texto-meta pointer-events-none absolute top-[18px] truncate"
                          style={{ left: izquierda + ancho + 8, maxWidth: 220 }}
                        >
                          {barra.titulo}
                        </span>
                      )}

                      {barra.marcas?.map((marca) => {
                        const x = diasEntre(inicio, marca.fecha);
                        if (x < 0 || x >= totalDias) return null;
                        return (
                          <span
                            key={marca.fecha}
                            title={`${marca.etiqueta}: ${fechaCorta(marca.fecha, idioma)}`}
                            className="absolute top-[18px] z-10 size-3.5 rotate-45 rounded-[3px] border-2 border-background bg-tinta"
                            style={{ left: x * px + px / 2 - 7 }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>

      {/* Móvil: lista por fechas; el diagrama no cabe y arrastrar con el pulgar
          estorbaría al desplazar la página. */}
      <div className="space-y-6 md:hidden">
        {visibles.map((seccion) => (
          <section key={seccion.clave} className="space-y-2">
            <h3 className="texto-meta font-medium uppercase">{seccion.titulo}</h3>
            <ul className="space-y-2">
              {seccion.barras.map((barra) => {
                const f = fechasDe(barra);
                return (
                  <li key={claveDe(barra)}>
                    <button
                      type="button"
                      onClick={() => alternar(barra)}
                      aria-pressed={seleccion === claveDe(barra)}
                      className={cn(
                        "w-full cursor-pointer rounded-card border border-linea bg-card p-4 text-left shadow-card transition-colors",
                        seleccion === claveDe(barra) && "bg-marca-50",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-tinta">
                        {barra.aviso && (
                          <AlertCircle
                            className="size-4 shrink-0"
                            aria-label={t("attention")}
                          />
                        )}
                        {barra.titulo}
                      </span>
                      <span className="texto-meta mt-0.5 block">
                        {[barra.claseEtiqueta, barra.grupo]
                          .filter(Boolean)
                          .join(" · ")}
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

      {elegida && (
        <aside
          aria-live="polite"
          className="animate-escala-entrada rounded-card border border-linea bg-card p-5 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="texto-meta">
                {[elegida.claseEtiqueta, elegida.grupo].filter(Boolean).join(" · ")}
              </p>
              <h3 className="texto-titulo-tarjeta">{elegida.titulo}</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("close")}
              onClick={() => setSeleccion(null)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="texto-meta">{t("start")}</dt>
              <dd className="font-medium text-tinta tabular-nums">
                {fechaCorta(fechasDe(elegida).inicio, idioma)}
              </dd>
            </div>
            <div>
              <dt className="texto-meta">{t("end")}</dt>
              <dd className="font-medium text-tinta tabular-nums">
                {fechaCorta(fechasDe(elegida).fin, idioma)}
              </dd>
            </div>
            {elegida.detalle && (
              <div className="col-span-2">
                <dt className="sr-only">{elegida.claseEtiqueta}</dt>
                <dd className="font-medium text-tinta">{elegida.detalle}</dd>
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
