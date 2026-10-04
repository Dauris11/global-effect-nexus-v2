import { Hammer } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Pantalla de un módulo que todavía no está construido.
 *
 * Existe para que la barra lateral no lleve a un 404. Un menú con entradas
 * muertas se prueba una vez y después no se vuelve a mirar ninguna, aunque las
 * que funcionan sean mayoría.
 *
 * Dice lo justo: qué módulo es y que todavía no está. Antes decía además en qué
 * sprint del plan tocaba y por qué existía esta pantalla, y eso es hablarle al
 * equipo que construye desde una pantalla que abre quien trabaja aquí; el estado
 * del plan vive en `docs/estado/progreso.md`, que es donde se consulta.
 *
 * Lo que NO hace: inventarse datos. No hay cifras de relleno ni tablas de
 * ejemplo, porque una pantalla que parece funcionar y no funciona es peor que
 * una que dice claramente lo que le falta.
 */
export async function EnConstruccion({
  titulo,
  descripcion,
  icono: Icono,
  color = "bg-muted text-muted-foreground",
}: {
  titulo: string;
  /** Para qué sirve el módulo, en una frase. Sale de `docs/referencia/modulos-por-portal.md`. */
  descripcion: string;
  icono: React.ComponentType<{ className?: string }>;
  /** Clase literal de color del cuadro del icono. */
  color?: string;
}) {
  const t = await getTranslations("common");

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
            color,
          )}
        >
          <Icono className="size-5" />
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">{titulo}</h1>
            <Badge variant="secondary" className="text-[10px]">
              {t("buildingTag")}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{descripcion}</p>
        </div>
      </div>

      <Card className="border-dashed shadow-sm">
        <CardContent className="pt-5">
          <div className="py-10 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted text-tinta-2">
              <Hammer className="size-7" />
            </span>
            <p className="mt-4 text-sm font-semibold">{t("buildingTitle")}</p>
            <p className="text-muted-foreground mt-1 text-xs max-w-xs mx-auto leading-relaxed">
              {descripcion}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
