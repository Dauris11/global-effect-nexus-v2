import type { Metadata } from "next";
import {
  AlertCircle,
  CalendarRange,
  ClipboardList,
  GanttChartSquare,
  GraduationCap,
  Search,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requerirUsuario } from "@/lib/auth";
import { fechaCorta } from "@/lib/fechas";
import { ALERTA_RIESGO, ANIMACION, VACIO } from "@/lib/paleta";
import { usuarioTieneAlgunPermiso, usuarioTienePermiso } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  type Barra,
  esFamilia,
  esIncoherente,
  type Familia,
  familiaAcademico,
  familiaClases360,
  familiaOperaciones,
  familiaTareas,
  hoyEnLaBase,
  periodosDelGantt,
  TRAMO_ABIERTO,
  ventanaDelGantt,
} from "@/server/calendario/gantt";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un día en milisegundos, para repartir las barras sobre el ancho. */
const DIA = 86_400_000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calendar" });

  return { title: t("gantt.title") };
}

/**
 * Línea de tiempo (Gantt) de las cuatro familias.
 *
 * El calendario contesta "¿qué pasa el martes?". Esto contesta la otra pregunta,
 * la que hoy no se puede contestar en ninguna pantalla: "¿qué corre a la vez?".
 *
 * VA APARTE DEL CALENDARIO y no como una quinta vista de `EventManager`, por dos
 * razones: ese componente es cliente, arrastra para mover y gira alrededor de un
 * mes; esto es de servidor, no escribe nada y gira alrededor de un tramo largo.
 * Meterlo dentro habría obligado a que el componente más grande y más delicado
 * del proyecto cargara además cuatro consultas que no son suyas.
 *
 * SIN JAVASCRIPT DE CLIENTE, igual que el historial: los filtros son un
 * `form method="get"` y las barras se posicionan con porcentajes calculados en
 * el servidor. Una línea de tiempo que no se puede arrastrar no necesita
 * hidratarse.
 *
 * QUIÉN ENTRA. Junta datos académicos y de operaciones, así que basta con llevar
 * alguno de los dos —`operaciones.leer`, `academico.escribir` o
 * `calificaciones.registrar`—. `academico.leer` a secas NO vale: lo tiene el rol
 * `estudiante`, y esto enseña la carga de trabajo de toda la institución. Y cada
 * familia se dibuja solo si su permiso está: quien solo lleva operaciones ve
 * los proyectos y no el académico.
 */
