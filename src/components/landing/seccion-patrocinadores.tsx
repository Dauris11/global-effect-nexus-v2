import { ChevronRight, FileText, LineChart, Mail, Route } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { parametros } from "@/server/parametros/consultas";

import {
  CONTENEDOR,
  SECCION,
  TITULO_SECCION,
} from "@/components/landing/piezas";
import { variantesBoton } from "@/components/ui/button-variantes";
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

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/login"
              className={variantesBoton({ size: "lg", className: "group/cta" })}
            >
              {t("enter")}
              <ChevronRight className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
            </Link>

            {/*
              Correo y no una ruta: no hay formulario de contacto en el sistema,
              y fabricar uno que no envía a ninguna parte sería peor que el
              `mailto`. La dirección es la misma que el pie, así que sale de la
              misma clave.
            */}
            <a
              href={`mailto:${correo}`}
              className={variantesBoton({
                size: "lg",
                variant: "secondary",
                className: "min-w-0",
              })}
            >
              <Mail />
              <span className="truncate">{correo}</span>
            </a>
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
              <div className="flex min-w-0 items-center">
                <h3 className="text-lg font-semibold tracking-[-0.01em] text-tinta">
                  {t(`sponsor_${garantia.clave}_title`)}
                </h3>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
