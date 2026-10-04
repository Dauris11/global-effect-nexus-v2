import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Receipt,
  Scale,
  Search,
  X,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { GestionTransacciones } from "@/components/finanzas/gestion-transacciones";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { mesLargo } from "@/lib/fechas";
import {
  CATEGORIAS,
  esCategoria,
  esTipoTransaccion,
  montoUsd,
  TIPOS_MOVIMIENTO,
} from "@/lib/finanzas";
import { MOVIMIENTO } from "@/lib/paleta";
import { tienePermiso } from "@/lib/rbac";
import type { Locale } from "@/i18n/routing";
import {
  hayMasMovimientos,
  mesesConMovimiento,
  movimientos,
  recortarMovimientos,
  repartoPorCategoria,
  resumenFinanciero,
} from "@/server/finanzas/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("accounting.title") };
}

/**
 * Contabilidad: ingresos, egresos y balance.
 *
 * `finanzas.leer` para entrar y `finanzas.escribir` para tocar. Los dos los
 * tienen `contabilidad` y `super_admin`; **`admin` (coordinación) no tiene
 * ninguno**, así que esta pantalla no está en su menú y su URL le responde que
 * no. No es un olvido: quién ve el dinero de la Fundación es una decisión que
 * vive en la tabla `rol_permiso`, y esta pantalla la respeta en vez de
 * discutirla.
 *
 * Los filtros van en la URL como en el resto del sistema: el enlace se
 * comparte, la recarga no pierde lo que se miraba y la lista se recorta en SQL.
 *
 * El selector de mes sale de los meses QUE TIENEN movimientos, no de los
 * últimos doce: un desplegable con meses vacíos invita a elegir uno y
 * encontrarse la pantalla en blanco sin saber si el filtro está mal.
 *
 * Las cuatro cifras y el reparto por categoría se calculan sobre el conjunto
 * filtrado ENTERO —consultas agregadas aparte— y no sobre las 200 filas que se
 * pintan: un "total de ingresos" que solo suma las 200 más recientes no es el
 * ingreso de nadie.
 */
