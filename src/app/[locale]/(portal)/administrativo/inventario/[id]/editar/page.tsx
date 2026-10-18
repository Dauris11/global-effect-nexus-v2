import { notFound } from "next/navigation";
import { ArrowLeft, Edit } from "lucide-react";

import { FormularioActivo } from "@/components/inventario/formulario-activo";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { obtenerActivoPorId } from "@/server/inventario/consultas";
import { usuariosAsignables } from "@/server/operaciones/consultas";

interface PaginaEditarActivoProps {
  params: Promise<{ id: string }>;
}

export default async function PaginaEditarActivo({ params }: PaginaEditarActivoProps) {
  await requerirPermiso("inventario.escribir");
  const { id } = await params;

  const [activo, usuarios] = await Promise.all([
    obtenerActivoPorId(id),
    usuariosAsignables(),
  ]);

  if (!activo) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          href={`/administrativo/inventario/${activo.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-2 transition-colors hover:text-tinta"
        >
          <ArrowLeft className="size-4" />
          <span>Volver a la Ficha del Activo</span>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
            <Edit className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-tinta sm:text-2xl">
              Editar Activo {activo.codigo}
            </h1>
            <p className="text-xs text-tinta-2">
              Los cambios de custodio, estado o ubicación física quedarán registrados en la bitácora de trazabilidad
            </p>
          </div>
        </div>
      </div>

      <FormularioActivo activo={activo} usuarios={usuarios} />
    </div>
  );
}
