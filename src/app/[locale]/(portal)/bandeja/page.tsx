import type { Metadata } from "next";
import { CalendarPlus, GanttChartSquare, Inbox, ListTodo, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PestanaDecidir } from "@/components/bandeja/pestana-decidir";
import { PestanaEquipo } from "@/components/bandeja/pestana-equipo";
import { PestanaTareas } from "@/components/bandeja/pestana-tareas";
import { variantesBoton } from "@/components/ui/button-variantes";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { FilaChips } from "@/components/ui/fila-chips";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requerirUsuario } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bandeja" });

  return { title: t("title") };
}

type Pestana = "decidir" | "tareas" | "equipo";

/**
 * Pendientes (ruta `/bandeja`): un solo lugar para lo que espera a alguien.
 * Junta lo que eran la bandeja, las tareas, «Mi día» y la torre de control, que
 * mostraban el mismo trabajo desde cuatro pantallas.
 *
 *  - `?tab=decidir` (admin y super_admin): solicitudes y avisos por decidir,
 *    proyectos, agenda y gráficas. Es la pestaña de inicio de esos roles.
 *  - `?tab=tareas`: Mi día y, con `operaciones.leer`, el tablero
 *    (`&vista=tablero`). Es de todo el personal.
 *  - `?tab=equipo`: carga del equipo y, con `&usuario=<id>`, el detalle de una
 *    persona. Pide `operaciones.escribir`.
 *
 * Cada pestaña conserva el control que tenía como pantalla suelta, y una
 * pestaña pedida sin permiso cae en la primera disponible en vez de dar error:
 * el enlace puede llegar compartido. El menú solo ofrece esta ruta al admin;
 * el resto de roles entra por «Mi día» desde sus atajos. Esconder la pestaña no
 * es control de acceso: las consultas y acciones de cada una lo comprueban.
 *
 * Solo se consulta la pestaña activa, para no cargar tres pantallas por visita.
 */
export default async function PaginaPendientes({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; vista?: string; usuario?: string }>;
}) {
  const [{ locale }, { tab, vista, usuario: usuarioPedido }] = await Promise.all([
    params,
    searchParams,
  ]);
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirUsuario();
  const esAdmin = usuario.rol === "admin" || usuario.rol === "super_admin";
  const verEquipo = usuarioTienePermiso(usuario, "operaciones.escribir");

  const disponibles: Pestana[] = [
    ...(esAdmin ? (["decidir"] as const) : []),
    "tareas",
    ...(verEquipo ? (["equipo"] as const) : []),
  ];
  const activa = disponibles.find((p) => p === tab) ?? disponibles[0]!;

  const [t, tNav] = await Promise.all([
    getTranslations({ locale, namespace: "bandeja" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);
  const etiquetas: Record<Pestana, { texto: string; icono: typeof Inbox }> = {
    decidir: { texto: t("tabs.decide"), icono: Inbox },
    tareas: { texto: t("tabs.tasks"), icono: ListTodo },
    equipo: { texto: t("tabs.team"), icono: Users },
  };

  return (
    <div className="animate-entrada space-y-6 md:space-y-8">
      <EncabezadoPagina
        titulo={t("title")}
        acciones={
          esAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/calendario/gantt"
                className={variantesBoton({ variant: "outline", size: "sm" })}
              >
                <GanttChartSquare className="size-4" />
                {tNav("timeline")}
              </Link>
              <Link
                href="/reuniones?agendar=true"
                className={variantesBoton({ size: "sm" })}
              >
                <CalendarPlus className="size-4" />
                {tNav("meetings")}
              </Link>
            </div>
          )
        }
      />

      <FilaChips etiqueta={t("tabs.label")}>
        {disponibles.map((p) => (
          <ChipFiltro
            key={p}
            href={`/bandeja?tab=${p}`}
            icono={etiquetas[p].icono}
            etiqueta={etiquetas[p].texto}
            activo={p === activa}
          />
        ))}
      </FilaChips>

      {activa === "decidir" && <PestanaDecidir usuario={usuario} idioma={idioma} />}
      {activa === "tareas" && (
        <PestanaTareas usuario={usuario} idioma={idioma} vista={vista} />
      )}
      {activa === "equipo" && <PestanaEquipo idioma={idioma} usuarioPedido={usuarioPedido} />}
    </div>
  );
}
