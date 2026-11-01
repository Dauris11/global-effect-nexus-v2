import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Hourglass,
  ListTodo,
  Users,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { BotonAsignarTarea } from "@/components/operaciones/torre-dialogos";
import { SelectorPersona } from "@/components/operaciones/torre-equipo";
import { TorreProyectos } from "@/components/operaciones/torre-proyectos";
import { TorreTareas } from "@/components/operaciones/torre-tareas";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { proyectosSimples, usuariosAsignables } from "@/server/operaciones/consultas";
import {
  personaTorre,
  proyectosDeUsuario,
  tareasDeUsuario,
  tieneTareasAsignadas,
} from "@/server/operaciones/torre-consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "torre" });
  return { title: t("title") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Torre de control de una persona: sus tareas por plazo y estado, sus
 * proyectos y su carga.
 *
 * Cada cuenta ve la suya. `?usuario=<id>` abre la de otra persona y solo vale
 * con `operaciones.escribir`: sin ese permiso el parámetro se ignora y se
 * enseña la propia, en vez de un error, porque la URL puede llegar compartida
 * por alguien de coordinación.
 *
 * El estudiante no tiene torre salvo que alguien le haya asignado una tarea:
 * su trabajo vive en el aula virtual.
 */
export default async function PaginaTorreControl({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ usuario?: string }>;
}) {
  const [{ locale }, { usuario: pedido }] = await Promise.all([params, searchParams]);
  const usuario = await requerirUsuario();
  const coordina = usuarioTienePermiso(usuario, "operaciones.escribir");

  const ajena = coordina && pedido && UUID.test(pedido) && pedido !== usuario.id ? pedido : null;
  const objetivoId = ajena ?? usuario.id;

  if (!ajena && usuario.rol === "estudiante" && !(await tieneTareasAsignadas(usuario.id))) {
    notFound();
  }

  const persona = ajena ? await personaTorre(ajena) : null;
  if (ajena && !persona) notFound();

  const [t, tareas, proyectos, personas, opcionesProyecto, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "torre" }),
    tareasDeUsuario(objetivoId),
    proyectosDeUsuario(objetivoId),
    coordina ? usuariosAsignables() : Promise.resolve([]),
    coordina ? proyectosSimples() : Promise.resolve([]),
    mensajesCliente(["torre", "roles"]),
  ]);

  const abiertas = tareas.filter((x) => x.estado !== "completada");
  const horas = abiertas.reduce((s, x) => s + Number(x.horas_estimadas || 0), 0);
  const nombre = persona?.nombre ?? usuario.nombre;
  const opcionesPersona = personas.some((p) => p.id === objetivoId)
    ? personas
    : [{ id: objetivoId, nombre }, ...personas];

  return (
    <div className="animate-entrada mx-auto max-w-6xl space-y-8">
      <EncabezadoPagina
        titulo={ajena ? t("titleOf", { nombre }) : t("title")}
        acciones={
          <NextIntlClientProvider messages={mensajes}>
            <div className="flex flex-wrap items-center gap-2">
              {coordina && <SelectorPersona personas={opcionesPersona} actual={objetivoId} />}
              {coordina && (
                <Button asChild variant="outline">
                  <Link href="/administrativo/torre-control/equipo">
                    <Users className="size-4" />
                    {t("teamLink")}
                  </Link>
                </Button>
              )}
              {coordina && (
                <BotonAsignarTarea persona={{ id: objetivoId, nombre }} proyectos={opcionesProyecto} />
              )}
            </div>
          </NextIntlClientProvider>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard icono={ListTodo} valor={abiertas.length} etiqueta={t("stats.open")} acento />
        <StatCard icono={AlertCircle} valor={tareas.filter((x) => x.vencida).length} etiqueta={t("stats.overdue")} />
        <StatCard icono={CalendarClock} valor={abiertas.filter((x) => x.es_hoy).length} etiqueta={t("stats.today")} />
        <StatCard icono={CalendarRange} valor={abiertas.filter((x) => x.esta_semana).length} etiqueta={t("stats.week")} />
        <StatCard icono={Hourglass} valor={horas} etiqueta={t("stats.hours")} />
        <StatCard
          icono={CheckCircle2}
          valor={tareas.length - abiertas.length}
          etiqueta={t("stats.done")}
        />
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <TorreTareas tareas={tareas} puedeCoordinar={coordina} personas={personas} />
      </NextIntlClientProvider>

      <TorreProyectos proyectos={proyectos} />
    </div>
  );
}
