import type { Metadata } from "next";
import { ListTodo } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { TableroTareas } from "@/components/operaciones/tablero-tareas";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import {
  proyectosSimples,
  tareasDelTablero,
  usuariosAsignables,
} from "@/server/operaciones/consultas";

import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return { title: t("tasks.title") };
}

/**
 * Tablero de tareas del equipo.
 *
 * DOS PERMISOS, no uno: `operaciones.leer` para entrar y `operaciones.escribir`
 * para mover y crear. Docencia tiene el primero y no el segundo,
 * así que ven el tablero —necesitan saber qué se está haciendo— pero no lo
 * tocan. Las acciones lo vuelven a comprobar antes de escribir; que no salga el
 * botón no es control de acceso.
 *
 * Los desplegables del formulario —proyectos y personas— solo se consultan para
 * quien puede escribir. A quien viene a mirar no le sirven de nada y son dos
 * consultas por visita.
 *
 * La visibilidad de cada tarea la resuelve el SQL con el id de la sesión, no
 * este archivo: ver `tareasDelTablero`.
 */
export default async function PaginaTareas({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirPermiso("operaciones.leer");
  const puedeEscribir = tienePermiso(usuario.rol, "operaciones.escribir");

  const [t, tareas, proyectos, personas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    tareasDelTablero({ usuarioId: usuario.id, puedeTodo: puedeEscribir }),
    puedeEscribir ? proyectosSimples() : Promise.resolve([]),
    puedeEscribir ? usuariosAsignables() : Promise.resolve([]),
    mensajesCliente(["admin"]),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-widest text-marca-500 uppercase">
            {t("hub.link_tasks")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <ListTodo className="size-5 text-marca-500" />
            {t("tasks.title")}
          </h1>
        </div>

        <Link
          href="/administrativo/tareas/hoy"
          className="inline-flex min-h-[40px] items-center rounded-lg border border-marca-500/30 bg-marca-50 px-3.5 text-xs font-semibold text-marca-600 hover:bg-marca-100 active:scale-95"
        >
          {t("hub.link_my_day")}
        </Link>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <TableroTareas
          tareas={tareas}
          proyectos={proyectos}
          personas={personas}
          puedeEscribir={puedeEscribir}
        />
      </NextIntlClientProvider>
    </div>
  );
}
