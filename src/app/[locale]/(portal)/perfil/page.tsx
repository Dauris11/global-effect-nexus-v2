import type { Metadata } from "next";
import { Info, Mail, ShieldCheck, User, UserCheck } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

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
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      {/* Banner / Header del Perfil */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2096BA] via-[#187a99] to-[#0a6a8a] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 size-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 size-48 rounded-full bg-[#171A1D]/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative size-20 sm:size-24 shrink-0 rounded-2xl overflow-hidden ring-4 ring-white/30 shadow-lg bg-white/20 flex items-center justify-center text-3xl font-extrabold text-white backdrop-blur-xs">
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/30 shadow-xs">
                <ShieldCheck className="size-3.5 text-white" />
                {rolTraducido}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/15 text-white border border-white/20">
                <UserCheck className="size-3" />
                {t("accountActive")}
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
              {usuario.nombre}
            </h1>
            
            <p className="text-slate-100/90 text-xs sm:text-sm font-mono flex items-center gap-2">
              <Mail className="size-3.5 text-white/80 shrink-0" />
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
          <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <User className="size-4 text-[#2096BA]" />
                {t("title")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("description")}</p>
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
          <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 pb-4">
              <CardTitle className="text-xs font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#2096BA]" />
                {t("readOnly")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              {/* Correo */}
              <div className="space-y-1">
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-[#2096BA]" />
                  {t("emailLabel")}
                </dt>
                <dd className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200 break-all bg-slate-100/70 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  {usuario.email}
                </dd>
              </div>

              {/* Rol */}
              <div className="space-y-1">
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-[#2096BA]" />
                  {t("roleLabel")}
                </dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-100/70 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  {rolTraducido}
                </dd>
              </div>

              {/* Nota informativa */}
              <div className="p-3 rounded-xl bg-[#2096BA]/10 border border-[#2096BA]/20 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                <Info className="size-4 text-[#2096BA] shrink-0 mt-0.5" />
                <span className="leading-relaxed">{t("roleHint")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

