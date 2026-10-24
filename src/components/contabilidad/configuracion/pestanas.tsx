import { BookOpen, Building2, CalendarRange, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PestanaConfig } from "@/server/contabilidad/configuracion/consultas";

const ICONOS = {
  entidad: Building2,
  parametros: Scale,
  periodos: CalendarRange,
  catalogo: BookOpen,
} as const;

/**
 * Las pestañas son enlaces `?tab=` y no un Tabs de Radix: así cada sección
 * consulta solo sus datos y se puede enlazar (p. ej. desde el inicio a
 * "Períodos"). El aspecto copia `ui/tabs.tsx`.
 */
export async function PestanasConfig({ activa }: { activa: PestanaConfig }) {
  const t = await getTranslations("contab.config.tabs");

  return (
    <nav
      aria-label={t("etiqueta")}
      className="sin-barra flex h-12 w-full max-w-full items-end gap-6 overflow-x-auto border-b border-linea text-tinta-2"
    >
      {(Object.keys(ICONOS) as PestanaConfig[]).map((pestana) => {
        const Icono = ICONOS[pestana];
        const actual = pestana === activa;
        return (
          <Link
            key={pestana}
            href={`/contabilidad/configuracion?tab=${pestana}`}
            aria-current={actual ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 text-[15px] font-medium transition-colors hover:text-tinta",
              "rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              actual && "border-tinta font-semibold text-tinta",
            )}
          >
            <Icono className={cn("size-4", actual && "text-marca-500")} />
            {t(pestana)}
          </Link>
        );
      })}
    </nav>
  );
}
