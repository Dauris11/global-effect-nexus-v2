import type { Metadata } from "next";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  GraduationCap,
  Layers,
  Search,
  Users,
  X,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { requerirUsuario } from "@/lib/auth";
import { colorDeLetra, COLOR_INDICE, consejoDeIndice, esLetra } from "@/lib/notas";
import { ANIMACION, CUADRO, VACIO } from "@/lib/paleta";
import { tieneAlgunPermiso } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  cuatrimestresDelHistorial,
  type FilaHistorial,
  hayMasHistorialQueElTope,
  historialPorEstudiante,
  type MateriaDelHistorial,
  materiasDelHistorial,
  recortarHistorial,
  resumenDelHistorial,
} from "@/server/academico/consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("academicHistory.title") };
}

/**
 * Historial académico: una fila por estudiante, con su índice acumulado.
 *
 * Es el expediente del becado universitario: las materias de la carrera ya
 * CERRADAS, con su índice sobre 4.00 guardado cuatrimestre a cuatrimestre. Las
 * notas de Global Effect 360 son la otra mitad y viven en `/academico/clases-360`.
 *
 * NO HAY NI UNA LÍNEA DE JAVASCRIPT DE CLIENTE, y es lo que corresponde: esta
 * pantalla no escribe nada. El historial lo cierra el proceso académico, no un
 * formulario, así que no hay estado que mantener en el navegador. Los tres
 * controles que parecen interactivos —buscar, filtrar por cuatrimestre y abrir
 * el detalle de alguien— son un `form method="get"` y dos enlaces. Funcionan sin
 * JavaScript, el enlace se comparte ("mándame el historial de Fulana") y no
 * viaja ni un kilobyte de componente.
 *
 * Entran quien pone notas, coordinación y quien lleva expedientes.
 * `academico.leer` no vale, porque el rol `estudiante` también lo tiene y le
 * abriría el historial de todos los demás.
 */
