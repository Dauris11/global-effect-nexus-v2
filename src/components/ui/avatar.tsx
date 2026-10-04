"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

/**
 * Avatar con recurso alternativo.
 *
 * En expedientes muchos estudiantes no tienen foto, así que `AvatarFallback`
 * con la inicial del nombre es el caso normal, no la excepción.
 */

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-primary/10 text-primary flex size-full items-center justify-center rounded-full text-sm font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