export default async function PaginaGantt({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    periodo?: string;
    tramo?: string;
    f?: string | string[];
  }>;
}) {
  const { locale } = await params;
  const { periodo, tramo, f } = await searchParams;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirUsuario();
  const t = await getTranslations({ locale, namespace: "calendar" });

  if (
    !usuarioTieneAlgunPermiso(usuario, [
      "operaciones.leer",
      "academico.escribir",
      "calificaciones.registrar",
    ])
  ) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm font-semibold">{t("gantt.forbidden")}</p>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-xs leading-relaxed">
          {t("gantt.forbiddenHint")}
        </p>
      </div>
    );
  }

  // Qué familias puede ver este rol. Lo académico y lo de operaciones son dos
  // ámbitos distintos y no todos los que entran llevan los dos.
  const veAcademico = usuarioTieneAlgunPermiso(usuario, [
    "academico.escribir",
    "calificaciones.registrar",
  ]);
  const veOperaciones = usuarioTienePermiso(usuario, "operaciones.leer");

  const permitidas: Familia[] = [
    ...(veAcademico ? (["academico", "tareas", "clases360"] as Familia[]) : []),
    ...(veOperaciones ? (["operaciones"] as Familia[]) : []),
  ];

  // Sin marcar nada se dibujan todas las que pueda ver: la pantalla tiene que
  // decir algo en la primera visita, no pedir que se configure antes.
  const pedidas = (Array.isArray(f) ? f : f ? [f] : []).filter(esFamilia);
  const elegidas = pedidas.filter((familia) => permitidas.includes(familia));
  const familias = elegidas.length > 0 ? elegidas : permitidas;

  const todo = tramo === "todo";
  const periodoId = UUID.test(periodo ?? "") ? periodo! : null;

  const [ventana, periodos, hoy] = await Promise.all([
    ventanaDelGantt(periodoId),
    periodosDelGantt(),
    hoyEnLaBase(),
  ]);

  // En modo "todo" se pide con los límites abiertos y el tramo se ajusta luego a
  // lo que haya salido. Así no hay ninguna ventana inventada.
  const desde = todo
    ? TRAMO_ABIERTO.desde
    : (ventana?.inicio ?? TRAMO_ABIERTO.desde);
  const hasta = todo
    ? TRAMO_ABIERTO.hasta
    : (ventana?.fin ?? TRAMO_ABIERTO.hasta);

  const cargar = async (familia: Familia) => {
    if (!familias.includes(familia)) return { barras: [], sinFechas: 0 };

    if (familia === "academico") return familiaAcademico(desde, hasta);
    if (familia === "tareas") return familiaTareas(desde, hasta);
    if (familia === "operaciones") return familiaOperaciones(desde, hasta);

    return familiaClases360(desde, hasta);
  };

  const [academico, tareas, operaciones, clases360] = await Promise.all([
    cargar("academico"),
    cargar("tareas"),
    cargar("operaciones"),
    cargar("clases360"),
  ]);

  const secciones = [
    { familia: "academico" as const, icono: CalendarRange, datos: academico },
    { familia: "tareas" as const, icono: ClipboardList, datos: tareas },
    {
      familia: "operaciones" as const,
      icono: GanttChartSquare,
      datos: operaciones,
    },
    { familia: "clases360" as const, icono: GraduationCap, datos: clases360 },
  ].filter((seccion) => familias.includes(seccion.familia));

  const todasLasBarras = secciones.flatMap((seccion) => seccion.datos.barras);
  const sanas = todasLasBarras.filter((barra) => !esIncoherente(barra));
  const incoherentes = todasLasBarras.length - sanas.length;
  const sinFechas = secciones.reduce(
    (total, seccion) => total + seccion.datos.sinFechas,
    0,
  );

  /*
   * El tramo que se dibuja. En modo "todo" sale de los propios datos —del
   * primero que empieza al último que acaba—, que es la única forma de
   * ajustarlo sin elegir un número a dedo. Las barras incoherentes no cuentan
   * para calcularlo: una fecha al revés estiraría el eje entero.
   */
  const inicio = todo
    ? sanas.reduce(
        (min, b) => (b.inicio < min ? b.inicio : min),
        sanas[0]?.inicio ?? "",
      )
    : (ventana?.inicio ?? "");
  const fin = todo
    ? sanas.reduce((max, b) => (b.fin > max ? b.fin : max), sanas[0]?.fin ?? "")
    : (ventana?.fin ?? "");

  const hayTramo = Boolean(inicio && fin && fin > inicio);
  const meses = hayTramo ? mesesEntre(inicio, fin) : [];
  const posicionHoy = hayTramo ? porcentaje(hoy, inicio, fin) : null;

  return (
    <div className="animate-entrada mx-auto max-w-6xl space-y-6">
      <EncabezadoPagina titulo={t("gantt.title")} />

      <form method="get" className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-44 space-y-1.5">
            <label
              htmlFor="periodo"
              className="text-muted-foreground text-xs font-medium"
            >
              {t("gantt.span")}
            </label>
            <select
              id="periodo"
              name="periodo"
              defaultValue={ventana?.periodo_id ?? ""}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
            >
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-40 space-y-1.5">
            <label
              htmlFor="tramo"
              className="text-muted-foreground text-xs font-medium"
            >
              {t("gantt.spanTerm")}
            </label>
            <select
              id="tramo"
              name="tramo"
              defaultValue={todo ? "todo" : "periodo"}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
            >
              <option value="periodo">{t("gantt.spanTerm")}</option>
              <option value="todo">{t("gantt.spanAll")}</option>
            </select>
          </div>

          <Button
            type="submit"
            className="transition-transform duration-150 active:scale-95"
          >
            <Search className="size-4" />
            {t("gantt.families")}
          </Button>
        </div>

        {/* Casillas y no píldoras de JavaScript: sin hidratar nada, el
            navegador ya sabe mandar varias `f` en la misma URL. */}
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="sr-only">{t("gantt.families")}</legend>

          {permitidas.map((familia) => (
            <label
              key={familia}
              className="flex cursor-pointer items-center gap-1.5 text-xs"
            >
              <input
                type="checkbox"
                name="f"
                value={familia}
                defaultChecked={familias.includes(familia)}
                className="size-3.5 accent-[#2096BA]"
              />
              {t(`gantt.family.${familia}`)}
            </label>
          ))}
        </fieldset>
      </form>

      {!hayTramo || sanas.length === 0 ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <GanttChartSquare className="size-6" />
            </span>
            <p className={VACIO.titulo}>
              {todo ? t("gantt.nothing") : t("gantt.empty")}
            </p>

            {!todo && (
              <Button asChild variant="outline" className="mt-4">
                <Link href="/calendario/gantt?tramo=todo">
                  {t("gantt.seeAll")}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={cn("space-y-4", ANIMACION.entrada)}>
          <Card>
            <CardContent className="pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  <CalendarRange className="size-4" />
                  {t("gantt.range", {
                    inicio: fechaCorta(inicio, idioma),
                    fin: fechaCorta(fin, idioma),
                  })}
                </CardTitle>

                <Badge className="bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                  {sanas.length}
                </Badge>
              </div>

              {/* El eje. Los meses se reparten proporcionalmente a sus días, no
                  a partes iguales: febrero y marzo no miden lo mismo, y con
                  columnas iguales las barras dejarían de cuadrar con el eje. */}
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="relative mb-1 flex border-b pb-1">
                    {meses.map((mes) => (
                      <span
                        key={mes.clave}
                        style={{ width: `${mes.ancho}%` }}
                        className="text-muted-foreground truncate text-[10px] uppercase"
                      >
                        {mes.etiqueta}
                      </span>
                    ))}
                  </div>

                  <div className="relative">
                    {posicionHoy !== null && (
                      <span
                        aria-hidden
                        style={{ left: `${posicionHoy}%` }}
                        className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[#171A1D]/40"
                      >
                        <span className="absolute -top-0.5 -left-3 text-[9px] font-semibold text-[#171A1D]/60">
                          {t("gantt.today")}
                        </span>
                      </span>
                    )}

                    {secciones.map((seccion) => (
                      <Seccion
                        key={seccion.familia}
                        titulo={t(`gantt.family.${seccion.familia}`)}
                        icono={seccion.icono}
                        barras={seccion.datos.barras}
                        inicio={inicio}
                        fin={fin}
                        idioma={idioma}
                        /* Las seis clases posibles están todas en
                           `gantt.kind`: `periodo`, `materia`,
                           `clase360`, `tarea`, `examen` y `proyecto`. Las
                           produce el SQL como literales, no la base, así que la
                           lista no puede crecer sin tocar este archivo. */
                        etiquetaDe={(clase) =>
                          t(`gantt.kind.${clase}` as never)
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Los avisos de datos incompletos se dicen con palabras, en vez de
              dejar que alguien deduzca que no existe. */}
          {(sinFechas > 0 || incoherentes > 0) && (
            <Card>
              <CardContent className="space-y-2 pt-5">
                {sinFechas > 0 && (
                  <p className={ALERTA_RIESGO.contenedor}>
                    <AlertCircle className={ALERTA_RIESGO.icono} />
                    <span className={ALERTA_RIESGO.texto}>
                      {t("gantt.noDates", { count: sinFechas })}
                    </span>
                  </p>
                )}

                {incoherentes > 0 && (
                  <p className={ALERTA_RIESGO.contenedor}>
                    <AlertCircle className={ALERTA_RIESGO.icono} />
                    <span className={ALERTA_RIESGO.texto}>
                      {t("gantt.inverted", { count: incoherentes })}{" "}
                      {t("gantt.invertedHint")}
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/** Una familia: su encabezado y sus barras. */
function Seccion({
  titulo,
  icono: Icono,
  barras,
  inicio,
  fin,
  idioma,
  etiquetaDe,
}: {
  titulo: string;
  icono: React.ComponentType<{ className?: string }>;
  barras: readonly Barra[];
  inicio: string;
  fin: string;
  idioma: Locale;
  etiquetaDe: (clase: string) => string;
}) {
  if (barras.length === 0) return null;

  return (
    <div className="mt-4 first:mt-0">
      <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase">
        <Icono className="size-3.5" />
        {titulo}
      </p>

      <ul className="space-y-1">
        {barras.map((barra) => (
          <FilaBarra
            key={`${barra.clase}-${barra.id}`}
            barra={barra}
            inicio={inicio}
            fin={fin}
            idioma={idioma}
            etiqueta={etiquetaDe(barra.clase)}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Una barra.
 *
 * El peso dice de qué clase es —el período es lo que más pesa, porque contiene
 * a todo lo demás; lo que ya se cerró va en gris—, no de qué familia: las
 * familias ya se distinguen por su encabezado, y gastar cuatro tonos en
 * repetirlo dejaría sin tonos al estado, que es lo que cambia fila a fila.
 *
 * El texto va DENTRO de la fila y no dentro de la barra: una barra de dos días
 * sobre un cuatrimestre mide cuatro píxeles y no cabe nada. Y las fechas de
 * verdad viajan en el `title`, porque la posición es una aproximación visual y
 * el dato exacto tiene que estar a un puntero de distancia.
 */
function FilaBarra({
  barra,
  inicio,
  fin,
  idioma,
  etiqueta,
}: {
  barra: Barra;
  inicio: string;
  fin: string;
  idioma: Locale;
  etiqueta: string;
}) {
  const roto = esIncoherente(barra);

  const izquierda =
    porcentaje(roto ? barra.fin : barra.inicio, inicio, fin) ?? 0;
  const derecha = porcentaje(roto ? barra.fin : barra.fin, inicio, fin) ?? 0;
  const ancho = Math.max(derecha - izquierda, 0.6);

  const cerrada = [
    "completado",
    "completada",
    "finalizado",
    "inactiva",
    "aprobada",
  ].includes(barra.estado);

  return (
    <li className="group grid grid-cols-[minmax(0,14rem)_1fr] items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{barra.titulo}</p>
        <p className="text-muted-foreground truncate text-[10px]">
          {[etiqueta, barra.grupo, barra.detalle].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="bg-muted/40 relative h-5 rounded">
        {roto ? (
          // Sin barra: una fecha al revés no tiene duración que dibujar. Se
          // marca el final y el aviso de abajo dice cuántas hay así.
          <span
            title={`${fechaCorta(barra.inicio, idioma)} → ${fechaCorta(barra.fin, idioma)}`}
            style={{ left: `${izquierda}%` }}
            className="absolute inset-y-0 w-0.5 bg-[#171A1D]"
          />
        ) : (
          <span
            title={`${fechaCorta(barra.inicio, idioma)} → ${fechaCorta(barra.fin, idioma)}`}
            style={{ left: `${izquierda}%`, width: `${ancho}%` }}
            className={cn(
              "absolute inset-y-0 rounded transition-transform duration-150 group-hover:scale-y-125",
              cerrada
                ? "bg-slate-300"
                : barra.clase === "periodo"
                  ? "bg-[#0a6a8a]"
                  : barra.clase === "examen"
                    ? "bg-[#171A1D]"
                    : "bg-[#2096BA]",
            )}
          />
        )}
      </div>
    </li>
  );
}

/** Dónde cae una fecha dentro del tramo, en 0–100. `null` si se sale. */
function porcentaje(fecha: string, inicio: string, fin: string): number | null {
  const desde = Date.parse(inicio);
  const hasta = Date.parse(fin);
  const punto = Date.parse(fecha);

  if (!Number.isFinite(punto) || hasta <= desde) return null;
  if (punto < desde || punto > hasta) return null;

  return ((punto - desde) / (hasta - desde)) * 100;
}

/**
 * Los meses del tramo, cada uno con el ancho que le tocan sus días DENTRO del
 * tramo. El primero y el último suelen estar cortados, y darles el ancho de un
 * mes entero desalinearía el eje de las barras.
 */
function mesesEntre(inicio: string, fin: string) {
  const desde = new Date(inicio);
  const hasta = new Date(fin);
  const total = (hasta.getTime() - desde.getTime()) / DIA;

  if (!Number.isFinite(total) || total <= 0) return [];

  const meses: { clave: string; etiqueta: string; ancho: number }[] = [];
  const cursor = new Date(desde);

  while (cursor <= hasta) {
    const finDeMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const corte = finDeMes > hasta ? hasta : finDeMes;
    const dias = (corte.getTime() - cursor.getTime()) / DIA;

    meses.push({
      clave: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      // Sin `toLocaleString` con idioma: el eje solo necesita distinguir un mes
      // del siguiente, y el número no se traduce ni se lee mal en ningún idioma.
      etiqueta: `${cursor.getMonth() + 1}/${String(cursor.getFullYear()).slice(2)}`,
      ancho: (dias / total) * 100,
    });

    cursor.setTime(finDeMes.getTime());
  }

  return meses;
}
