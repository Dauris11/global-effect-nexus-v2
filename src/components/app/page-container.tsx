import { cn } from "@/lib/utils";

/**
 * Contenedor único de ancho (docs/ux-rules.md §11): el armazón (`main` de `AppShell`) ya da 1200 px centrados con
 * 24/32 px de margen a TODAS las páginas; este componente solo fija el ritmo vertical y deja que una página
 * concreta (Inicio, 1100 px) se estreche con `className`. `ancho` quita el tope para tablas y tableros kanban.
 */
export function PageContainer({ children, ancho = false, className }: { children: React.ReactNode; ancho?: boolean; className?: string }) {
  return <div className={cn("w-full", ancho ? "" : "mx-auto max-w-[1200px]", className)}>{children}</div>;
}
