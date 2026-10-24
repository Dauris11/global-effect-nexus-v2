import type { Metadata } from "next";
import { BookOpen, Download, Layers, NotebookPen, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Balanza } from "@/components/contabilidad/libros/balanza";
import { AvisoDescuadre, ResumenTotales } from "@/components/contabilidad/libros/comun-libros";
import { consultaLibros } from "@/components/contabilidad/libros/enlaces";
import { FiltrosLibros } from "@/components/contabilidad/libros/filtros-libros";
import { LibroDiario } from "@/components/contabilidad/libros/libro-diario";
import { LibroMayor } from "@/components/contabilidad/libros/libro-mayor";
import { Button } from "@/components/ui/button";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { fechaCorta } from "@/lib/fechas";
import {
  balanza,
  cuentaMayor,
  cuentasDelArbol,
  leerFiltroLibros,
  libroDiario,
  movimientosMayor,
  resumenMayor,
  TOPE_DIARIO,
  TOPE_MAYOR,
  totalesDiario,
  VISTAS_LIBRO,
  type FiltroLibros,
} from "@/server/contabilidad/libros/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.libros" });
  return { title: t("titulo") };
}

const ICONO = { diario: BookOpen, mayor: Layers, balanza: Scale } as const;

/**
 * Libros contables (§5.2): diario, mayor y balanza en una sola ruta, con
 * la vista y todos los filtros en la URL. Solo leen; los asientos se
 * registran en /contabilidad/asientos. La descarga a Excel lleva la misma
 * consulta y queda en la bitácora (route de exportar).
 */
export default async function PaginaLibros({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";
  await requerirPermiso("contabilidad.leer");
  const filtro = await leerFiltroLibros(await searchParams);

  const [t, tc, cuentas] = await Promise.all([
    getTranslations({ locale, namespace: "contab.libros" }),
    getTranslations({ locale, namespace: "contab" }),
    filtro.vista === "mayor" ? cuentasDelArbol() : Promise.resolve([]),
  ]);

  const rango = t("rango", { desde: fechaCorta(filtro.desde, idioma), hasta: fechaCorta(filtro.hasta, idioma) });
  const puedeExportar = filtro.vista !== "mayor" || filtro.cuenta !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EncabezadoPagina
        antetitulo={tc("area")}
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
        acciones={
          puedeExportar && (
            <Button asChild variant="secondary">
              {/* <a> y no <Link>: es una descarga, no una navegación. */}
              <a href={`/api/contabilidad/exportar/${filtro.vista}?${consultaLibros(filtro)}`} download>
                <Download className="size-4" />
                {t("exportar")}
              </a>
            </Button>
          )
        }
      />

      <FilaChips etiqueta={t("vistas")}>
        {VISTAS_LIBRO.map((vista) => (
          <ChipFiltro
            key={vista}
            icono={ICONO[vista]}
            etiqueta={t(`vista.${vista}`)}
            activo={filtro.vista === vista}
            href={`/contabilidad/libros?${consultaLibros(filtro, { vista })}`}
          />
        ))}
      </FilaChips>

      <FiltrosLibros filtro={filtro} cuentas={cuentas} />

      <p className="texto-meta">{rango}</p>

      {filtro.vista === "diario" && <VistaDiario filtro={filtro} idioma={idioma} />}
      {filtro.vista === "mayor" && <VistaMayor filtro={filtro} idioma={idioma} />}
      {filtro.vista === "balanza" && <VistaBalanza filtro={filtro} />}
    </div>
  );
}

