import type { Metadata } from "next";
import {
  BarChart3,
  ClipboardList,
  DollarSign,
  FolderKanban,
  GraduationCap,
  Library,
  ListTodo,
  Receipt,
  Scale,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import {
  GraficaAnillo,
  GraficaBarras,
  GraficaFlujo,
} from "@/components/dashboard/graficas";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requerirUsuario } from "@/lib/auth";
import { montoUsd } from "@/lib/finanzas";
import { BANDAS, UMBRAL_BANDA } from "@/lib/notas";
import {
  AZUL,
  AZUL_OSCURO,
  NEUTRO,
  PILDORA_FILTRO,
  SERIE,
  TINTA,
} from "@/lib/paleta";
import { tieneAlgunPermiso, tienePermiso, type Permiso } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { periodosSimples, resumenDeNotas } from "@/server/academico/consultas";
import {
  flujoMensual,
  repartoPorCategoria,
  resumenFinanciero,
} from "@/server/finanzas/consultas";
import {
  cifrasAcademicas,
  cifrasDeOperaciones,
  promedioPorCurso,
  promedioPorTipo,
  proyectosParaReporte,
  proyectosPorEstado,
  tareasPorEstado,
} from "@/server/reportes/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Las tres vistas del informe y el permiso que cierra cada una.
 *
 * Es lo que permite que esta pantalla no pida un permiso único: dos tercios de
 * lo que enseña son operaciones y académico, y exigir `finanzas.leer` para
 * entrar dejaba fuera a coordinación, que no ve el dinero pero sí lleva los
 * proyectos.
 */
const VISTAS = [
  { clave: "operaciones", permiso: "operaciones.leer" },
  { clave: "academico", permiso: "academico.leer" },
  { clave: "finanzas", permiso: "finanzas.leer" },
] as const satisfies readonly { clave: string; permiso: Permiso }[];

type Vista = (typeof VISTAS)[number]["clave"];

/** Color de cada banda de nota: el mismo peso que ya usa su letra. */
const COLOR_BANDA = {
  excelente: AZUL_OSCURO,
  buena: AZUL,
  riesgo: NEUTRO,
  critica: TINTA,
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("reports.title") };
}

/**
 * Reportes: operaciones, académico y finanzas.
 *
 * TRES DECISIONES QUE SE VEN AL USARLA.
 *
 *   1. **El permiso cierra pestañas, no la puerta.** El esqueleto pedía
 *      `finanzas.leer` para entrar, que solo tienen contabilidad y
 *      `super_admin`; con eso, coordinación —que lleva los proyectos y el
 *      académico— no podía ver un informe de su propio trabajo. Ahora entra
 *      quien tenga cualquiera de los tres permisos y ve **solo sus pestañas**.
 *      La entrada del menú se movió a Herramientas por la misma razón.
 *
 *   2. **La pestaña va en la URL.** Un informe se comparte con quien decide, y
 *      «mira la pestaña de finanzas» tiene que ser un enlace. Además así la
 *      pantalla no necesita estado de cliente: son tres enlaces y un `form
 *      method="get"` para el período.
 *
 *   3. **Solo se consulta la pestaña que se está viendo.** Pedir las tres sería
 *      hacer catorce consultas para dibujar cinco gráficas, en cada visita.
 *
 * Las gráficas son las del panel general (`@/components/dashboard/graficas`),
 * tal cual. Comparten el gris de los ejes, el globo de datos y la altura, y ahí
 * está el sentido de no escribir otras tres: dos juegos de gráficas empiezan
 * pareciéndose y acaban siendo dos estilos en el mismo sitio.
 */
export default async function PaginaReportes({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vista?: string; periodo?: string }>;
}) {
  const { locale } = await params;
  const { vista, periodo } = await searchParams;

  const usuario = await requerirUsuario();

  const t = await getTranslations({ locale, namespace: "reports" });

  const permitidas = VISTAS.filter((opcion) =>
    tienePermiso(usuario.rol, opcion.permiso),
  );

  // Ni una de las tres: se dice y se acaba. Es el caso de `habitudes`, que no
  // tiene ninguno de los tres permisos y tampoco esta entrada en su menú.
  if (
    !tieneAlgunPermiso(
      usuario.rol,
      VISTAS.map((opcion) => opcion.permiso),
    )
  ) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2096BA]/10 text-[#187a99]">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">{t("forbidden")}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t("forbiddenHint")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // La vista pedida, si existe y si el rol la tiene. Si no, la primera que
  // pueda ver: entrar por una URL ajena no debe dar una pantalla vacía.
  const activa: Vista =
    permitidas.find((opcion) => opcion.clave === vista)?.clave ??
    permitidas[0].clave;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="size-5 text-[#2096BA]" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("description")}
        </p>
      </div>

      {/* Las pestañas, como enlaces. Solo se dibujan las que el rol puede ver:
          una pestaña que al pulsarla dice "no tienes permiso" es una promesa
          incumplida en la propia navegación. */}
      {permitidas.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t("tabsLabel")}>
          {permitidas.map((opcion) => (
            <Link
              key={opcion.clave}
              href={`/reportes?vista=${opcion.clave}`}
              aria-current={opcion.clave === activa ? "page" : undefined}
              className={cn(
                PILDORA_FILTRO.base,
                opcion.clave === activa
                  ? PILDORA_FILTRO.activa
                  : PILDORA_FILTRO.inactiva,
              )}
            >
              {t(`tab.${opcion.clave}`)}
            </Link>
          ))}
        </nav>
      )}

      {activa === "operaciones" && <Operaciones locale={locale} />}
      {activa === "academico" && (
        <Academico
          locale={locale}
          periodoId={periodo && UUID.test(periodo) ? periodo : null}
        />
      )}
      {activa === "finanzas" && <Finanzas locale={locale} />}
    </div>
  );
}

