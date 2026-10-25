import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionCuentas } from "@/components/personal/gestion-cuentas";
import { Card, CardContent } from "@/components/ui/card";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { CUADRO } from "@/lib/paleta";
import { ROLES_ASIGNABLES } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { cifrasEquipo, equipo, repartoPorRol } from "@/server/personal/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "staff" });

  return { title: t("title") };
}

/**
 * Personal: el único sitio del sistema donde se crean cuentas y se asignan
 * roles.
 *
 * Cierra con `usuarios.administrar`, que en la base tiene solo `super_admin`. Se
 * comprueba por permiso y no por rol: si mañana hace falta otro rol de
 * administración, se le da el permiso en la base y esta pantalla lo respeta sin
 * tocar código.
 *
 * Los estudiantes no salen aquí: son cientos y su sitio es el expediente. Esta
 * pantalla es de cuentas de trabajo.
 *
 * `equipo()` habla con dos sistemas —nuestra base para el rol, Supabase Auth
 * para el último acceso— y por eso puede tardar más que una consulta normal. Se
 * pide una sola vez y las cifras se calculan sobre lo ya traído.
 */
export default async function PaginaPersonal({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirPermiso("usuarios.administrar");

  const [t, tRoles, gente, cifras, reparto, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "staff" }),
    getTranslations({ locale, namespace: "roles" }),
    equipo(),
    cifrasEquipo(),
    repartoPorRol(),
    mensajesCliente(["staff"]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <UserCog className="size-5 text-[#2096BA]" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("inviteHint")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cifra valor={cifras.total} etiqueta={t("stats.total")} />
        <Cifra valor={cifras.activas} etiqueta={t("stats.active")} />
        <Cifra valor={cifras.inactivas} etiqueta={t("stats.inactive")} />
        <Cifra valor={cifras.sin_entrar} etiqueta={t("stats.neverSignedIn")} />
      </div>

      {/* Reparto por rol: es lo que dice de un vistazo si falta cubrir un
          puesto —cero cuentas de contabilidad deja los gastos sin nadie
          que los apruebe—. */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
            {t("roles")}
          </p>

          <ul className="flex flex-wrap gap-2">
            {reparto.map((fila) => (
              <li
                key={fila.rol}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
                  fila.total === 0 ? "bg-muted text-muted-foreground" : CUADRO.marca,
                )}
              >
                {tRoles(fila.rol)}
                <span className="font-bold">{fila.total}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <NextIntlClientProvider messages={mensajes}>
        <GestionCuentas
          equipo={gente}
          roles={ROLES_ASIGNABLES}
          yo={usuario.id}
        />
      </NextIntlClientProvider>
    </div>
  );
}

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <Card>
      <CardContent className="pt-5 text-center">
        <p className="text-3xl font-bold">{valor}</p>
        <p className="text-muted-foreground mt-1 text-xs">{etiqueta}</p>
      </CardContent>
    </Card>
  );
}
