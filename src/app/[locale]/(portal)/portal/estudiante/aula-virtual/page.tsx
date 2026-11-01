import type { Metadata } from "next";
import {
  Award,
  Check,
  ClipboardCheck,
  Clock,
  Info,
  ListTodo,
  TriangleAlert,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  TarjetaAsignacion,
  type TextosAsignacion,
} from "@/components/estudiante/aula-tarjeta";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { StatCard } from "@/components/ui/stat-card";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import {
  asignacionesDelEstudiante,
  type AsignacionDelEstudiante,
} from "@/server/estudiantes/aula";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";

const RUTA = "/portal/estudiante/aula-virtual";

const estadoDe = (fila: AsignacionDelEstudiante) =>
  fila.estado_entrega ?? "pendiente";

/**
 * Los filtros de la lista, que son las mismas cuatro cuentas de las cifras de
 * arriba: un chip y su cifra no pueden contar cosas distintas.
 */
const FILTROS = {
  pendiente: {
    icono: Clock,
    cumple: (fila: AsignacionDelEstudiante) =>
      estadoDe(fila) === "pendiente" && !fila.vencida,
  },
  entregado: {
    icono: Check,
    cumple: (fila: AsignacionDelEstudiante) =>
      estadoDe(fila) === "entregado" || estadoDe(fila) === "tarde",
  },
  calificado: {
    icono: Award,
    cumple: (fila: AsignacionDelEstudiante) => estadoDe(fila) === "calificado",
  },
  vencida: {
    icono: TriangleAlert,
    cumple: (fila: AsignacionDelEstudiante) => fila.vencida,
  },
} as const;

type Filtro = keyof typeof FILTROS;

const esFiltro = (valor: string | undefined): valor is Filtro =>
  valor !== undefined && valor in FILTROS;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentPortal" });

  return { title: t("classroom.title") };
}

/**
 * Aula virtual del estudiante.
 *
 * Dos secciones y no una: lo evaluable (tareas y exámenes, con vencimiento y
 * estado de entrega) va separado del material de apoyo y los anuncios, porque
 * mezclarlos esconde lo que hay que entregar entre lo que solo hay que leer.
 *
 * El filtro vive en la URL (`?estado=`) y no en un componente cliente: la
 * página sigue siendo de servidor, el filtro se puede compartir y el botón de
 * atrás lo deshace. Con un filtro puesto, el material se esconde: quien busca
 * "lo vencido" no viene a leer anuncios.
 */
export default async function PaginaAulaVirtual({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const [{ locale }, { estado }] = await Promise.all([params, searchParams]);
  const idioma: Locale = locale === "en" ? "en" : "es";
  const filtro = esFiltro(estado) ? estado : null;

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const [t, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "studentPortal" }),
    // El botón de entregar es cliente y usa este espacio; el proveedor del
    // layout solo manda los cuatro del armazón.
    mensajesCliente(["studentPortal"]),
  ]);

  const asignaciones = await asignacionesDelEstudiante(estudiante.id);

  const evaluables = asignaciones.filter(
    (fila) => fila.tipo === "tarea" || fila.tipo === "examen",
  );
  const recursos = asignaciones.filter(
    (fila) => fila.tipo === "material" || fila.tipo === "anuncio",
  );

  const cuenta = (clave: Filtro) => evaluables.filter(FILTROS[clave].cumple).length;
  const visibles = filtro ? evaluables.filter(FILTROS[filtro].cumple) : evaluables;

  const textos = (fila: AsignacionDelEstudiante): TextosAsignacion => ({
    due: t("classroom.dueOn"),
    delivered: t("classroom.deliveredOn"),
    overdue: t("classroom.overdue"),
    noDue: t("classroom.noDue"),
    openFile: t("classroom.openFile"),
    estado: t(`classroom.state.${estadoDe(fila)}`),
    tipo: t(`classroom.type.${fila.tipo}`),
  });

  const etiquetas: Record<Filtro, string> = {
    pendiente: t("classroom.stats.pending"),
    entregado: t("classroom.stats.delivered"),
    calificado: t("classroom.stats.graded"),
    vencida: t("classroom.stats.overdue"),
  };

  return (
    <NextIntlClientProvider messages={mensajes}>
      <div className="space-y-8">
        <EncabezadoPagina
          antetitulo={t("classroom.eyebrow")}
          titulo={t("classroom.title")}
          subtitulo={t("classroom.description")}
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(Object.keys(FILTROS) as Filtro[]).map((clave) => (
            <StatCard
              key={clave}
              icono={FILTROS[clave].icono}
              valor={cuenta(clave)}
              etiqueta={etiquetas[clave]}
              // El acento va donde hay que actuar: lo pendiente, y lo vencido
              // solo si existe.
              acento={clave === "pendiente" || (clave === "vencida" && cuenta(clave) > 0)}
            />
          ))}
        </div>

        <p className="flex items-start gap-3 rounded-control bg-marca-50 p-4 text-sm text-marca-700">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("classroom.uploadHint")}
        </p>

        <section className="space-y-6">
          <h2 className="texto-titulo-seccion">{t("classroom.assignmentsTitle")}</h2>

          {evaluables.length > 0 && (
            <FilaChips etiqueta={t("classroom.filterLabel")}>
              <ChipFiltro
                icono={ListTodo}
                etiqueta={t("classroom.filterAll")}
                activo={filtro === null}
                href={RUTA}
              />
              {(Object.keys(FILTROS) as Filtro[]).map((clave) => (
                <ChipFiltro
                  key={clave}
                  icono={FILTROS[clave].icono}
                  etiqueta={etiquetas[clave]}
                  activo={filtro === clave}
                  href={`${RUTA}?estado=${clave}`}
                />
              ))}
            </FilaChips>
          )}

          {evaluables.length === 0 ? (
            <EstadoVacio
              icono={ClipboardCheck}
              titulo={t("classroom.assignmentsEmpty")}
              texto={t("classroom.assignmentsEmptyHint")}
            />
          ) : visibles.length === 0 ? (
            <EstadoVacio
              icono={ListTodo}
              titulo={t("classroom.filterEmpty")}
              texto={t("classroom.filterEmptyHint")}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visibles.map((fila) => (
                <li key={fila.id}>
                  <TarjetaAsignacion fila={fila} idioma={idioma} textos={textos(fila)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {recursos.length > 0 && filtro === null && (
          <section className="space-y-6 border-t border-linea pt-8">
            <h2 className="texto-titulo-seccion">{t("classroom.resourcesTitle")}</h2>

            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {recursos.map((fila) => (
                <li key={fila.id}>
                  <TarjetaAsignacion fila={fila} idioma={idioma} textos={textos(fila)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </NextIntlClientProvider>
  );
}