/* ──────────────────────────── OPERACIONES ──────────────────────────── */

async function Operaciones({ locale }: { locale: string }) {
  // Los nombres de los estados NO se escriben aquí: ya están traducidos en el
  // espacio `admin`, que es el que los usa el tablero y la lista de proyectos.
  // Una segunda copia en `reports` sería un día en que «En curso» se llame de
  // dos maneras según la pantalla.
  const [t, ta, cifras, proyectos, porEstado, tareas] = await Promise.all([
    getTranslations({ locale, namespace: "reports" }),
    getTranslations({ locale, namespace: "admin" }),
    cifrasDeOperaciones(),
    proyectosParaReporte(),
    proyectosPorEstado(),
    tareasPorEstado(),
  ]);

  // Los proyectos sin ninguna tarea se quedan fuera de la gráfica de avance: su
  // avance no es 0%, es «todavía no se sabe», y una barra vacía diría lo
  // primero. Se cuentan aparte, debajo, para que no desaparezcan sin más.
  const conTareas = proyectos.filter((fila) => fila.tareas > 0);
  const sinTareas = proyectos.length - conTareas.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={cifras.proyectos}
          etiqueta={t("ops.stats.projects")}
          icono={FolderKanban}
        />
        <CifraAcademica
          valor={cifras.en_curso}
          etiqueta={t("ops.stats.running")}
          icono={ClipboardList}
          acento
        />
        <CifraAcademica
          valor={cifras.completados}
          etiqueta={t("ops.stats.done")}
          icono={FolderKanban}
        />
        <CifraAcademica
          valor={cifras.tareas_abiertas}
          etiqueta={t("ops.stats.openTasks")}
          icono={ListTodo}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo={t("ops.byState")} pista={t("ops.byStateHint")}>
          <GraficaAnillo
            datos={porEstado.map((fila, indice) => ({
              nombre: ta(`projectStatus.${fila.estado}` as never),
              valor: fila.total,
              color: SERIE[indice % SERIE.length],
            }))}
            total={porEstado.reduce((suma, fila) => suma + fila.total, 0)}
            etiquetaTotal={t("ops.stats.projects")}
            vacio={t("empty")}
          />
        </Panel>

        <Panel titulo={t("ops.tasks")} pista={t("ops.tasksHint")}>
          <GraficaBarras
            datos={tareas.map((fila) => ({
              nombre: ta(`taskStatus.${fila.estado}` as never),
              valor: fila.total,
            }))}
            vacio={t("empty")}
          />
        </Panel>
      </div>

      <Panel titulo={t("ops.progress")} pista={t("ops.progressHint")}>
        <GraficaBarras
          datos={conTareas.map((fila) => ({
            nombre: fila.nombre,
            valor: Math.round((fila.hechas / fila.tareas) * 100),
          }))}
          vacio={t("empty")}
        />

        {sinTareas > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            {t("ops.withoutTasks", { count: sinTareas })}
          </p>
        )}
      </Panel>
    </div>
  );
}

/* ───────────────────────────── ACADÉMICO ───────────────────────────── */

