import { ArrowRight, Bus, FileText, LogIn, Utensils } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EstadoComedor } from "@/components/landing/estado-comedor";
import { CONTENEDOR } from "@/components/landing/piezas";
import { Link } from "@/i18n/navigation";
import { horaEnRD } from "@/lib/fechas";
import { aMinutos, horaCorta } from "@/lib/parametros";
import { parametros } from "@/server/parametros/consultas";

/**
 * Accesos rápidos: cuatro tarjetas que suben 64 px sobre el hero.
 *
 * El orden es FIJO (portal, comida, transporte, solicitudes) y cada tarjeta
 * ocupa siempre su sitio: quien viene a inscribirse al comedor o a ver la guagua
 * la busca por posición, no leyendo. Por eso aquí no hay reordenado, ni entrada
 * animada, ni elevación al pasar el ratón: lo único que reacciona es el borde, la
 * sombra y la flecha.
 *
 * La segunda línea de las cuatro mide lo mismo (`min-h`), esté o no el estado del
 * comedor; así nada se desplaza cuando el estado en vivo se renueva.
 *
 * Los parámetros se llaman `comedor.apertura` y `comedor.cierre` (Configuración →
 * Parámetros). La hora actual es la de La Vega, no la del servidor (que corre en
 * UTC): `horaEnRD`. La página se revalida cada 60 s, ver `page.tsx`.
 */
export async function SeccionAcceso({ idioma }: { idioma: "es" | "en" }) {
  const t = await getTranslations("landing");
  const p = await parametros();

  const ahora = aMinutos(horaEnRD(new Date()));
  const apertura = aMinutos(p["comedor.apertura"]);
  const cierre = aMinutos(p["comedor.cierre"]);
  const abierto = ahora >= apertura && ahora < cierre;

  const textoComida = abierto
    ? t("mealOpenNow", { hora: horaCorta(p["comedor.cierre"], idioma) })
    : t("mealClosedNow", { hora: horaCorta(p["comedor.apertura"], idioma) });

  const tarjetas = [
    { clave: "portal", icono: LogIn, href: "/login" },
    { clave: "meals", icono: Utensils, href: "/comida" },
    { clave: "transport", icono: Bus, href: "/transporte" },
    // Solicitudes pide sesión: el login devuelve a la pantalla de solicitudes.
    { clave: "requests", icono: FileText, href: "/login" },
  ] as const;

  return (
    <section id="accesos" aria-labelledby="accesos-titulo" className="relative z-[2] -mt-10 scroll-mt-24 md:-mt-16">
      <div className={CONTENEDOR}>
        <h2 id="accesos-titulo" className="sr-only">
          {t("quickTitle")}
        </h2>

        <ul aria-label={t("quickLabel")} className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {tarjetas.map((tarjeta) => (
            <li key={tarjeta.clave}>
              <Link
                href={tarjeta.href}
                className="group flex h-full flex-col gap-3.5 rounded-card border border-linea bg-card p-4 shadow-card transition-[box-shadow,border-color] duration-200 hover:border-marca-300 hover:shadow-elevada focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:p-5"
              >
                <span className="flex size-10 items-center justify-center rounded-control bg-marca-50 text-marca-600 dark:text-marca-300">
                  <tarjeta.icono className="size-5" />
                </span>

                <b className="text-base font-bold text-tinta">{t(`quick_${tarjeta.clave}_title`)}</b>

                <span className="-mt-2 flex min-h-[42px] items-start text-sm text-tinta-2">
                  {tarjeta.clave === "meals" ? (
                    <EstadoComedor abierto={abierto} texto={textoComida} />
                  ) : (
                    t(`quick_${tarjeta.clave}_desc`)
                  )}
                </span>

                <span className="mt-auto flex items-center justify-between text-sm font-semibold text-marca-700">
                  {t(`quick_${tarjeta.clave}_go`)}
                  <ArrowRight className="size-[18px] transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
