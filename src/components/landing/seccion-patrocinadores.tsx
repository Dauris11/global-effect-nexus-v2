import { ArrowRight, FileText, LineChart, Mail, Route } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { parametros } from "@/server/parametros/consultas";

import {
  CONTENEDOR,
  SECCION,
  TITULO_SECCION,
} from "@/components/landing/piezas";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Sección para patrocinadores.
 *
 * Antes era el único bloque oscuro de la página, un degradado de tinta y azul.
 * Con la norma de app web (docs/09 §1) el lienzo es blanco y las secciones se
 * separan por aire y línea; lo que distingue a esta es que habla a alguien de
 * fuera, y eso lo dice el titular, no el fondo.
 *
 * Partida en dos: la promesa y las dos acciones a la izquierda, las tres
 * garantías a la derecha como filas con su línea de prueba. Iba en tres
 * tarjetas de icono y título, pero un título sin la frase que lo sostiene es
 * un eslogan, y a un patrocinador hay que decirle qué verá exactamente.
 */
export async function SeccionPatrocinadores() {
  const t = await getTranslations("landing");
  const correo = (await parametros())["contacto.correo"];

  const garantias = [
    { clave: "traceability", icono: Route },
    { clave: "records", icono: FileText },
    { clave: "reports", icono: LineChart },
  ];

  return (
    <section id="patrocinadores" className={SECCION}>
      <div className={`${CONTENEDOR} grid gap-12 lg:grid-cols-12 lg:gap-16`}>
        <div className="revelar lg:col-span-6">
          <h2 className={TITULO_SECCION}>{t("sponsorTitle")}</h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-tinta-2">
            {t("sponsorLead")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="group/cta">
              <Link href="/login">
                {t("enter")}
                <ArrowRight className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
              </Link>
            </Button>

            {/*
              Correo y no una ruta: no hay formulario de contacto en el sistema,
              y fabricar uno que no envía a ninguna parte sería peor que el
              `mailto`. La dirección es la misma que el pie, así que sale de la
              misma clave.
            */}
            <Button asChild size="lg" variant="secondary" className="min-w-0">
              <a href={`mailto:${correo}`}>
                <Mail />
                <span className="truncate">{correo}</span>
              </a>
            </Button>
          </div>
        </div>

        <ul className="revelar-hijos lg:col-span-6">
          {garantias.map((garantia) => (
            <li
              key={garantia.clave}
              className="flex gap-5 border-t border-linea py-6 first:border-t-0 first:pt-0 lg:first:pt-2"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-tinta">
                <garantia.icono className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-[-0.01em] text-tinta">
                  {t(`sponsor_${garantia.clave}_title`)}
                </h3>
                <p className="mt-1 leading-relaxed text-tinta-2">
                  {t(`sponsor_${garantia.clave}_desc`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
