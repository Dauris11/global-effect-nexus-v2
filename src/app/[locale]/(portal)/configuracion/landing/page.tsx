import type { Metadata } from "next";
import { ExternalLink, Megaphone } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { AnunciosHero } from "@/components/configuracion/anuncios-hero";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { diapositivasParaAdmin } from "@/server/landing/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "announcements" });

  return { title: t("title") };
}

/**
 * Anuncios del hero de la portada.
 *
 * Entra quien tenga `landing.administrar`, el permiso que la migración 0015 creó
 * para esto y asignó a `admin` y `super_admin`. Se comprueba por permiso y no
 * por rol porque es la base la que decide quién edita la cara pública del
 * sistema, no una lista escrita aquí.
 *
 * La lista incluye los ocultos: los tres que la migración 0018 desactivó siguen
 * en la tabla precisamente para esto —tener algo que editar y reactivar cuando
 * haya un mensaje real que anunciar— y desde aquí se ven y se retocan.
 */
export default async function PaginaAnunciosLanding({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  await requerirPermiso("landing.administrar");

  const [t, anuncios, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "announcements" }),
    diapositivasParaAdmin(),
    // `AnunciosHero` es cliente y usa `useTranslations("announcements")`, un
    // espacio que el proveedor del layout no manda al navegador: solo lleva los
    // cuatro del armazón. Sin esto la pantalla sale con las claves en crudo.
    // Los anidados REEMPLAZAN el subárbol, así que van los base también.
    mensajesCliente(["announcements"]),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="size-5 text-[#2096BA]" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            {t("desc")}
          </p>
        </div>

        {/* Enlace a la portada, que es donde se comprueba el resultado. En
            pestaña nueva para no perder el panel al ir a mirar. */}
        <Button asChild variant="outline" size="sm">
          <Link href="/" target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            {t("openHome")}
          </Link>
        </Button>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <AnunciosHero anuncios={anuncios} />
      </NextIntlClientProvider>
    </div>
  );
}
