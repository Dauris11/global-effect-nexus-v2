"use client";

import { PestanasModulo, TituloPagina } from "@/components/layout/pestanas-modulo";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Encabezado de las pantallas de carga: el título REAL (el del menú o la pestaña, que ya se conoce por la URL) y las
 * pestañas del módulo, en su sitio. Así, al pasar de una pestaña a otra, lo primero que se ve es la navegación del
 * módulo y debajo, el esqueleto del contenido; no la pantalla entera en blanco. En una ruta sin módulo (o un
 * detalle) queda el título como barra gris.
 */
export function EncabezadoCarga() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <TituloPagina className="text-page">
            <Skeleton className="h-9 w-56 max-w-full" />
          </TituloPagina>
        </div>
        <Skeleton className="hidden h-9 w-36 sm:block" />
      </div>
      <PestanasModulo />
    </div>
  );
}
