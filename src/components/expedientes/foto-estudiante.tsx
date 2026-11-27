import { CameraOff } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * La foto de un estudiante o, si no tiene, un avatar con sus iniciales.
 *
 * Iniciales y no una silueta gris (docs/ux-rules.md): la silueta gigante ocupaba la
 * tarjeta para decir «no hay nada». El aviso «Sin foto» sigue ahí, con el estilo de
 * aviso de la marca (`marca-50`/`marca-700` con icono, no el rojo: es un dato pendiente
 * del expediente, no un error), para que alguien la suba.
 *
 * Con `Avatar` y no un `<img>` suelto: si la ruta del bucket ya no existe, cae a las
 * iniciales en vez de pintar un icono de imagen rota.
 *
 * `aviso`:
 *   · `"pildora"`: la etiqueta con texto sobre la foto (tarjetas, portada).
 *   · `"punto"`: solo el icono en la esquina (avatares pequeños de la lista), con el
 *     texto para lectores de pantalla y en el `title`.
 */
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export function FotoEstudiante({
  nombre,
  url,
  className,
  claseIcono,
  aviso,
  textoSinFoto,
}: {
  nombre: string;
  url: string | null;
  className?: string;
  /** Tamaño del texto de las iniciales (`text-xl`…), que va con el tamaño de la foto. */
  claseIcono?: string;
  aviso?: "pildora" | "punto";
  /** Texto del aviso; sin él no se pinta aviso. */
  textoSinFoto?: string;
}) {
  const sinFoto = !url;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {/* Absoluta y no `size-full` en el flujo: en la tarjeta el alto sale de
          `aspect-square`, y un alto en porcentaje contra eso no siempre se
          resuelve. */}
      <Avatar className="absolute inset-0 size-full rounded-[inherit]">
        {url && <AvatarImage src={url} alt={nombre} />}
        <AvatarFallback
          className={cn("rounded-[inherit] bg-marca-50 text-sm font-semibold text-marca-700", claseIcono)}
          aria-label={textoSinFoto ?? nombre}
        >
          {iniciales(nombre)}
        </AvatarFallback>
      </Avatar>

      {sinFoto && textoSinFoto && aviso === "pildora" && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-marca-50 px-2 py-0.5 text-xs font-medium text-marca-700 shadow-card">
          <CameraOff aria-hidden className="size-3.5" />
          {textoSinFoto}
        </span>
      )}

      {sinFoto && textoSinFoto && aviso === "punto" && (
        <span
          title={textoSinFoto}
          className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-marca-50 text-marca-700 ring-2 ring-card"
        >
          <CameraOff aria-hidden className="size-3" />
          <span className="sr-only">{textoSinFoto}</span>
        </span>
      )}
    </span>
  );
}