export default async function PaginaAcademicoHistorial({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; cuatrimestre?: string; estudiante?: string }>;
}) {
  const { locale } = await params;
  const { q, cuatrimestre, estudiante } = await searchParams;

  const usuario = await requerirUsuario();
  const t = await getTranslations({ locale, namespace: "academic" });

  const puedeEntrar = tieneAlgunPermiso(usuario.rol, [
    "calificaciones.registrar",
    "academico.escribir",
    "expedientes.leer",
  ]);

  if (!puedeEntrar) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm font-semibold">{t("forbidden")}</p>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-xs leading-relaxed">
          {t("history.forbiddenHint")}
        </p>
      </div>
    );
  }

  const busqueda = (q ?? "").trim().slice(0, 80);
  const periodo = (cuatrimestre ?? "").trim().slice(0, 20) || null;
  const abierto = UUID.test(estudiante ?? "") ? estudiante! : null;

  const [filas, resumen, cuatrimestres, detalle] = await Promise.all([
    historialPorEstudiante({ cuatrimestre: periodo, busqueda }),
    resumenDelHistorial({ cuatrimestre: periodo, busqueda }),
    cuatrimestresDelHistorial(),
    // El detalle se pide SOLO del estudiante abierto. Cargar el de los 300 de
    // la lista para enseñar uno es el reparto exactamente al revés.
    abierto ? materiasDelHistorial(abierto) : Promise.resolve([]),
  ]);

  const lista = recortarHistorial(filas);
  const hayFiltro = Boolean(busqueda) || Boolean(periodo);

  /** Conserva los filtros al abrir y cerrar el detalle de alguien. */
  const enlace = (estudianteId: string | null) => {
    const partes = new URLSearchParams();
    if (busqueda) partes.set("q", busqueda);
    if (periodo) partes.set("cuatrimestre", periodo);
    if (estudianteId) partes.set("estudiante", estudianteId);

    const cadena = partes.toString();

    return cadena ? `/academico/historial?${cadena}` : "/academico/historial";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="size-5 text-[#2096BA]" />
          {t("history.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("history.description")}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1.5">
          <label
            htmlFor="q"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("search")}
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder={t("history.searchPlaceholder")}
            maxLength={80}
          />
        </div>

        <div className="min-w-44 space-y-1.5">
          <label
            htmlFor="cuatrimestre"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("history.term")}
          </label>
          {/* Los cuatrimestres salen del propio historial y no de `periodo`: uno
              ya cursado no suele tener fila allí, así que la tabla de períodos
              dejaría fuera justo los que hay que poder filtrar. */}
          <select
            id="cuatrimestre"
            name="cuatrimestre"
            defaultValue={periodo ?? ""}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
          >
            <option value="">{t("allTerms")}</option>
            {cuatrimestres.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="submit"
          className="transition-transform duration-150 active:scale-95"
        >
          <Search className="size-4" />
          {t("apply")}
        </Button>

        {hayFiltro && (
          <Button asChild variant="ghost">
            <Link href="/academico/historial">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      <div className={cn("space-y-5", ANIMACION.entrada)}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CifraAcademica
            valor={resumen.estudiantes}
            etiqueta={t("history.stats.students")}
            icono={Users}
          />
          <CifraAcademica
            valor={resumen.registros}
            etiqueta={t("history.stats.records")}
            icono={BookOpen}
          />
          <CifraAcademica
            valor={resumen.indice?.toFixed(2) ?? "—"}
            etiqueta={t("history.stats.gpa")}
            icono={GraduationCap}
            acento
          />
          <CifraAcademica
            valor={resumen.reprobadas}
            etiqueta={t("history.stats.failed")}
            icono={Layers}
          />
        </div>

        <Card>
          <CardContent className="pt-5">
            <CardTitle className="mb-3">
              <BarChart3 className="size-4" />
              {t("history.title")}
              <Badge className="ml-1 bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                {t("history.count", { count: resumen.estudiantes })}
              </Badge>
            </CardTitle>

            {lista.length === 0 ? (
              <div className={VACIO.contenedor}>
                <span className={VACIO.icono}>
                  <BarChart3 className="size-6" />
                </span>
                <p className={VACIO.titulo}>
                  {hayFiltro ? t("noMatches") : t("history.empty")}
                </p>
                <p className={VACIO.descripcion}>
                  {hayFiltro ? t("noMatchesHint") : t("history.emptyHint")}
                </p>
              </div>
            ) : (
              <>
                <ul className="divide-y">
                  {lista.map((fila) => (
                    <li key={fila.estudiante_id} className="group py-3">
                      <FilaEstudiante
                        fila={fila}
                        abierto={abierto === fila.estudiante_id}
                        hrefAbrir={enlace(fila.estudiante_id)}
                        hrefCerrar={enlace(null)}
                        t={t}
                      />

                      {abierto === fila.estudiante_id && (
                        <Detalle materias={detalle} t={t} />
                      )}
                    </li>
                  ))}
                </ul>

                {hayMasHistorialQueElTope(filas) && (
                  <p className="text-muted-foreground mt-3 text-center text-xs">
                    {t("history.limitHint")}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type Traducir = Awaited<ReturnType<typeof getTranslations<"academic">>>;

/**
 * Un estudiante: su índice acumulado, cómo cerró y el acceso a su detalle.
 *
 * El índice va grande y con el peso de su tramo, porque es el número por el que
 * se entra a esta pantalla: es el que decide la beca. Las tres cifras de "cómo
 * va" solo aparecen cuando valen algo — un "0 reprobadas" al lado de cada
 * nombre convierte en ruido justo la insignia que tiene que saltar cuando no
 * es cero.
 */
function FilaEstudiante({
  fila,
  abierto,
  hrefAbrir,
  hrefCerrar,
  t,
}: {
  fila: FilaHistorial;
  abierto: boolean;
  hrefAbrir: string;
  hrefCerrar: string;
  t: Traducir;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
          CUADRO.marca,
        )}
      >
        <GraduationCap className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fila.nombre}</p>

        <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          <span>
            {t("history.lastTerm")}: <b>{fila.ultimo_cuatrimestre ?? "—"}</b>
          </span>
          <span>
            {t("history.subjects")}: <b>{fila.materias}</b>
          </span>
          <span>
            {t("history.average")}: <b>{fila.promedio?.toFixed(1) ?? "—"}</b>
          </span>
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {fila.aprobadas > 0 && (
            <Badge className="bg-[#2096BA]/15 text-[10px] text-[#187a99]">
              {t("history.passedCount", { count: fila.aprobadas })}
            </Badge>
          )}
          {fila.prueba > 0 && (
            <Badge className="bg-slate-200 text-[10px] text-tinta-2">
              {t("history.onProbation", { count: fila.prueba })}
            </Badge>
          )}
          {fila.reprobadas > 0 && (
            <Badge className="bg-[#171A1D] text-[10px] text-white">
              {t("history.failedCount", { count: fila.reprobadas })}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={cn(
            "flex h-10 min-w-16 flex-col items-center justify-center rounded-lg border px-2 leading-none",
            COLOR_INDICE[consejoDeIndice(fila.indice)],
          )}
        >
          <b className="text-sm">{fila.indice?.toFixed(2) ?? "—"}</b>
          <span className="mt-0.5 text-[9px] opacity-80">
            {fila.indice === null ? t("history.noGpa") : t("history.gpaScale")}
          </span>
        </span>

        <Button asChild variant="ghost" size="sm">
          <Link href={abierto ? hrefCerrar : hrefAbrir}>
            {abierto ? (
              <>
                <X className="size-3.5" />
                {t("close")}
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" />
                {t("history.seeSubjects")}
              </>
            )}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Las materias cerradas de un estudiante.
 *
 * La letra y el índice se PINTAN COMO VIENEN de la base, no se recalculan desde
 * la nota: la 0006 avisa de que la escala de conversión puede cambiar de un año
 * a otro, así que un 3.70 guardado recalculado saldría 4.00. `esLetra` está por
 * si acaso —`nota_letra` es TEXT sin CHECK— y una letra que no sea de la escala
 * se pinta en neutro en vez de romper la fila.
 */
function Detalle({
  materias,
  t,
}: {
  materias: readonly MateriaDelHistorial[];
  t: Traducir;
}) {
  if (materias.length === 0) {
    return (
      <p className="text-muted-foreground bg-muted/30 mt-3 rounded-lg py-4 text-center text-xs">
        {t("history.empty")}
      </p>
    );
  }

  return (
    <ul className="bg-muted/30 mt-3 space-y-1 rounded-lg p-2">
      {materias.map((materia) => (
        <li
          key={materia.id}
          className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-xs"
        >
          <span className="text-muted-foreground w-16 shrink-0 font-mono text-[11px]">
            {materia.cuatrimestre}
          </span>

          <span className="min-w-0 flex-1 truncate">{materia.materia}</span>

          <Badge className="bg-muted text-[10px] text-tinta-2">
            {t(`history.recordStatus.${materia.estado}` as never)}
          </Badge>

          <span className="w-12 shrink-0 text-right">
            {materia.nota_numerica.toFixed(1)}
          </span>

          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
              esLetra(materia.nota_letra)
                ? colorDeLetra(materia.nota_letra)
                : "border-linea bg-muted text-muted-foreground",
            )}
          >
            {materia.nota_letra}
          </span>

          <span className="text-muted-foreground w-10 shrink-0 text-right">
            {materia.gpa.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}