async function VistaDiario({ filtro, idioma }: { filtro: FiltroLibros; idioma: "es" | "en" }) {
  const [t, asientos, totales] = await Promise.all([
    getTranslations("contab.libros"),
    libroDiario(filtro),
    totalesDiario(filtro),
  ]);

  if (asientos.length === 0) return <SinAsientos />;

  return (
    <>
      <AvisoDescuadre totales={totales} />
      <ResumenTotales
        celdas={[
          { clave: "debe", etiqueta: t("totalDebe"), valor: totales.debe, nota: t("asientos", { n: totales.asientos }) },
          { clave: "haber", etiqueta: t("totalHaber"), valor: totales.haber },
        ]}
      />
      <LibroDiario asientos={asientos} totales={totales} idioma={idioma} />
      {totales.asientos > TOPE_DIARIO && <p className="texto-meta">{t("topeDiario", { n: TOPE_DIARIO })}</p>}
    </>
  );
}

async function VistaMayor({ filtro, idioma }: { filtro: FiltroLibros; idioma: "es" | "en" }) {
  const t = await getTranslations("contab.libros");
  const cuenta = filtro.cuenta ? await cuentaMayor(filtro.cuenta) : null;

  if (!cuenta) {
    return <EstadoVacio icono={Layers} titulo={t("vacio.mayorTitulo")} texto={t("vacio.mayorTexto")} />;
  }

  const [resumen, movimientos] = await Promise.all([
    resumenMayor(cuenta.id, filtro),
    movimientosMayor(cuenta.id, filtro),
  ]);

  return (
    <>
      <div>
        <h2 className="texto-titulo-seccion">
          <span className="tabular-nums text-tinta-3">{cuenta.codigo}</span> {cuenta.nombre}
        </h2>
        <p className="texto-meta">
          {t(`naturaleza.${cuenta.deudora ? "deudora" : "acreedora"}`)}
          {!cuenta.admiteMovimiento && ` · ${t("incluyeHijas")}`}
        </p>
      </div>
      <ResumenTotales
        celdas={[
          { clave: "inicial", etiqueta: t("saldoInicial"), valor: resumen.saldoInicial },
          { clave: "debe", etiqueta: t("totalDebe"), valor: resumen.debe },
          { clave: "haber", etiqueta: t("totalHaber"), valor: resumen.haber },
          { clave: "final", etiqueta: t("saldoFinal"), valor: resumen.saldoFinal, nota: t("movimientos", { n: resumen.movimientos }) },
        ]}
      />
      {movimientos.length === 0 ? (
        <EstadoVacio icono={Layers} titulo={t("vacio.sinMovimientos")} texto={t("vacio.sinMovimientosTexto")} />
      ) : (
        <>
          <LibroMayor cuenta={cuenta} resumen={resumen} movimientos={movimientos} desde={filtro.desde} idioma={idioma} />
          {resumen.movimientos > TOPE_MAYOR && <p className="texto-meta">{t("topeMayor", { n: TOPE_MAYOR })}</p>}
        </>
      )}
    </>
  );
}

async function VistaBalanza({ filtro }: { filtro: FiltroLibros }) {
  const [t, filas, totales] = await Promise.all([
    getTranslations("contab.libros"),
    balanza(filtro),
    totalesDiario(filtro),
  ]);

  if (filas.length === 0) return <SinAsientos />;

  return (
    <>
      <AvisoDescuadre totales={totales} />
      <ResumenTotales
        celdas={[
          { clave: "debe", etiqueta: t("totalDebe"), valor: totales.debe },
          { clave: "haber", etiqueta: t("totalHaber"), valor: totales.haber },
        ]}
      />
      <Balanza filas={filas} totales={totales} filtro={filtro} />
    </>
  );
}

/** Vacío con causa y salida: o el rango no tiene asientos, o todavía no hay ninguno. */
async function SinAsientos() {
  const t = await getTranslations("contab.libros");
  return (
    <EstadoVacio
      icono={BookOpen}
      titulo={t("vacio.titulo")}
      texto={t("vacio.texto")}
      accion={
        <Button asChild variant="secondary">
          <Link href="/contabilidad/asientos">
            <NotebookPen className="size-4" />
            {t("vacio.irAsientos")}
          </Link>
        </Button>
      }
    />
  );
}
