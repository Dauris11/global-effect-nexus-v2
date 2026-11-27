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
        "group/tab relative -mb-px inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-[15px] font-medium transition-[color,background-color] duration-(--duracion-rapida) hover:bg-marca-50 hover:text-marca-700",
        "data-[state=active]:font-semibold data-[state=active]:text-marca-700",
        /*
         * La barra de la activa es un pseudo-elemento que crece desde el
         * centro (scaleX), y no un `border-color` que aparece de golpe: es
         * `transform`, así que no mueve nada y la GPU la anima sola.
         */
        "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-marca-500 after:scale-x-0 after:transition-transform after:duration-(--duracion-media) after:ease-salida hover:after:scale-x-50 hover:after:bg-marca-300 data-[state=active]:after:scale-x-100 data-[state=active]:after:bg-marca-500",
        "focus-visible:ring-ring outline-none focus-visible:ring-2 rounded-t-control",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[1.15em] [&_svg]:transition-transform [&_svg]:duration-(--duracion-rapida) group-hover/tab:[&_svg]:scale-110",
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
      className={cn("flex-1 outline-none data-[state=active]:animate-velo", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
