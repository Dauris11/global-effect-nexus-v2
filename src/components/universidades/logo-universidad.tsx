import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * El logo de una universidad o, mientras no tenga, sus siglas en un círculo.
 * Con `Avatar`: si el archivo del bucket ya no existe cae a las siglas en vez de
 * pintar una imagen rota. `object-contain` y fondo blanco porque los logos
 * institucionales no son cuadrados ni se pueden recortar.
 */
export function LogoUniversidad({
  siglas,
  url,
  className,
}: {
  siglas: string;
  url: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-10 shrink-0 border border-linea bg-background", className)}>
      {url && <AvatarImage src={url} alt={siglas} className="object-contain p-1" />}
      <AvatarFallback className="bg-marca-50 text-[10px] font-semibold text-marca-700">
        {siglas.slice(0, 5)}
      </AvatarFallback>
    </Avatar>
  );
}