async function Academico({
  locale,
  periodoId,
}: {
  locale: string;
  periodoId: string | null;
}) {
  const [t, tg, cifras, notas, porTipo, porCurso, periodos] = await Promise.all(
    [
      getTranslations({ locale, namespace: "reports" }),
      getTranslations({ locale, namespace: "academic" }),
      cifrasAcademicas(),
      // Los umbrales viajan desde `@/lib/notas` y se cuentan en SQL: la escala
      // tiene un solo sitio, y si aprobar deja de ser 70 el informe se entera.
      resumenDeNotas({ periodoId, umbrales: UMBRAL_BANDA }),
      promedioPorTipo(periodoId),
      promedioPorCurso(periodoId),
      periodosSimples(),
    ],
  );

  return (
    <div className="space-y-6">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="vista" value="academico" />

        <div className="min-w-48 space-y-1.5">
          <label
            htmlFor="periodo"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("academic.term")}
          </label>
          <select
            id="periodo"
            name="periodo"
            defaultValue={periodoId ?? ""}
            className={SELECT}
          >
            <option value="">{t("academic.allTerms")}</option>
            {periodos.map((fila) => (
              <option key={fila.id} value={fila.id}>
                {fila.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className={cn(PILDORA_FILTRO.base, PILDORA_FILTRO.activa)}
        >
          {t("academic.apply")}
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={notas.total}
          etiqueta={t("academic.stats.grades")}
          icono={Star}
        />
        <CifraAcademica
          valor={notas.promedio === null ? "—" : notas.promedio.toFixed(1)}
          etiqueta={t("academic.stats.average")}
          icono={BarChart3}
          acento
        />
        <CifraAcademica
          valor={notas.aprobadas}
          etiqueta={t("academic.stats.passed")}
          icono={GraduationCap}
        />
        <CifraAcademica
          valor={notas.total - notas.aprobadas}
          etiqueta={t("academic.stats.failed")}
          icono={ShieldAlert}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo={t("academic.distribution")}
          pista={t("academic.distributionHint")}
        >
          <GraficaBarras
            datos={BANDAS.map((banda) => ({
              nombre: tg(`gradeBand.${banda}` as never),
              valor: notas[banda],
              color: COLOR_BANDA[banda],
            }))}
            vacio={t("empty")}
          />
        </Panel>

        <Panel titulo={t("academic.byType")} pista={t("academic.byTypeHint")}>
          <GraficaBarras
            datos={porTipo.map((fila) => ({
              nombre: tg(`gradeType.${fila.clave}` as never),
              valor: fila.promedio,
            }))}
            vacio={t("empty")}
          />
        </Panel>
      </div>

      <Panel titulo={t("academic.byCourse")} pista={t("academic.byCourseHint")}>
        <GraficaBarras
          datos={porCurso.map((fila) => ({
            nombre: fila.clave,
            valor: fila.promedio,
          }))}
          vacio={t("empty")}
        />
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={cifras.estudiantes}
          etiqueta={t("academic.stats.students")}
          icono={Users}
        />
        <CifraAcademica
          valor={cifras.becados}
          etiqueta={t("academic.stats.scholars")}
          icono={GraduationCap}
        />
        <CifraAcademica
          valor={cifras.cursos}
          etiqueta={t("academic.stats.courses")}
          icono={Library}
        />
        <CifraAcademica
          valor={cifras.materias}
          etiqueta={t("academic.stats.subjects")}
          icono={Library}
        />
      </div>
    </div>
  );
}

/* ───────────────────────────── FINANZAS ────────────────────────────── */

async function Finanzas({ locale }: { locale: string }) {
  const [t, tf, resumen, flujo, categorias] = await Promise.all([
    getTranslations({ locale, namespace: "reports" }),
    getTranslations({ locale, namespace: "finance" }),
    resumenFinanciero(),
    flujoMensual(6),
    repartoPorCategoria(),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={montoUsd(resumen.ingresos, 0)}
          etiqueta={tf("stats.income")}
          icono={DollarSign}
          acento
        />
        <CifraAcademica
          valor={montoUsd(resumen.egresos, 0)}
          etiqueta={tf("stats.expense")}
          icono={DollarSign}
        />
        <CifraAcademica
          valor={montoUsd(resumen.balance, 0)}
          etiqueta={tf("stats.balance")}
          icono={Scale}
          acento
        />
        <CifraAcademica
          valor={resumen.movimientos}
          etiqueta={tf("stats.entries")}
          icono={Receipt}
        />
      </div>

      <p className="text-muted-foreground text-xs">{t("finance.allTimeHint")}</p>

      <Panel titulo={t("finance.flow")} pista={t("finance.flowHint")}>
        <GraficaFlujo
          datos={flujo}
          etiquetas={{
            ingresos: tf("stats.income"),
            egresos: tf("stats.expense"),
            vacio: t("empty"),
          }}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo={t("finance.incomeByCategory")}
          pista={t("finance.categoryHint")}
        >
          <GraficaBarras
            datos={categorias
              .filter((fila) => fila.ingresos > 0)
              .map((fila) => ({
                nombre: tf(`category.${fila.categoria}` as never),
                valor: Math.round(fila.ingresos),
                color: AZUL,
              }))}
            vacio={t("empty")}
          />
        </Panel>

        <Panel
          titulo={t("finance.expenseByCategory")}
          pista={t("finance.categoryHint")}
        >
          {/* Los egresos en el negro de la marca, no en rojo: `MOVIMIENTO` y
              `FINANZAS` de `paleta.ts` ya fijan que lo que sale va en tinta. */}
          <GraficaBarras
            datos={categorias
              .filter((fila) => fila.egresos > 0)
              .map((fila) => ({
                nombre: tf(`category.${fila.categoria}` as never),
                valor: Math.round(fila.egresos),
                color: TINTA,
              }))}
            vacio={t("empty")}
          />
        </Panel>
      </div>
    </div>
  );
}

/** Tarjeta de una gráfica: su título, su pista y la gráfica. */
function Panel({
  titulo,
  pista,
  children,
}: {
  titulo: string;
  pista: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
      <CardContent className="pt-5">
        <div className="mb-3">
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="text-muted-foreground text-xs">{pista}</p>
        </div>

        {children}
      </CardContent>
    </Card>
  );
}
