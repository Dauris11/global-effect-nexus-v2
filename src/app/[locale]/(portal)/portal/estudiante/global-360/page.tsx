import type { Metadata } from "next";
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  GraduationCap,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { AvisoSinFicha } from "@/components/estudiante/aviso-sin-ficha";
import { MatriculaCuatrimestral360 } from "@/components/estudiante/matricula-cuatrimestral-360";
import {
  TarjetaMateriaG360,
  type MateriaG360,
} from "@/components/estudiante/g360-tarjeta-materia";
import { TandasPeriodo360 } from "@/components/global360/tandas-periodo";
import { Badge } from "@/components/ui/badge";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { StatCard } from "@/components/ui/stat-card";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { fechaConHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import {
  avanceEn360,
  catalogoConSituacion,
  tandasDelEstudiante,
  ventanaVigente,
} from "@/server/global360/consultas";
import { catalogoMatricula360 } from "@/server/moodle/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "global360" });

  return { title: t("title") };
}

/** La rejilla de tarjetas de materia: dos por fila ya en el teléfono. */
const REJILLA = "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4";

/**
 * Global Effect 360 en el portal del estudiante: el programa obligatorio de la
 * Fundación, para todos.
 *
 * Arriba lo que pide actuar: la ventana, las dos tandas del período (con el
 * aviso si a la tanda abierta le falta materia) y el catálogo para elegir.
 * Debajo, consulta: lo que le falta y lo que ya dio. Elegir se hace en UN solo
 * sitio, el catálogo, para que no haya dos botones que digan cosas distintas.
 *
 * "Dada" es `estado = 'aprobada'`, no "inscrita": una materia reprobada le sigue
 * faltando, y por eso aparece en la lista de pendientes con su propia etiqueta.
 */
export default async function PaginaGlobal360({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const [t, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "global360" }),
    mensajesCliente(["global360"]),
  ]);

  if (!estudiante) return <AvisoSinFicha />;

  const [materias, avance, ventana, catalogoMatricula] = await Promise.all([
    catalogoConSituacion(estudiante.id),
    avanceEn360(estudiante.id),
    ventanaVigente(),
    catalogoMatricula360(estudiante.id),
  ]);

  // Las tandas son del período de la ventana: sin ventana no hay período del
  // que hablar.
  const tandas = ventana
    ? await tandasDelEstudiante(estudiante.id, ventana.periodo_id)
    : [];

  const dadas = materias.filter((m) => m.situacion === "aprobada");
  const porDar = materias.filter((m) => m.situacion !== "aprobada");

  const abierta = ventana?.abierta ?? false;

  const detalle = (materia: MateriaG360) =>
    [
      materia.creditos > 0 ? t("credits", { n: materia.creditos }) : null,
      materia.periodo,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo={t("eyebrow")}
        titulo={t("title")}
        subtitulo={t("description")}
      />

      {/* El anuncio de la ventana, con fecha Y hora. Es lo que el estudiante
          viene a ver cuando le llega el aviso de la cabecera. Abierta es un
          aviso estándar de la marca; anunciada, gris. */}
      {ventana && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-control p-4",
            abierta ? "bg-marca-50 text-marca-700" : "bg-muted text-tinta",
          )}
        >
          <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {abierta ? t("windowOpen") : t("windowSoon")} · {ventana.periodo} ·{" "}
              {t(ventana.ronda === 1 ? "tanda1" : "tanda2")}
            </p>
            <p className="text-sm">
              {t("windowFrom", {
                abre: fechaConHora(ventana.abre.slice(0, 10), ventana.abre.slice(11, 16), idioma),
                cierra: fechaConHora(ventana.cierra.slice(0, 10), ventana.cierra.slice(11, 16), idioma),
              })}
            </p>
            {ventana.mensaje && (
              <p className="mt-1 text-sm italic opacity-90">{ventana.mensaje}</p>
            )}
          </div>
        </div>
      )}

      {/* Avance contra el catálogo entero: todo es obligatorio. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          icono={GraduationCap}
          valor={`${avance.dadas} / ${avance.total}`}
          etiqueta={t("progress")}
          acento
        />
        <StatCard icono={CircleDashed} valor={porDar.length} etiqueta={t("pending")} />
        <StatCard icono={CircleCheck} valor={dadas.length} etiqueta={t("taken")} />
      </div>

      {ventana && <TandasPeriodo360 ventana={ventana} tandas={tandas} />}

      {/* El proveedor solo envuelve lo que lleva botones (cliente). */}
      <NextIntlClientProvider messages={mensajes}>
        <MatriculaCuatrimestral360
          materias={catalogoMatricula}
          ventana={ventana}
          tandas={tandas}
        />
      </NextIntlClientProvider>

      <section className="space-y-6 border-t border-linea pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="texto-titulo-seccion">{t("pending")}</h2>
          <Badge variant="neutra">{porDar.length}</Badge>
        </div>

        {porDar.length === 0 ? (
          <EstadoVacio icono={CircleCheck} titulo={t("pendingEmpty")} />
        ) : (
          <ul className={REJILLA}>
            {porDar.map((materia) => (
              <li key={materia.id}>
                <TarjetaMateriaG360
                  materia={materia}
                  situacion={t(`situation.${materia.situacion}`)}
                  detalle={detalle(materia)}
                />
              </li>
            ))}
          </ul>
        )}

        {!abierta && <p className="texto-meta">{t("windowClosed")}</p>}
      </section>

      <section className="space-y-6 border-t border-linea pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="texto-titulo-seccion">{t("taken")}</h2>
          <Badge variant="marca">{dadas.length}</Badge>
        </div>

        {dadas.length === 0 ? (
          <EstadoVacio icono={GraduationCap} titulo={t("takenEmpty")} className="py-8" />
        ) : (
          <ul className={REJILLA}>
            {dadas.map((materia) => (
              <li key={materia.id}>
                <TarjetaMateriaG360
                  materia={materia}
                  situacion={t(`situation.${materia.situacion}`)}
                  detalle={detalle(materia)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
