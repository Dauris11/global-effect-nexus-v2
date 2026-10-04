import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Une clases de Tailwind resolviendo conflictos (la última gana).
 *
 * `docs/09-sistema-visual.md` exige clases literales, no construidas por interpolación, para
 * que Tailwind las detecte al compilar. `cn` sirve para condicionales y para
 * dejar que quien usa un componente sobrescriba sus clases por defecto.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
