import type { Metadata } from "next";
import { FolderKanban, Inbox, ListChecks } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { InicioModulos } from "@/components/operaciones/inicio-modulos";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { KpiEnlace } from "@/components/ui/kpi-enlace";
import { requerirUsuario } from "@/lib/auth";
import { menuDe } from "@/lib/nav";
import { usuarioTienePermiso } from "@/lib/rbac";
import { proyectosConAvance, tareasDelTablero } from "@/server/operaciones/consultas";
import { cuantasPorAtender } from "@/server/solicitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });

  return { title: t("admin") };
}

/**
 * Resumen del módulo administrativo: tres cifras que llevan a su pantalla y
 * todos los módulos que esta persona puede abrir. Sin gráficas: esas viven en
 * los reportes y el dashboard.
 *
 * Es universal, como `/bandeja`: cada cifra y cada módulo se filtra por los
 * permisos de quien mira. Los módulos salen del área `operaciones` de `menuDe`,
 * la misma que pinta la barra lateral.
 */
export default async function PaginaAdministrativo({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirUsuario();
  const t = await getTranslations({ locale, namespace: "admin" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  const ve = (permiso: Parameters<typeof usuarioTienePermiso>[1]) =>
    usuarioTienePermiso(usuario, permiso);

  const [porAtender, proyectos, tareas] = await Promise.all([
    cuantasPorAtender(usuario),
    ve("operaciones.leer") ? proyectosConAvance() : Promise.resolve(null),
    tareasDelTablero({ usuarioId: usuario.id, puedeTodo: false, soloMias: true }),
  ]);

  const deHoy = tareas.filter(
    (tarea) => tarea.estado !== "completada" && (tarea.es_hoy || tarea.vencida),
  ).length;

  // Solo el área administrativa: contabilidad y el resto tienen su propio inicio.
  const area = menuDe(usuario.rol, new Set(usuario.permisos)).find(
    (candidata) => candidata.clave === "operaciones",
  );
  const secciones = (area?.secciones ?? [])
    .map((seccion) => ({
      ...seccion,
      items: seccion.items.filter((item) => item.href !== "/administrativo"),
    }))
    .filter((seccion) => seccion.items.length > 0);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-8">
      <EncabezadoPagina titulo={tn("admin")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiEnlace
          href="/administrativo/solicitudes"
          icono={Inbox}
          etiqueta={t("home.toAttend")}
          valor={porAtender}
          acento={porAtender > 0}
        />
        {proyectos && (
          <KpiEnlace
            href="/administrativo/proyectos"
            icono={FolderKanban}
            etiqueta={t("home.activeProjects")}
            valor={proyectos.filter((proyecto) => proyecto.estado === "en_curso").length}
          />
        )}
        <KpiEnlace
          href="/bandeja?tab=tareas"
          icono={ListChecks}
          etiqueta={t("home.tasksToday")}
          valor={deHoy}
          acento={deHoy > 0}
        />
      </div>

      <InicioModulos secciones={secciones} locale={locale} />
    </div>
  );
}
