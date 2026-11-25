import {
  AlertCircle,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Flame,
  Hourglass,
  ListTodo,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { BotonAsignarTarea } from "@/components/operaciones/torre-dialogos";
import { SelectorPersona, TorreEquipo } from "@/components/operaciones/torre-equipo";
import { TorreProyectos } from "@/components/operaciones/torre-proyectos";
import { TorreTareas } from "@/components/operaciones/torre-tareas";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { UMBRAL_CARGA_ALTA } from "@/lib/torre-control";
import { proyectosSimples, usuariosAsignables } from "@/server/operaciones/consultas";
import {
  cargaPorPersona,
  personaTorre,
  proyectosDeUsuario,
  tareasDeUsuario,
} from "@/server/operaciones/torre-consultas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pestaña «Equipo» de Pendientes: la carga de cada persona para repartir y, con
 * `?usuario=<id>`, el detalle de una (sus tareas por plazo, proyectos y carga).
 *
 * La página ya comprobó `operaciones.escribir` antes de llegar aquí; es
 * información de gestión, no de compañeros. Un `usuario` que no es un UUID
 * válido se ignora y se enseña el equipo entero, porque la URL puede llegar
 * compartida a mano.
 */
export async function PestanaEquipo({
  idioma,
  usuarioPedido,
}: {
  idioma: string;
  usuarioPedido: string | undefined;
}) {
  const objetivoId = usuarioPedido && UUID.test(usuarioPedido) ? usuarioPedido : null;

  const [t, mensajes] = await Promise.all([
    getTranslations({ locale: idioma, namespace: "torre" }),
    mensajesCliente(["torre", "roles"]),
  ]);

  if (!objetivoId) {
    const personas = await cargaPorPersona();
    const suma = (f: (p: (typeof personas)[number]) => number) =>
      personas.reduce((s, p) => s + f(p), 0);

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icono={Users} valor={personas.length} etiqueta={t("team.people")} acento />
          <StatCard icono={ListTodo} valor={suma((p) => p.abiertas)} etiqueta={t("team.open")} />
          <StatCard icono={AlertCircle} valor={suma((p) => p.vencidas)} etiqueta={t("team.overdue")} />
          <StatCard
            icono={Flame}
            valor={personas.filter((p) => p.abiertas >= UMBRAL_CARGA_ALTA).length}
            etiqueta={t("team.overloaded")}
          />
        </div>

        <NextIntlClientProvider messages={mensajes}>
          <TorreEquipo personas={personas} />
        </NextIntlClientProvider>
      </div>
    );
  }

  const [persona, tareas, proyectos, personas, opcionesProyecto] = await Promise.all([
    personaTorre(objetivoId),
    tareasDeUsuario(objetivoId),
    proyectosDeUsuario(objetivoId),
    usuariosAsignables(),
    proyectosSimples(),
  ]);
  if (!persona) notFound();

  const abiertas = tareas.filter((x) => x.estado !== "completada");
  const horas = abiertas.reduce((s, x) => s + Number(x.horas_estimadas || 0), 0);
  const opcionesPersona = personas.some((p) => p.id === objetivoId)
    ? personas
    : [{ id: objetivoId, nombre: persona.nombre }, ...personas];

  return (
    <div className="space-y-8">
      <NextIntlClientProvider messages={mensajes}>
        <div className="flex flex-wrap items-center gap-2">
          <SelectorPersona personas={opcionesPersona} actual={objetivoId} />
          <Button asChild variant="outline">
            <Link href="/bandeja?tab=equipo">
              <Users className="size-4" />
              {t("teamLink")}
            </Link>
          </Button>
          <BotonAsignarTarea
            persona={{ id: objetivoId, nombre: persona.nombre }}
            proyectos={opcionesProyecto}
          />
        </div>
      </NextIntlClientProvider>

      <h2 className="texto-titulo-seccion">{t("titleOf", { nombre: persona.nombre })}</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard icono={ListTodo} valor={abiertas.length} etiqueta={t("stats.open")} acento />
        <StatCard icono={AlertCircle} valor={tareas.filter((x) => x.vencida).length} etiqueta={t("stats.overdue")} />
        <StatCard icono={CalendarClock} valor={abiertas.filter((x) => x.es_hoy).length} etiqueta={t("stats.today")} />
        <StatCard icono={CalendarRange} valor={abiertas.filter((x) => x.esta_semana).length} etiqueta={t("stats.week")} />
        <StatCard icono={Hourglass} valor={horas} etiqueta={t("stats.hours")} />
        <StatCard icono={CheckCircle2} valor={tareas.length - abiertas.length} etiqueta={t("stats.done")} />
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <TorreTareas tareas={tareas} puedeCoordinar personas={personas} />
      </NextIntlClientProvider>

      <TorreProyectos proyectos={proyectos} />
    </div>
  );
}
