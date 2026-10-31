import {
  ArrowRight,
  BookOpen,
  DollarSign,
  GraduationCap,
  Inbox,
  LogIn,
  Shield,
  UtensilsCrossed,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { aMinutos, horaLegible } from "@/lib/parametros";
import { parametros } from "@/server/parametros/consultas";

import { EstadoComedor } from "@/components/landing/estado-comedor";
import { CabeceraSeccion, CONTENEDOR } from "@/components/landing/piezas";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Franja de acción: las puertas a los portales y servicios del sistema, justo
 * debajo del hero, más los accesos directos por rol.
 *
 * Tres tarjetas blancas del mismo peso; la del portal no se pinta distinta
 * porque el CTA principal ya está en la barra ("Acceder") y repetir el
 * turquesa en una superficie entera rompería la regla del acento único
 * (docs/09 §1.2). El estado del comedor va dentro de su puerta, que es donde
 * sirve de algo.
 */
export async function SeccionAcceso({ inscritosHoy }: { inscritosHoy: number }) {
  const t = await getTranslations("landing");
  const p = await parametros();
  const horas = {
    apertura: horaLegible(p["comedor.apertura"]),
    cierre: horaLegible(p["comedor.cierre"]),
  };

  const puertas = [
    { clave: "portal", icono: LogIn, href: "/login" },
    { clave: "meals", icono: UtensilsCrossed, href: "/comida" },
    { clave: "requests", icono: Inbox, href: "/portal/estudiante/solicitudes" },
  ] as const;

  const roles = [
    { clave: "students", icono: GraduationCap },
    { clave: "teachers", icono: BookOpen },
    { clave: "admin", icono: Shield },
    { clave: "accounting", icono: DollarSign },
  ] as const;

  return (
    <section id="acceso" className="scroll-mt-36 py-12 md:scroll-mt-24 md:py-16">
      <div className={CONTENEDOR}>
        <CabeceraSeccion titulo={t("accessTitle")} />

        <ul className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
          {puertas.map((puerta) => (
            <li key={puerta.clave}>
              <Link
                href={puerta.href}
                className="group flex h-full flex-col justify-between rounded-card border border-linea bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-marca-300/80 hover:shadow-elevada focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-marca-50 text-marca-600 transition-colors group-hover:bg-marca-500 group-hover:text-white">
                      <puerta.icono className="size-6" />
                    </span>
                    <Badge variant="neutra">{t(`access_${puerta.clave}_tag`)}</Badge>
                  </div>

                  <h3 className="texto-titulo-tarjeta mt-5 text-lg text-tinta transition-colors group-hover:text-marca-600">
                    {t(`access_${puerta.clave}_title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-tinta-2">
                    {t(`access_${puerta.clave}_desc`)}
                  </p>

                  {puerta.clave === "meals" && (
                    <div className="mt-4">
                      <EstadoComedor
                        aperturaMin={aMinutos(p["comedor.apertura"])}
                        cierreMin={aMinutos(p["comedor.cierre"])}
                        textos={{
                          abierto: t("panelMealsOpen"),
                          cerrado: t("panelMealsClosed"),
                          ventana: t("panelMealsWindow", horas),
                          quedan: t.raw("panelMealsLeft") as string,
                          proximaApertura: t("panelMealsNext", horas),
                          inscritos:
                            inscritosHoy > 0
                              ? `${inscritosHoy} ${t("accessMealsSignups", { n: inscritosHoy })}`
                              : "",
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-linea/60 pt-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca-600 transition-colors group-hover:text-marca-700">
                    {t("enter")}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* Accesos por rol: todos llevan al mismo inicio de sesión, pero
            nombrar el rol le dice a cada uno "esto también es para ti". */}
        <div className="mt-8 flex flex-col gap-4 border-t border-linea pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-tinta">{t("accessRolesTitle")}</p>
          </div>

          <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {roles.map((rol) => (
              <li key={rol.clave}>
                <Link
                  href="/login"
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-full border border-linea-fuerte bg-background px-4 text-sm font-medium text-tinta transition-colors",
                    "hover:border-tinta hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97]",
                  )}
                >
                  <rol.icono className="size-4 shrink-0 text-tinta-2" />
                  <span className="truncate">{t(`role_${rol.clave}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
