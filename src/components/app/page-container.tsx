import { cn } from "@/lib/utils";

/**
 * Contenedor único de ancho (docs/ux-rules.md §11): 1200 px centrado con 24/32 px de
 * margen. Las tablas anchas y los tableros kanban usan `ancho`, que lo quita.
 */
export function PageContainer({ children, ancho = false, className }: { children: React.ReactNode; ancho?: boolean; className?: string }) {
  return <div className={cn(ancho ? "w-full px-6 lg:px-8" : "mx-auto w-full max-w-[1200px] px-6 lg:px-8", className)}>{children}</div>;
}
