import { ArrowLeft, QrCode } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EscanearQrActivo } from "@/components/inventario/escanear-qr";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";

export default async function PaginaEscanearInventario({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("inventario.auditar");

  const [t, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "admin.inventario" }),
    mensajesCliente(["admin"]),
  ]);

  return (
    <div className="animate-entrada mx-auto flex w-full max-w-xl flex-col gap-6">
      {/* Navegación y Encabezado */}
      <div>
        <Link
          href="/administrativo/inventario"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-2 transition-colors hover:text-tinta"
        >
          <ArrowLeft className="size-4" />
          <span>{t("volverInventario")}</span>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
            <QrCode className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-tinta sm:text-2xl">
              {t("escanerTitulo")}
            </h1>
          </div>
        </div>
      </div>

      {/* Componente del Escáner */}
      <NextIntlClientProvider messages={mensajes}>
        <EscanearQrActivo />
      </NextIntlClientProvider>
    </div>
  );
}
