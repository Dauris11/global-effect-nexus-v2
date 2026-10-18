import type { Metadata } from "next";
import { ArrowLeft, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GestorPermisosUsuario } from "@/components/configuracion/gestor-permisos-usuario";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { listarUsuariosConPermisos } from "@/server/configuracion/acciones-permisos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Gestión de Permisos Individuales — Superadmin",
  };
}

export default async function PaginaPermisosUsuarios({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirRol(["super_admin"]);

  const { usuarios, permisos } = await listarUsuariosConPermisos();

  return (
    <div className="space-y-6">
      {/* Cabecera y Navegación de Regreso */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/configuracion"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#2096BA] transition-colors mb-2"
          >
            <ArrowLeft className="size-3.5" />
            Volver a Configuración
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#2096BA]/15 text-[#187a99] dark:text-[#5FB8D4]">
              <KeyRound className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Gobernanza de Permisos Individuales
              </h1>
              <p className="text-xs text-slate-500">
                Ajuste fino de permisos por usuario mediante excepciones de base de datos (`usuario_permiso`).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 max-w-sm">
          <ShieldAlert className="size-4 shrink-0 text-[#2096BA]" />
          <span>
            Las excepciones ganan sobre el rol base del usuario y quedan registradas en la bitácora de auditoría.
          </span>
        </div>
      </div>

      {/* Gestor Interactivo */}
      <GestorPermisosUsuario
        usuariosIniciales={usuarios}
        catalogoPermisos={permisos}
      />
    </div>
  );
}
