import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Clock, UtensilsCrossed } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { BotonImprimir } from "@/components/comida/boton-imprimir";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { fechaLarga } from "@/lib/fechas";
import { CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  comensalesDelDia,
  resumenDelComedor,
} from "@/server/comida/consultas";

/** `YYYY-MM-DD`, que es lo que la URL puede traer y `date` acepta. */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comida" });

  return { title: t("adminTitle") };
}

/**
 * La lista con la que cocina el comedor.
 *
 * Es la otra cara de `/comida`: aquella es la puerta pública donde la gente se
 * apunta sin cuenta; esta es la vista interna, con `operaciones.leer`.
 *
 * NO ESCRIBE NADA, y por eso no hay más JavaScript que el botón de imprimir.
 * Quitar a alguien de la lista o añadirlo a mano sería otra decisión —¿quién
 * puede?, ¿queda rastro?— y no una casilla más en esta pantalla.
 *
 * LA HORA DE CORTE NO SE REPITE AQUÍ. Sale del mismo SQL que ya usan la página
 * pública y la acción de inscripción. Si el comedor pasa a cerrar a las 9:00,
 * el cambio es en un sitio.
 *
 * La hoja impresa se compone con clases `print:` en vez de un CSS aparte: lo
 * que sobra al imprimir —filtros, botones, cifras— se marca `print:hidden`
 * donde está, y así nadie tiene que acordarse de mantener dos versiones de la
 * misma pantalla.
 */
export default async function PaginaListaComida({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { locale } = await params;
  const { fecha } = await searchParams;
  const idioma: Locale = locale === "en" ? "en" : "es";

  await requerirPermiso("operaciones.leer");

  const t = await getTranslations({ locale, namespace: "comida" });

  // Sin fecha válida en la URL se mira hoy. `resumenDelComedor` devuelve la
  // fecha de hoy SEGÚN LA BASE, que es la que manda para la navegación.
  const pedida = FECHA.test(fecha ?? "") ? fecha! : null;

  const [comensales, resumen, mensajes] = await Promise.all([
    comensalesDelDia(pedida),
    resumenDelComedor(pedida),
    mensajesCliente(["comida"]),
  ]);

  // El día que se está mirando: el pedido, o el de hoy que devolvió la base.
  const dia = pedida ?? resumen.hoy;

  const mover = (dias: number) => {
    const base = new Date(`${dia}T00:00:00`);
    base.setDate(base.getDate() + dias);

    return `/inscripcion-comida?fecha=${base.toISOString().slice(0, 10)}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase print:hidden">
            {t("title")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <UtensilsCrossed className="size-5 text-[#2096BA] print:hidden" />
            {t("adminTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {fechaLarga(dia, idioma)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* El estado de la recepción solo tiene sentido mirando HOY: para un
              día pasado, "cerrado" no informa de nada. */}
          {dia === resumen.hoy && (
            <Badge
              className={cn(
                "text-[10px] print:hidden",
                resumen.abierto
                  ? "bg-[#2096BA]/15 text-[#187a99]"
                  : "bg-[#171A1D] text-white",
              )}
            >
              <Clock className="size-3" />
              {resumen.abierto ? t("open") : t("closed")}
            </Badge>
          )}

          <NextIntlClientProvider messages={mensajes}>
            <BotonImprimir />
          </NextIntlClientProvider>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={mover(-1)}>
            <ChevronLeft className="size-3.5" />
            {t("prevDay")}
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm">
          <Link href={mover(1)}>
            {t("nextDay")}
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>

        {dia !== resumen.hoy && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/inscripcion-comida">{t("enrolledToday")}</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 print:hidden">
        <CifraAcademica
          valor={resumen.total}
          etiqueta={t("total")}
          icono={UtensilsCrossed}
          acento
        />
        <CifraAcademica
          valor={resumen.a_tiempo}
          etiqueta={t("open")}
          icono={Clock}
        />
        <CifraAcademica
          valor={resumen.tarde}
          etiqueta={t("closed")}
          icono={Clock}
        />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-5">
          <CardTitle className="mb-3">
            <UtensilsCrossed className="size-4 print:hidden" />
            {t("adminTitle")}
            <Badge className="ml-1 bg-[#2096BA]/15 text-[10px] text-[#187a99] print:hidden">
              {resumen.total}
            </Badge>
          </CardTitle>

          {comensales.length === 0 ? (
            <div className={VACIO.contenedor}>
              <span className={cn(VACIO.icono, "print:hidden")}>
                <UtensilsCrossed className="size-6" />
              </span>
              <p className={VACIO.titulo}>{t("nobody")}</p>
            </div>
          ) : (
            <ol className="divide-y">
              {comensales.map((comensal, indice) => (
                <li
                  key={comensal.id}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  {/* El número de comensal: es como cuenta la cocina. */}
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                      CUADRO.neutro,
                    )}
                  >
                    {indice + 1}
                  </span>

                  <span className="min-w-0 flex-1 truncate font-medium">
                    {comensal.nombre}
                  </span>

                  {/* Quien llegó fuera de hora se marca en tinta, no en rojo, y
                      se sigue sirviendo: la marca es información para la
                      cocina, no una sanción. */}
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs",
                      comensal.a_tiempo
                        ? "text-muted-foreground"
                        : "font-semibold text-[#171A1D]",
                    )}
                  >
                    {comensal.hora_inscripcion}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
