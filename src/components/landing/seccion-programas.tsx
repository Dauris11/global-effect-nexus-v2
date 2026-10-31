import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Coins,
  GraduationCap,
  HandCoins,
  Orbit,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  CONTENEDOR,
  SECCION,
  TITULO_SECCION,
} from "@/components/landing/piezas";
import { Link } from "@/i18n/navigation";

/**
 * "Cuatro programas, una sola idea" y la cadena de trazabilidad.
 *
 * Los cuatro se corresponden con módulos que existen de verdad —becas, Global
 * Effect 360, eventos y comedor—, no con folletos. Aquí hubo "Formación
 * técnica" hasta que la migración 0047 retiró los cursos técnicos.
 *
 * Composición partida: a la izquierda el titular y la cadena, que es el
 * argumento; a la derecha los programas como filas grandes, no como otra
 * rejilla de tarjetas. La sección de acceso, justo encima, ya es de tarjetas,
 * y dos rejillas seguidas hacían que la página se leyera como un catálogo.
 *
 * Componente de servidor: no manda JavaScript al navegador.
 */
export async function SeccionProgramas() {
  const t = await getTranslations("landing");

  const programas = [
    { clave: "scholarships", icono: HandCoins, href: "#patrocinadores" },
    { clave: "g360", icono: Orbit, href: "/login" },
    { clave: "events", icono: CalendarDays, href: "#eventos" },
    { clave: "meals", icono: UtensilsCrossed, href: "/comida" },
  ];

  const cadena = [
    { clave: "contribution", icono: Coins },
    { clave: "scholarship", icono: GraduationCap },
    { clave: "student", icono: UserRound },
  ];

  return (
    <section id="que-hacemos" className={SECCION}>
      <div className={`${CONTENEDOR} grid gap-12 lg:grid-cols-12 lg:gap-16`}>
        <div className="revelar lg:col-span-5">
          <h2 className={TITULO_SECCION}>{t("workTitle")}</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-tinta-2">
            {t("workLead")}
          </p>

          {/*
            Cadena de trazabilidad: el argumento central para un patrocinador,
            así que se dibuja como un recorrido vertical, con la línea que une
            los pasos. Es el único sitio de la sección donde hay una línea que
            significa algo: el dinero va de un punto al siguiente.
          */}
          <div className="mt-10">
            <h3 className="texto-titulo-tarjeta">{t("chainTitle")}</h3>

            <ol className="relative mt-5 space-y-5 before:absolute before:top-5 before:bottom-5 before:left-[21px] before:w-px before:bg-linea-fuerte">
              {cadena.map((paso) => (
                <li key={paso.clave} className="relative flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-linea bg-background text-tinta">
                    <paso.icono className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="texto-meta">{t(`chain_${paso.clave}_label`)}</p>
                    <p className="font-semibold text-tinta">
                      {t(`chain_${paso.clave}_value`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <Link
              href="#patrocinadores"
              className="group mt-8 inline-flex min-h-11 items-center gap-1.5 rounded-control font-semibold text-marca-600 transition-colors hover:text-marca-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("chainLink")}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <ul className="revelar-hijos border-t border-linea lg:col-span-7 lg:mt-2">
          {programas.map((programa) => (
            <li key={programa.clave} className="border-b border-linea">
              <Link
                href={programa.href}
                className="group -mx-3 flex min-h-24 items-center gap-5 rounded-card px-3 py-5 transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-28 md:gap-6"
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-tinta transition-[background-color,color,scale] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105 group-hover:bg-marca-500 group-hover:text-white">
                  <programa.icono className="size-6" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-semibold tracking-[-0.015em] text-tinta md:text-2xl">
                    {t(`work_${programa.clave}_title`)}
                  </span>
                  <span className="mt-1 block text-tinta-2">
                    {t(`work_${programa.clave}_desc`)}
                  </span>
                </span>

                <ArrowUpRight className="size-5 shrink-0 text-tinta-3 transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-tinta" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
