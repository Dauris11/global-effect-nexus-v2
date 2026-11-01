import type { Metadata } from "next";
import { CalendarDays, CalendarX2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { DiaAgenda } from "@/components/estudiante/dia-agenda";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { claveDia, claveMes, mesLargo } from "@/lib/fechas";
import {
  agendaDelEstudiante,
  mesesConAgenda,
  type EntradaAgenda,
} from "@/server/estudiantes/agenda";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentPortal" });

  return { title: t("agenda.title") };
}

/**
 * Calendario del estudiante: eventos, vencimientos y sus trámites con fecha,
 * por día.
 *
 * Es una agenda en lista y no una rejilla de mes. En una rejilla, cada celda
 * cabe dos líneas y el resto se esconde detrás de un "+3 más"; aquí lo que hay
 * se lee entero, que es lo que importa cuando lo que se busca es cuándo vence
 * una tarea. La rejilla completa vive en `/calendario`, el módulo del equipo.
 *
 * El mes viaja en la URL (`?mes=YYYY-MM`) y el selector solo ofrece meses que
 * tienen algo, para no dejar al estudiante paseando por meses vacíos.
 */
export default async function PaginaCalendario({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { locale } = await params;
  const { mes: mesPedido } = await searchParams;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const t = await getTranslations({ locale, namespace: "studentPortal" });

  const meses = await mesesConAgenda(estudiante.id, usuario.id);
  const hoy = claveDia();
  const mesActual = claveMes();

  /*
   * Se elige el mes en tres pasos: el que pide la URL si tiene contenido, el
   * actual si aparece en la lista, y si no el más reciente con algo. Así la
   * pantalla nunca abre en un mes vacío teniendo entradas en otro.
   */
  const mes =
    (mesPedido && meses.includes(mesPedido) ? mesPedido : null) ??
    (meses.includes(mesActual) ? mesActual : null) ??
    meses[0] ??
    mesActual;

  const entradas = await agendaDelEstudiante(estudiante.id, mes, usuario.id);
  const dias = agruparPorDia(entradas);

  return (
    <div className="animate-entrada mx-auto max-w-4xl space-y-8">
      <Cabecera
        titulo={t("agenda.title")}
      />

      {/* Los meses son enlaces: el mes vive en la URL y la página es de
          servidor. Solo salen los que tienen algo. */}
      {meses.length > 0 && (
        <FilaChips etiqueta={t("agenda.title")}>
          {meses.map((clave) => (
            <ChipFiltro
              key={clave}
              icono={CalendarDays}
              etiqueta={mesLargo(clave, idioma)}
              activo={clave === mes}
              href={`/portal/estudiante/calendario?mes=${clave}`}
              className="capitalize"
            />
          ))}
        </FilaChips>
      )}

      <section className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="texto-titulo-seccion capitalize">
            {mesLargo(mes, idioma)}
          </h2>
          <span className="texto-meta">
            {t("agenda.count", { count: entradas.length })}
          </span>
        </div>

        {dias.length === 0 ? (
          <EstadoVacio
            icono={CalendarX2}
            titulo={t("agenda.empty")}
            texto={t("agenda.emptyHint")}
          />
        ) : (
          dias.map((dia) => (
            <DiaAgenda
              key={dia.clave}
              clave={dia.clave}
              entradas={dia.entradas}
              esHoy={dia.clave === hoy}
              locale={idioma}
            />
          ))
        )}
      </section>
    </div>
  );
}

/** Agrupa por día conservando el orden ascendente que ya trae la consulta. */
function agruparPorDia(entradas: readonly EntradaAgenda[]) {
  const grupos = new Map<
    string,
    { clave: string; entradas: EntradaAgenda[] }
  >();

  for (const entrada of entradas) {
    const grupo = grupos.get(entrada.dia);

    if (grupo) grupo.entradas.push(entrada);
    else grupos.set(entrada.dia, { clave: entrada.dia, entradas: [entrada] });
  }

  return [...grupos.values()];
}
