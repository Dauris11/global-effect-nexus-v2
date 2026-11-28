import type { Metadata } from "next";
import { Mail, Palette, ShieldCheck, User, UserCheck } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { SelectorApariencia } from "@/components/apariencia/selector-apariencia";
import { FormularioPerfil } from "@/components/perfil/formulario-perfil";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { urlDeAvatar } from "@/lib/supabase/almacen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });

  return { title: t("title") };
}

/**
 * Mi perfil. Cualquier rol, y solo el suyo.
 */
export default async function PaginaPerfil({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirUsuario();

  const [t, tRoles, fila, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "profile" }),
    getTranslations({ locale, namespace: "roles" }),
    consultarUna<{ descripcion: string | null; foto_url: string | null }>(
      "SELECT descripcion, foto_url FROM usuario WHERE id = $1",
      [usuario.id],
    ),
    mensajesCliente(["profile"]),
  ]);

  const rolTraducido = tRoles(usuario.rol);
  const avatarUrl = urlDeAvatar(fila?.foto_url ?? null);

  return (
    <div className="animate-entrada space-y-8 pb-10">
      {/* Banner / Header del Perfil */}
      <div className="relative overflow-hidden rounded-hoja border border-linea bg-card p-6 sm:p-8 text-tinta shadow-card">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative size-20 sm:size-24 shrink-0 rounded-2xl overflow-hidden ring-1 ring-linea bg-surface-2 flex items-center justify-center text-3xl font-extrabold text-tinta">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={usuario.nombre}
                className="size-full object-cover"
              />
            ) : (
              <span>{usuario.nombre.trim().charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-marca-50 text-marca-700 border border-linea">
                <ShieldCheck className="size-3.5" />
                {rolTraducido}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-tinta-2 border border-linea">
                <UserCheck className="size-3" />
                {t("accountActive")}
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-tinta truncate">
              {usuario.nombre}
            </h1>
            
            <p className="text-tinta-2 text-xs sm:text-sm font-mono flex items-center gap-2">
              <Mail className="size-3.5 text-tinta-3 shrink-0" />
              {/* `truncate` como el nombre de arriba: un correo no tiene
                  espacios, así que sin esto un correo institucional largo se
                  salía del banner en móvil sin siquiera puntos suspensivos. */}
              <span className="truncate">{usuario.email}</span>
            </p>
          </div>
        </div>
      </div>


      <div className="grid gap-6 md:grid-cols-3">
        {/* Formulario de Edición de Perfil (Ocupa 2 columnas en pantallas medianas+) */}
        <div className="md:col-span-2">
          <Card className="border-linea/80 dark:border-linea shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-linea dark:border-linea/60 bg-muted/50 dark:bg-surface-2 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-tinta dark:text-tinta">
                <User className="size-4 text-marca-700" />
                {t("title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <NextIntlClientProvider messages={mensajes}>
                <FormularioPerfil
                  nombre={usuario.nombre}
                  descripcion={fila?.descripcion ?? null}
                  idioma={usuario.idioma}
                  fotoActual={avatarUrl}
                />
              </NextIntlClientProvider>
            </CardContent>
          </Card>
        </div>

        {/* Tarjeta de Información del Sistema y Credenciales (Ocupa 1 columna) */}
        <div className="md:col-span-1 space-y-6">
          <Card className="rounded-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Palette className="text-marca-500 size-4" />
                {t("appearance.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NextIntlClientProvider messages={mensajes}>
                <SelectorApariencia />
              </NextIntlClientProvider>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

