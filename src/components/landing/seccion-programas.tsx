import {
  ArrowRight,
  CalendarDays,
  Coins,
  GraduationCap,
  HandCoins,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  CabeceraIcono,
  CabeceraSeccion,
  Carrusel,
  CONTENEDOR,
  ElementoCarrusel,
  SECCION,
  TarjetaAnuncio,
} from "@/components/landing/piezas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * "Cuatro programas, una sola idea" y la cadena de trazabilidad.
 *
 * Los cuatro se corresponden con módulos que existen de verdad —becas,
 * académico, eventos y comedor—, no con folletos.
 *
 * Cada uno es una tarjeta tipo anuncio: icono grande arriba, nombre y su
 * etiqueta. Ni párrafo ni viñetas: lo que el sistema registra se comprueba
 * entrando, y escribirlo aquí eran veinte líneas que nadie leía.
 *
 * Componente de servidor: no manda JavaScript al navegador.
 */
export async function SeccionProgramas() {
  const t = await getTranslations("landing");

  const programas = [
    { clave: "scholarships", icono: HandCoins, href: "#patrocinadores" },
    { clave: "training", icono: GraduationCap, href: "/login" },
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
      <div className={CONTENEDOR}>
        <CabeceraSeccion titulo={t("workTitle")} />

        <div className="mt-8">
          <Carrusel columnas={4} etiqueta={t("workTitle")}>
            {programas.map((programa) => (
              <ElementoCarrusel key={programa.clave}>
                <Link
                  href={programa.href}
                  className="block h-full rounded-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <TarjetaAnuncio
                    cabecera={<CabeceraIcono icono={programa.icono} />}
                    insignia={
                      <Badge variant="neutra" className="bg-background shadow-card">
                        {t(`work_${programa.clave}_tag`)}
                      </Badge>
                    }
                    titulo={t(`work_${programa.clave}_title`)}
                    pie={
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca-600 transition-colors group-hover:text-marca-700">
                        {t("enter")}
                        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    }
                  />
                </Link>
              </ElementoCarrusel>
            ))}
          </Carrusel>
        </div>

        {/*
          Cadena de trazabilidad: el argumento central para un patrocinador, así
          que se dibuja como un recorrido y no como tres tarjetas sueltas. Una
          línea por paso —de dónde sale y qué es— y el botón al final. Sin caja
          alrededor: la separa la línea de arriba.
        */}
        <div className="mt-10 flex flex-col gap-6 border-t border-linea pt-8 lg:flex-row lg:items-center">
          <h3 className="texto-titulo-tarjeta shrink-0">{t("chainTitle")}</h3>

          <ol className="flex flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            {cadena.map((paso, indice) => (
              <li key={paso.clave} className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-tinta">
                  <paso.icono className="size-5" />
                </span>

                <div className="min-w-0">
                  <p className="texto-meta">{t(`chain_${paso.clave}_label`)}</p>
                  <p className="text-sm font-semibold text-tinta">
                    {t(`chain_${paso.clave}_value`)}
                  </p>
                </div>

                {indice < cadena.length - 1 && (
                  <ArrowRight
                    aria-hidden
                    className="ml-1 hidden size-4 shrink-0 text-tinta-3 sm:block"
                  />
                )}
              </li>
            ))}
          </ol>

          <Button asChild variant="secondary" className="w-fit">
            <Link href="#patrocinadores">
              {t("enter")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
