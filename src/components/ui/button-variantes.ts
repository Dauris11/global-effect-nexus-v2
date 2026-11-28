import { cva } from "class-variance-authority";

/**
 * UN solo botón (docs/ux-rules.md y docs/ui-reference.html §4).
 *
 * Los colores salen de los tokens `--btn-*` de `globals.css`, que ya traen su valor claro y oscuro:
 * así el botón no necesita `dark:` y ninguna pantalla inventa uno propio.
 *
 *   primary       la acción principal (uno por pantalla).
 *   secondary     superficie blanca con borde: el resto de acciones.
 *   ghost         texto de marca sin caja: acciones terciarias y «Ver todo».
 *   danger        acción destructiva a la vista, en contorno.
 *   danger-solid  SOLO la confirmación final de algo irreversible.
 *   link          enlace dentro de un texto.
 *
 * Alturas únicas: `sm` 32 (filas de tabla), `md` 36 (por defecto), `lg` 44 (móvil y acción
 * principal del chofer). Los solo-icono (`icon`, `icon-sm`, `icon-lg`) son cuadrados del mismo
 * alto y SIEMPRE llevan `aria-label`.
 *
 * Nombres antiguos (`default`, `outline`, `destructive`) se conservan como alias para no tocar las
 * ~600 llamadas; apuntan a la variante nueva.
 */
const primaria =
  "bg-(--btn-primary-bg) text-(--btn-primary-fg) enabled:hover:bg-(--btn-primary-hover)";
const secundaria =
  "border border-(--btn-secondary-bd) bg-(--btn-secondary-bg) text-(--btn-secondary-fg) enabled:hover:bg-(--btn-secondary-hover)";
const peligro =
  "border border-(--btn-danger-bd) bg-(--btn-danger-bg) text-(--btn-danger-fg) enabled:hover:bg-(--btn-danger-hover)";

export const variantesBoton = cva(
  // `translate-y-px` al pulsar y no `scale`: el botón no cambia de tamaño ni empuja a sus vecinos.
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-semibold transicion-control outline-none enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:shadow-[0_0_0_3px_var(--btn-halo)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: primaria,
        default: primaria,
        secondary: secundaria,
        outline: secundaria,
        ghost: "text-(--btn-ghost-fg) enabled:hover:bg-(--btn-ghost-hover)",
        danger: peligro,
        destructive: peligro,
        "danger-solid":
          "bg-(--btn-danger-solid-bg) text-(--btn-danger-solid-fg) enabled:hover:opacity-90",
        link: "text-(--btn-ghost-fg) underline underline-offset-4 decoration-marca-300 enabled:hover:decoration-marca-700 enabled:active:translate-y-0",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-3.5",
        default: "h-9 px-3.5",
        lg: "h-11 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
