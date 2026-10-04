import type { Metadata } from "next";
import { CalendarCheck, HeartHandshake, Search, Users } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { PlanillaServicios } from "@/components/bienestar/planilla-servicios";
import { BotonImprimir } from "@/components/comida/boton-imprimir";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { VACIO } from "@/lib/paleta";
import { tienePermiso } from "@/lib/rbac";
import {
  planillaDelMes,
  resumenDelMes,
  ultimosDoceMeses,
} from "@/server/bienestar/consultas";

/** `YYYY-MM`, el formato que guarda `registro_servicio.mes`. */
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "monthlyServices" });

  return { title: t("title") };
}

/**
 * Planilla mensual de servicio comunitario y asistencia a la reunión.
 *
 * DOS PERMISOS: `operaciones.leer` para verla y `operaciones.escribir` para
 * marcar. Quien solo lee ve las casillas puestas y desactivadas, no una
 * pantalla distinta: saber quién cumplió es información útil aunque no se pueda
 * cambiar.
 *
 * El mes va en la URL (`?mes=YYYY-MM`) como el resto de filtros del sistema, y
 * el valor por omisión sale de la BASE, no de `new Date()`: el día 1, un
 * servidor en otro huso abriría el mes equivocado.
 *
 * La hoja impresa se compone con clases `print:` sobre la misma pantalla, igual
 * que la lista del comedor: lo que sobra al imprimir se marca donde está, y no
 * hay una segunda versión que mantener.
 */
export default async function PaginaServiciosMensuales({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { locale } = await params;
  const { mes } = await searchParams;

  const usuario = await requerirPermiso("operaciones.leer");
  const puedeEscribir = tienePermiso(usuario.rol, "operaciones.escribir");

  const meses = await ultimosDoceMeses();

  // Un mes con formato raro, o uno fuera de los doce que se ofrecen, cae al
  // más reciente: llega de un enlace viejo o escrito a mano.
  const elegido =
    MES.test(mes ?? "") && meses.includes(mes!) ? mes! : (meses[0] ?? "");

  const [t, filas, resumen, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "monthlyServices" }),
    planillaDelMes(elegido),
    resumenDelMes(elegido),
    mensajesCliente(["monthlyServices", "comida"]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase print:hidden">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <HeartHandshake className="size-5 text-[#2096BA] print:hidden" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{elegido}</p>
        </div>

        <NextIntlClientProvider messages={mensajes}>
          <BotonImprimir />
        </NextIntlClientProvider>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 print:hidden">
        <div className="min-w-40 space-y-1.5">
          <label
            htmlFor="mes"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("month")}
          </label>
          <select
            id="mes"
            name="mes"
            defaultValue={elegido}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm"
          >
            {meses.map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </div>

        {/* Botón de verdad y no un `onChange`: esta pantalla es de servidor,
            así que no hay dónde colgar el evento, y un `<noscript>` sería peor
            —dejaría el control muerto justo para quien sí tiene JavaScript—.
            Es además el mismo patrón que las demás barras de filtro. */}
        <Button
          type="submit"
          className="transition-transform duration-150 active:scale-95"
        >
          <Search className="size-4" />
          {t("month")}
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3 print:hidden">
        <CifraAcademica
          valor={resumen.total}
          etiqueta={t("stats.called")}
          icono={Users}
        />
        <CifraAcademica
          valor={
            resumen.total > 0
              ? `${Math.round((resumen.con_servicio / resumen.total) * 100)}%`
              : "—"
          }
          etiqueta={t("stats.service")}
          icono={HeartHandshake}
          acento
        />
        <CifraAcademica
          valor={
            resumen.total > 0
              ? `${Math.round((resumen.con_reunion / resumen.total) * 100)}%`
              : "—"
          }
          etiqueta={t("stats.meeting")}
          icono={CalendarCheck}
        />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-5">
          {filas.length === 0 ? (
            <div className={VACIO.contenedor}>
              <span className={`${VACIO.icono} print:hidden`}>
                <Users className="size-6" />
              </span>
              <p className={VACIO.titulo}>{t("empty")}</p>
              <p className={VACIO.descripcion}>{t("emptyHint")}</p>
            </div>
          ) : (
            <NextIntlClientProvider messages={mensajes}>
              <PlanillaServicios
                filas={filas}
                mes={elegido}
                puedeEscribir={puedeEscribir}
              />
            </NextIntlClientProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
