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
  proyectosSimples,
  tareasDelTablero,
  usuariosAsignables,
} from "@/server/operaciones/consultas";

/**
 * Pestaña «Mis tareas»: «Mi día» (lo que me toca hoy, con bitácora) y, para
 * quien tiene `operaciones.leer`, el tablero de tareas del equipo
 * (`?vista=tablero`).
 *
 * Mi día es de todo el personal; el tablero conserva sus dos permisos de
 * siempre: `operaciones.leer` para verlo y `operaciones.escribir` para mover y
 * crear (las acciones lo vuelven a comprobar). Los desplegables del formulario
 * solo se consultan para quien puede escribir.
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
  const verTablero = usuarioTienePermiso(usuario, "operaciones.leer");
  const puedeRendir = usuarioTienePermiso(usuario, "rendicion.enviar");
  const enTablero = verTablero && vista === "tablero";
  const t = await getTranslations({ locale: idioma, namespace: "bandeja" });

  const selector = verTablero && (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/bandeja?tab=tareas"
        aria-current={enTablero ? undefined : "page"}
        className={variantesBoton({ variant: enTablero ? "outline" : "default", size: "sm" })}
      >
        <ListChecks className="size-4" />
        {t("views.today")}
      </Link>
      <Link
        href="/bandeja?tab=tareas&vista=tablero"
        aria-current={enTablero ? "page" : undefined}
        className={variantesBoton({ variant: enTablero ? "default" : "outline", size: "sm" })}
      >
        <Table2 className="size-4" />
        {t("views.board")}
      </Link>
      {puedeRendir && !enTablero && (
        <Link
          href="/administrativo/rendiciones"
          className={variantesBoton({ variant: "outline", size: "sm" })}
        >
          {t("views.expense")}
        </Link>
      )}
    </div>
  );

  if (enTablero) {
    const puedeEscribir = usuarioTienePermiso(usuario, "operaciones.escribir");
    const [tareas, proyectos, personas, mensajes] = await Promise.all([
      tareasDelTablero({ usuarioId: usuario.id, puedeTodo: puedeEscribir }),
      puedeEscribir ? proyectosSimples() : Promise.resolve([]),
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
            personas={personas}
            puedeEscribir={puedeEscribir}
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
