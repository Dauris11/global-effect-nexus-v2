import { ArrowRight, FileText, LineChart, Mail, Route } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { parametros } from "@/server/parametros/consultas";

import {
  CabeceraSeccion,
  CONTENEDOR,
  SECCION,
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
 * Las tres garantías van como tres columnas de icono y título, sin párrafo:
 * lo que decían lo demuestra el sistema al entrar, no el folleto.
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
      <div className={CONTENEDOR}>
        <CabeceraSeccion titulo={t("sponsorTitle")} texto={t("sponsorEyebrow")} />

        <ul className="mt-8 grid gap-4 sm:grid-cols-3 md:gap-6">
          {garantias.map((garantia) => (
            <li
              key={garantia.clave}
              className="flex items-center gap-3 rounded-card border border-linea p-4 shadow-card"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600">
                <garantia.icono className="size-5" />
              </span>
              <span className="text-sm font-semibold text-tinta">
                {t(`sponsor_${garantia.clave}_title`)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/login">
              {t("enter")}
              <ArrowRight />
            </Link>
          </Button>

          {/*
            Correo y no una ruta: no hay formulario de contacto en el sistema, y
            fabricar uno que no envía a ninguna parte sería peor que el `mailto`.
            La dirección es la misma que el pie, así que sale de la misma clave.
          */}
          <Button asChild size="lg" variant="secondary">
            <a href={`mailto:${correo}`}>
              <Mail />
              {correo}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
