import type { Metadata } from "next";
import { Palette, ShieldCheck, User } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { SelectorApariencia } from "@/components/apariencia/selector-apariencia";
import { FormularioPerfil } from "@/components/perfil/formulario-perfil";
import { Badge } from "@/components/ui/badge";
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
      {/* Encabezado simple, sin banner: avatar, nombre, rol y correo. */}
      <header className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-2xl font-semibold text-tinta ring-1 ring-linea">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={usuario.nombre} className="size-full object-cover" />
          ) : (
            <span>{usuario.nombre.trim().charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-page font-semibold tracking-tight text-tinta">{usuario.nombre}</h1>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant="marca">
              <ShieldCheck />
              {rolTraducido}
            </Badge>
            {/* `truncate`: un correo no tiene espacios y sin esto se saldría en móvil. */}
            <span className="truncate text-sm text-tinta-2">{usuario.email}</span>
          </div>
        </div>
      </header>

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

