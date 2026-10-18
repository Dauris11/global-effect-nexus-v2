import { ArrowLeft, PackagePlus } from "lucide-react";

import { FormularioActivo } from "@/components/inventario/formulario-activo";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { usuariosAsignables } from "@/server/operaciones/consultas";

export default async function PaginaNuevoActivo() {
  await requerirPermiso("inventario.escribir");

  const usuarios = await usuariosAsignables();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/administrativo/inventario"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-2 transition-colors hover:text-tinta"
        >
          <ArrowLeft className="size-4" />
          <span>Volver al Catálogo</span>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
            <PackagePlus className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-tinta sm:text-2xl">
              Registrar Nuevo Activo Físico
            </h1>
            <p className="text-xs text-tinta-2">
              El sistema generará automáticamente el código secuencial (ACT-XXXX) y su etiqueta QR única
            </p>
          </div>
        </div>
      </div>

      <FormularioActivo usuarios={usuarios} />
    </div>
  );
}
