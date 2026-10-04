"use client";

import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

/**
 * Etiqueta de campo: arriba del input, `text-sm font-medium` en tinta
 * (docs/09-sistema-visual.md §2.4).
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm font-medium leading-none text-tinta select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
