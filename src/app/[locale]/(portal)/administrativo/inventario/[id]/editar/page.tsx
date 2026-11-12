import { notFound } from "next/navigation";
import { ArrowLeft, Edit } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioActivo } from "@/components/inventario/formulario-activo";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { obtenerActivoPorId } from "@/server/inventario/consultas";
import { usuariosAsignables } from "@/server/operaciones/consultas";

interface PaginaEditarActivoProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function PaginaEditarActivo({ params }: PaginaEditarActivoProps) {
  const usuario = await requerirPermiso("inventario.escribir");
  const { locale, id } = await params;

  const [t, activo, usuarios, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "admin.inventario" }),
    obtenerActivoPorId(id),
    usuariosAsignables(),
    mensajesCliente(["admin"]),
  ]);

  if (!activo) {
    notFound();
  }

  const puedeEliminar = usuarioTienePermiso(usuario, "inventario.eliminar");

  return (
    <div className="animate-entrada mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          href={`/administrativo/inventario/${activo.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-2 transition-colors hover:text-tinta"
        >
          <ArrowLeft className="size-4" />
          <span>{t("volverFicha")}</span>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
            <Edit className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-tinta sm:text-2xl">
              {t("editarTitulo", { code: activo.codigo })}
            </h1>
          </div>
        </div>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <FormularioActivo
          activo={activo}
          usuarios={usuarios}
          puedeEliminar={puedeEliminar}
        />
      </NextIntlClientProvider>
    </div>
  );
}
