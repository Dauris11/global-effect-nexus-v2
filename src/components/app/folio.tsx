import { cn } from "@/lib/utils";

/**
 * El folio de un documento (recibo, asiento, solicitud) con el estilo único de `.folio` (globals.css):
 * un solo componente evita que cada lista le ponga su propio peso y color al mismo dato.
 */
export function Folio({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("folio", className)}>{children}</span>;
}