export default async function PaginaContabilidad({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    tipo?: string;
    categoria?: string;
    mes?: string;
  }>;
}) {
  const { locale } = await params;
  const { q, tipo, categoria, mes } = await searchParams;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirPermiso("finanzas.leer");

  const busqueda = (q ?? "").trim().slice(0, 80);
  // Los desplegables se pueden reescribir en la URL: lo que no esté en la lista
  // se ignora en vez de llegar al SQL.
  const tipoOk = tipo && esTipoTransaccion(tipo) ? tipo : null;
  const categoriaOk = categoria && esCategoria(categoria) ? categoria : null;
  const mesOk = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : null;

  const filtro = {
    busqueda,
    tipo: tipoOk,
    categoria: categoriaOk,
    mes: mesOk,
  };

  const [t, filas, resumen, reparto, meses, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "finance" }),
    movimientos(filtro),
    resumenFinanciero(filtro),
    repartoPorCategoria(filtro),
    mesesConMovimiento(),
    mensajesCliente(["finance"]),
  ]);

  const hayFiltro = Boolean(busqueda || tipoOk || categoriaOk || mesOk);

  // El mayor total manda la escala de las barras. Sin él, una categoría de $50
  // al lado de una de $5.000 se dibujaría igual de larga.
  const mayor = Math.max(...reparto.map((fila) => Math.abs(fila.total)), 1);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <DollarSign className="size-5 text-[#2096BA]" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={montoUsd(resumen.ingresos, 0)}
          etiqueta={t("stats.income")}
          icono={ArrowUpRight}
          acento
        />
        <CifraAcademica
          valor={montoUsd(resumen.egresos, 0)}
          etiqueta={t("stats.expense")}
          icono={ArrowDownRight}
        />
        <CifraAcademica
          valor={montoUsd(resumen.balance, 0)}
          etiqueta={t("stats.balance")}
          icono={Scale}
          acento
        />
        <CifraAcademica
          valor={resumen.movimientos}
          etiqueta={t("stats.entries")}
          icono={Receipt}
        />
      </div>

      {/* El balance no lleva color propio: es una resta, y pintarla de un tono
          u otro según el signo sería justo el semáforo que la marca no tiene.
          Lo que dice si sobra o falta es el signo, que ya viene en la cifra. */}
      <p className="text-muted-foreground text-xs">{t("balanceHint")}</p>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1.5">
          <label
            htmlFor="q"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("search")}
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder={t("searchPlaceholder")}
            maxLength={80}
          />
        </div>

        <div className="min-w-32 space-y-1.5">
          <label
            htmlFor="tipo"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.type")}
          </label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={tipoOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allTypes")}</option>
            {TIPOS_MOVIMIENTO.map((valor) => (
              <option key={valor} value={valor}>
                {t(`type.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-36 space-y-1.5">
          <label
            htmlFor="categoria"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.category")}
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={categoriaOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allCategories")}</option>
            {CATEGORIAS.map((valor) => (
              <option key={valor} value={valor}>
                {t(`category.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-36 space-y-1.5">
          <label
            htmlFor="mes"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.month")}
          </label>
          <select
            id="mes"
            name="mes"
            defaultValue={mesOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allMonths")}</option>
            {meses.map((valor) => (
              <option key={valor} value={valor}>
                {mesLargo(valor, idioma)}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="submit"
          className="transition-transform duration-150 active:scale-95"
        >
          <Search className="size-4" />
          {t("apply")}
        </Button>

        {hayFiltro && (
          <Button asChild variant="ghost">
            <Link href="/contabilidad">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      {/* Reparto por categoría. Barras de CSS y no una gráfica: son cinco
          valores con su número al lado, y para eso Recharts solo añadiría
          JavaScript al navegador. Las gráficas viven en `/reportes`. */}
      {reparto.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div>
              <p className="text-sm font-semibold">{t("breakdown.title")}</p>
              <p className="text-muted-foreground text-xs">
                {t("breakdown.hint")}
              </p>
            </div>

            <ul className="space-y-2.5">
              {reparto.map((fila) => {
                // Una categoría puede tener las dos cosas (una beca devuelta es
                // un egreso en la categoría `beca`). Se dibujan las dos partes
                // en la misma barra, por eso no basta con un solo ancho.
                const anchoIngreso = (fila.ingresos / mayor) * 100;
                const anchoEgreso = (fila.egresos / mayor) * 100;

                return (
                  <li key={fila.categoria} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium">
                        {t(`category.${fila.categoria}` as never)}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {fila.ingresos > 0 && (
                          <span className={MOVIMIENTO.ingreso.texto}>
                            {MOVIMIENTO.ingreso.signo}
                            {montoUsd(fila.ingresos, 0)}
                          </span>
                        )}
                        {fila.ingresos > 0 && fila.egresos > 0 && " · "}
                        {fila.egresos > 0 && (
                          <span className={MOVIMIENTO.egreso.texto}>
                            {MOVIMIENTO.egreso.signo}
                            {montoUsd(fila.egresos, 0)}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="bg-muted flex h-2 overflow-hidden rounded-full">
                      <span
                        className="bg-[#2096BA]"
                        style={{ width: `${anchoIngreso}%` }}
                      />
                      <span
                        className="bg-[#171A1D]"
                        style={{ width: `${anchoEgreso}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <NextIntlClientProvider messages={mensajes}>
        <GestionTransacciones
          movimientos={recortarMovimientos(filas)}
          puedeEscribir={tienePermiso(usuario.rol, "finanzas.escribir")}
          hayMas={hayMasMovimientos(filas)}
          hayFiltro={hayFiltro}
        />
      </NextIntlClientProvider>
    </div>
  );
}
