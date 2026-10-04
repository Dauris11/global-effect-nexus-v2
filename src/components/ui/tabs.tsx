"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

/**
 * Pestañas. El sistema las usa en dos escalas muy distintas:
 * como filtro (Todos / Becados / Cursos Técnicos) y como navegación de
 * formulario largo (las 6 secciones del expediente).
 *
 * Estilo subrayado, como las pestañas de Airbnb: sin caja gris alrededor, el
 * texto en tinta-2 y la activa en tinta semibold con una barra de 2 px debajo.
 * La lista se desplaza en horizontal si no cabe, en vez de partirse en dos.
 */

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "sin-barra inline-flex h-12 w-full max-w-full items-end justify-start gap-6 overflow-x-auto border-b border-linea text-tinta-2",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px inline-flex h-12 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 text-[15px] font-medium transition-colors hover:text-tinta",
        "data-[state=active]:border-tinta data-[state=active]:font-semibold data-[state=active]:text-tinta",
        "focus-visible:ring-ring outline-none focus-visible:ring-2 rounded-t-[4px]",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
