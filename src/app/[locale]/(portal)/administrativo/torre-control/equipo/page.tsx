import type { Metadata } from "next";
import { AlertCircle, Flame, ListTodo, User, Users } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { TorreEquipo } from "@/components/operaciones/torre-equipo";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { UMBRAL_CARGA_ALTA } from "@/lib/torre-control";
import { cargaPorPersona } from "@/server/operaciones/torre-consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "torre" });
  return { title: t("teamTitle") };
}

/**
 * Torre del equipo: la carga de cada persona de un vistazo, para repartir.
 * Es de coordinación (`operaciones.escribir`): ver la carga de todos es
 * información de gestión, no de compañeros.
 */
export default async function PaginaTorreEquipo({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("operaciones.escribir");

  const [t, personas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "torre" }),
    cargaPorPersona(),
    mensajesCliente(["torre", "roles"]),
  ]);

  const suma = (f: (p: (typeof personas)[number]) => number) =>
    personas.reduce((s, p) => s + f(p), 0);

  return (
    <div className="animate-entrada mx-auto max-w-6xl space-y-8">
      <EncabezadoPagina
        titulo={t("teamTitle")}
        acciones={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/administrativo/torre-control">
                <User className="size-4" />
                {t("myTower")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/administrativo/tareas">
                <ListTodo className="size-4" />
                {t("boardLink")}
              </Link>
            </Button>
          </div>
        }
      />

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
