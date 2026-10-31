import { ArrowRight, HeartHandshake, MapPin, MoveRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GloboApoyo } from "@/components/landing/globo-apoyo";
import {
  CabeceraSeccion,
  CONTENEDOR,
  SECCION,
} from "@/components/landing/piezas";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Sección "Dónde estamos": el globo con el arco de Estados Unidos a La Vega.
 *
 * El globo va dentro de un panel oscuro con esquinas `rounded-hoja` y la
 * sección se queda en blanco: el lienzo de la landing es blanco y solo el
 * globo, que lo necesita, lleva fondo oscuro.
 *
 * Los dos lugares se nombran también fuera del globo. Las etiquetas que flotan
 * sobre los puntos usan anclaje CSS, que hoy solo implementan los navegadores
 * Chromium; en Safari y Firefox no se ven, y sin los nombres en el texto la
 * sección no diría de dónde a dónde va el arco. Van como dos píldoras con la
 * flecha en medio —origen y destino— y nada más: el arco cuenta el recorrido y
 * repetirlo por escrito no añadía nada.
 *
 * Es un componente de servidor: solo el globo es cliente, y recibe las dos
 * etiquetas ya traducidas. Así no viaja al navegador el espacio `landing`
 * entero, que son más de 10 KB de mensajes.
 */
export async function SeccionMapa() {
  const t = await getTranslations("landing");

  return (
    <section id="donde-estamos" className={SECCION}>
      <div className={cn(CONTENEDOR, "grid items-center gap-10 lg:grid-cols-2 lg:gap-16")}>
        <div>
          <CabeceraSeccion titulo={t("mapTitle")} />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex h-11 items-center gap-2 rounded-full border border-linea px-4 text-sm font-medium text-tinta">
              <HeartHandshake className="size-4 text-marca-500" />
              {t("mapOrigin")}
            </span>

            <MoveRight aria-hidden className="size-4 text-tinta-3" />

            <span className="inline-flex h-11 items-center gap-2 rounded-full border border-linea px-4 text-sm font-medium text-tinta">
              <MapPin className="size-4 text-marca-500" />
              {t("mapDestination")}
            </span>
          </div>

          <Button asChild variant="secondary" className="mt-7">
            <Link href="#patrocinadores">
              {t("enter")}
              <ArrowRight />
            </Link>
          </Button>
        </div>

        {/* El globo necesita fondo oscuro: sus colores (tierra y halo) están
            calibrados para él. `bg-tinta` se invierte en modo oscuro, así que
            ahí se usa la superficie `muted`, que ya es oscura. */}
        <div className="rounded-hoja bg-tinta p-6 md:p-8 dark:bg-muted">
          <GloboApoyo
            etiquetaOrigen={t("mapOrigin")}
            etiquetaDestino={t("mapDestinationShort")}
          />
        </div>
      </div>
    </section>
  );
}
