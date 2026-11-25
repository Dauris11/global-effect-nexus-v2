import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Progreso de una cosa (avance de un proyecto, porcentaje cumplido) con su
 * nombre accesible y la cifra escrita. Es la forma de dibujar un avance a mano
 * que sustituye a los `div` con `style={{ width }}`: un solo estilo, `role=progressbar`
 * y animación que respeta `prefers-reduced-motion`.
 */
export function Medidor({
  valor,
  etiqueta,
  texto,
  className,
}: {
  /** 0-100. */
  valor: number;
  /** Qué mide, para el lector de pantalla. */
  etiqueta: string;
  /** Cifra visible junto a la barra; por defecto el porcentaje. */
  texto?: string;
  className?: string;
}) {
  const porcentaje = Math.min(100, Math.max(0, Math.round(valor)));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Progress value={porcentaje} aria-label={etiqueta} className="flex-1" />
      <span className="w-10 shrink-0 text-right text-sm font-semibold text-tinta tabular-nums">
        {texto ?? `${porcentaje}%`}
      </span>
    </div>
  );
}
