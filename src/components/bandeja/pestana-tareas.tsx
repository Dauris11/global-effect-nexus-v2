import { ListChecks, Table2 } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { VistaHoy } from "@/components/colaborador/vista-hoy";
import { TableroTareas } from "@/components/operaciones/tablero-tareas";
import { variantesBoton } from "@/components/ui/button-variantes";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import type { UsuarioSesion } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  bitacoraDeHoy,
  proyectosPorRol,
  resumenColaborador,
  tareasColaborador,
} from "@/server/colaborador/consultas";
import {
  actividadesSimples,
  proyectosSimples,
  tareasDelTablero,
  usuariosAsignables,
} from "@/server/operaciones/consultas";

/**
 * Pestaña «Mis tareas»: por defecto, mi Kanban (solo lo que tengo asignado,
 * con mi planificación de hoy y de la semana por proyecto y actividad) y, en
 * `?vista=hoy`, «Mi día» con la bitácora.
 *
 * El Kanban es de todo el personal: la consulta filtra por asignación, así que
 * nadie ve tareas ajenas. Crear tareas sigue pidiendo `operaciones.escribir`
 * (la acción lo vuelve a comprobar); los desplegables del formulario solo se
 * consultan para quien puede escribir.
 */
export async function PestanaTareas({
  usuario,
  idioma,
  vista,
}: {
  usuario: UsuarioSesion;
  idioma: string;
  vista: string | undefined;
}) {
  const puedeRendir = usuarioTienePermiso(usuario, "rendicion.enviar");
  const enHoy = vista === "hoy";
  const t = await getTranslations({ locale: idioma, namespace: "bandeja" });

  const selector = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/bandeja?tab=tareas"
        aria-current={enHoy ? undefined : "page"}
        className={variantesBoton({ variant: enHoy ? "outline" : "default", size: "sm" })}
      >
        <Table2 className="size-4" />
        {t("views.board")}
      </Link>
      <Link
        href="/bandeja?tab=tareas&vista=hoy"
        aria-current={enHoy ? "page" : undefined}
        className={variantesBoton({ variant: enHoy ? "default" : "outline", size: "sm" })}
      >
        <ListChecks className="size-4" />
        {t("views.today")}
      </Link>
      {puedeRendir && enHoy && (
        <Link
          href="/administrativo/rendiciones"
          className={variantesBoton({ variant: "outline", size: "sm" })}
        >
          {t("views.expense")}
        </Link>
      )}
    </div>
  );

  if (!enHoy) {
    const puedeEscribir = usuarioTienePermiso(usuario, "operaciones.escribir");
    const [tareas, proyectos, actividades, personas, mensajes] = await Promise.all([
      tareasDelTablero({ usuarioId: usuario.id, puedeTodo: puedeEscribir, soloMias: true }),
      puedeEscribir ? proyectosSimples() : Promise.resolve([]),
      puedeEscribir ? actividadesSimples() : Promise.resolve([]),
      puedeEscribir ? usuariosAsignables() : Promise.resolve([]),
      mensajesCliente(["admin"]),
    ]);

    return (
      <div className="space-y-6">
        {selector}
        <NextIntlClientProvider messages={mensajes}>
          <TableroTareas
            tareas={tareas}
            proyectos={proyectos}
            actividades={actividades}
            personas={personas}
            puedeEscribir={puedeEscribir}
            soloMias
          />
        </NextIntlClientProvider>
      </div>
    );
  }

  const [tareas, bitacora, proyectos, resumen, mensajes] = await Promise.all([
    tareasColaborador(usuario.id),
    bitacoraDeHoy(usuario.id),
    proyectosPorRol(usuario.rol),
    resumenColaborador(usuario.id),
    mensajesCliente(["colaborador", "rendicion", "admin"]),
  ]);

  return (
    <div className="space-y-6">
      {selector}
      <NextIntlClientProvider messages={mensajes}>
        <VistaHoy
          tareasIniciales={tareas}
          bitacoraInicial={bitacora}
          proyectosAsignados={proyectos}
          resumen={resumen}
        />
      </NextIntlClientProvider>
    </div>
  );
}
