import { UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EstadoVacio } from "@/components/ui/estado-vacio";

/**
 * Lo que ve un estudiante cuyo usuario todavía no está enlazado a una ficha
 * (`estudiante.usuario_id`).
 *
 * Cada subpágina consulta por `estudiante_id`, así que sin ficha no hay nada que
 * consultar. Se explica y se remite a coordinación en vez de dibujar la pantalla
 * con todo a cero, que parecería un fallo del sistema y no un enlace pendiente.
 * Es un `EstadoVacio` porque eso es lo que es: una pantalla sin nada todavía,
 * que dice cuándo dejará de estarlo.
 */
export async function AvisoSinFicha() {
  const t = await getTranslations("studentPortal");

  return (
    <EstadoVacio
      icono={UserX}
      titulo={t("noRecord")}
      texto={t("noRecordHint")}
      className="mx-auto max-w-xl"
    />
  );
}
