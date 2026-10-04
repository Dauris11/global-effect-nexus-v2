import type { Metadata } from "next";
import { Search, Star, X } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionCalificaciones } from "@/components/academico/gestion-calificaciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { UMBRAL_BANDA } from "@/lib/notas";
import { tieneAlgunPermiso, tienePermiso } from "@/lib/rbac";
import {
  cursosParaNota,
  estudiantesParaNota,
  hayMasNotasQueElTope,
  notasRegistradas,
  periodosSimples,
  recortarNotas,
  resumenDeNotas,
} from "@/server/academico/consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("academicGrades.title") };
}

/**
 * Calificaciones de los cursos técnicos.
 *
 * LA PUERTA NO ES `academico.leer`, y conviene explicarlo porque es lo primero
 * que uno escribiría: ese permiso lo tiene también el rol `estudiante`, así que
 * usarlo aquí le abriría a cada estudiante las notas de todos los demás. Las
 * suyas están en su portal, donde la consulta filtra por su propia ficha.
 *
 * Entran tres clases de persona, por tres motivos distintos, y cada uno tiene su
 * permiso:
 *
 *   · `calificaciones.registrar` — quien pone las notas: `docente`,
 *     `super_admin`.
 *   · `academico.escribir` — coordinación (`admin`), que monta el catálogo y
 *     necesita ver cómo va el rendimiento, aunque **no pueda poner notas**: no
 *     tiene `calificaciones.registrar`, y eso está así en `rbac.ts` a propósito.
 *   · `expedientes.leer` — quien lleva los expedientes, que sigue
 *     académicamente a cada estudiante.
 *
 * Escribir es otra cosa y la decide solo el primero. Quien entra por las otras
 * dos puertas ve la pantalla entera sin un solo botón, y las acciones lo
 * vuelven a comprobar antes de tocar la base: esconder un botón no es control
 * de acceso.
 *
 * `requerirUsuario` y no `requerirPermiso` porque son tres permisos alternativos
 * y `requerirPermiso` exige uno concreto. A quien no tiene ninguno no se le
 * redirige en silencio: se le dice qué haría falta, porque la entrada SÍ está en
 * el menú de administración y llegar aquí sin permiso no significa haber
 * escrito la URL a mano.
 */
export default async function PaginaAcademicoCalificaciones({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; periodo?: string }>;
}) {
  const { locale } = await params;
  const { q, periodo } = await searchParams;

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
        <p className="text-sm font-semibold">{t("grades.forbidden")}</p>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-xs leading-relaxed">
          {t("grades.forbiddenHint")}
        </p>
      </div>
    );
  }

  const puedeRegistrar = tienePermiso(usuario.rol, "calificaciones.registrar");

  // El docente solo edita lo suyo; quien no es docente y puede registrar —hoy
  // `super_admin`— no tiene cursos propios, así que `null` le deja todas.
  const soloSuyos = usuario.rol === "docente" ? usuario.id : null;

  const busqueda = (q ?? "").trim().slice(0, 80);
  const periodoId = UUID.test(periodo ?? "") ? periodo! : null;

  const [filas, resumen, periodos, cursos, estudiantes, mensajes] =
    await Promise.all([
      notasRegistradas({ periodoId, busqueda, docenteId: soloSuyos }),
      resumenDeNotas({ periodoId, busqueda, umbrales: UMBRAL_BANDA }),
      periodosSimples(),
      // Los desplegables del formulario solo se llenan para quien puede
      // escribir: a quien viene a leer no le sirven de nada y son dos consultas.
      puedeRegistrar ? cursosParaNota(soloSuyos) : Promise.resolve([]),
      puedeRegistrar ? estudiantesParaNota() : Promise.resolve([]),
      mensajesCliente(["academic"]),
    ]);

  const hayFiltro = Boolean(busqueda) || Boolean(periodoId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Star className="size-5 text-[#2096BA]" />
          {t("grades.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("grades.description")}
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
            placeholder={t("grades.searchPlaceholder")}
            maxLength={80}
          />
        </div>

        <div className="min-w-44 space-y-1.5">
          <label
            htmlFor="periodo"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("grade.term")}
          </label>
          <select
            id="periodo"
            name="periodo"
            defaultValue={periodoId ?? ""}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
          >
            <option value="">{t("allTerms")}</option>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
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
            <Link href="/academico/calificaciones">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      <NextIntlClientProvider messages={mensajes}>
        <GestionCalificaciones
          notas={recortarNotas(filas)}
          resumen={resumen}
          cursos={cursos}
          estudiantes={estudiantes}
          periodos={periodos}
          puedeRegistrar={puedeRegistrar}
          hayMas={hayMasNotasQueElTope(filas)}
          hayFiltro={hayFiltro}
        />
      </NextIntlClientProvider>
    </div>
  );
}
