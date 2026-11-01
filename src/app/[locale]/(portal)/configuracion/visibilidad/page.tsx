import type { Metadata } from "next";
import { ArrowLeft, UserCog } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  FormularioVisibilidad,
  type GrupoVisibilidad,
} from "@/components/visibilidad/formulario-visibilidad";
import { Button } from "@/components/ui/button";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { FilaChips } from "@/components/ui/fila-chips";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { FUNCION_ASISTENTE, itemsDeArea, menuDe, rutasProtegidas } from "@/lib/nav";
import { ROLES, type Rol } from "@/lib/rbac";
import { resumenDeVisibilidad, visibilidadDeRol } from "@/server/visibilidad/consultas";
import { leerPermisosPorRol } from "@/server/configuracion/consultas-permisos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "visibilidad" });

  return { title: t("title") };
}

/** Todos los roles menos el administrador maestro, que siempre lo ve todo. */
const ROLES_EDITABLES = ROLES.filter((rol) => rol !== "super_admin");

/**
 * Qué ve cada rol. Solo `super_admin`.
 *
 * El catálogo de cada rol sale de `menuDe(rol)` —el mismo menú que dibuja la
 * barra lateral, ya filtrado por permisos—, así que aquí solo aparece lo que ese
 * rol podría ver de todos modos: esta pantalla quita y devuelve, no concede.
 */
export default async function PaginaVisibilidad({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ rol?: string }>;
}) {
  const { locale } = await params;
  const consulta = await searchParams;

  await requerirRol(["super_admin"]);

  const rol: Rol = (ROLES_EDITABLES as readonly string[]).includes(consulta.rol ?? "")
    ? (consulta.rol as Rol)
    : "admin";

  const [t, tRoles, resumen, actual, mensajes, permisosPorRol] = await Promise.all([
    getTranslations({ locale, namespace: "visibilidad" }),
    getTranslations({ locale, namespace: "roles" }),
    resumenDeVisibilidad(),
    visibilidadDeRol(rol),
    mensajesCliente(["visibilidad"]),
    leerPermisosPorRol(),
  ]);
  const permisosRol = new Set(
    permisosPorRol.find((r) => r.rol === rol)?.permisos ?? [],
  );

  const protegidas = new Set(rutasProtegidas(rol));
  const estadoDe = (clave: string) =>
    actual.bloqueadas.has(clave) ? "bloqueado" : actual.ocultas.has(clave) ? "oculto" : "visible";

  const grupos: GrupoVisibilidad[] = [
    ...menuDe(rol, undefined, permisosRol).map((area) => ({
      clave: area.clave,
      etiqueta: area.etiqueta,
      items: itemsDeArea(area).map((item) => ({
        clave: item.href,
        etiqueta: item.etiqueta,
        esNav: true,
        protegido: protegidas.has(item.href),
        estado: estadoDe(item.href) as "visible" | "oculto" | "bloqueado",
      })),
    })),
    {
      clave: "funciones",
      etiqueta: "",
      items: [
        {
          clave: FUNCION_ASISTENTE,
          etiqueta: t("assistant"),
          esNav: false,
          protegido: false,
          estado: estadoDe(FUNCION_ASISTENTE) as "visible" | "oculto" | "bloqueado",
        },
      ],
    },
  ];

  const cuenta = (r: string) => resumen.find((f) => f.rol === r);

  return (
    <div className="animate-entrada mx-auto max-w-4xl space-y-8 pb-10">
      <Button asChild variant="outline" size="sm">
        <Link href="/configuracion">
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </Button>

      <EncabezadoPagina titulo={t("title")} />

      <FilaChips etiqueta={t("pickRole")}>
        {ROLES_EDITABLES.map((r) => (
          <ChipFiltro
            key={r}
            icono={UserCog}
            etiqueta={tRoles(r)}
            href={`/configuracion/visibilidad?rol=${r}`}
            activo={r === rol}
          />
        ))}
      </FilaChips>

      <p className="texto-meta">
        {t("counts", { rol: tRoles(rol), o: cuenta(rol)?.ocultas ?? 0, b: cuenta(rol)?.bloqueadas ?? 0 })}
      </p>

      <NextIntlClientProvider messages={mensajes}>
        {/* `key` por rol: al cambiar de rol el formulario arranca con SU estado. */}
        <FormularioVisibilidad key={rol} rol={rol} nombreRol={tRoles(rol)} grupos={grupos} />
      </NextIntlClientProvider>
    </div>
  );
}
