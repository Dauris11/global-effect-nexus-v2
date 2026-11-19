import type { Metadata } from "next";
import {
  Award,
  BookOpen,
  Check,
  ClipboardCheck,
  Clock,
  Layers,
  ListTodo,
  TriangleAlert,
} from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  TarjetaAsignacion,
  type TextosAsignacion,
} from "@/components/estudiante/aula-tarjeta";
import { GraficoEstadoAulaVirtual } from "@/components/estudiante/graficos-modulos-estudiante";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { StatCard } from "@/components/ui/stat-card";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
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
  searchParams: Promise<{ estado?: string; materia?: string }>;
}) {
  const [{ locale }, { estado, materia }] = await Promise.all([params, searchParams]);
  const idioma: Locale = locale === "en" ? "en" : "es";
  const filtro = esFiltro(estado) ? estado : null;

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const [t, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "studentPortal" }),
    // El botón y el buzón de entregas son componentes cliente que leen `studentPortal` y `moodle`.
    mensajesCliente(["studentPortal", "moodle"]),
  ]);

  const asignacionesBrutas = await asignacionesDelEstudiante(estudiante.id);

  // Firma en el servidor los enlaces del bucket privado (tanto el material del
  // docente cuando no es URL externa como la entrega subida por el propio estudiante).
  const asignaciones = await Promise.all(
    asignacionesBrutas.map(async (fila) => {
      const [archivoFirmado, entregaFirmada] = await Promise.all([
        fila.archivo_url && !fila.archivo_url.startsWith("http")
          ? enlaceDeDocumento(fila.archivo_url)
          : Promise.resolve(fila.archivo_url),
        fila.entrega_archivo_url && !fila.entrega_archivo_url.startsWith("http")
          ? enlaceDeDocumento(fila.entrega_archivo_url)
          : Promise.resolve(fila.entrega_archivo_url ?? null),
      ]);

      return {
        ...fila,
        archivo_url: archivoFirmado,
        entrega_archivo_url: entregaFirmada,
      };
    }),
  );

  const materiasDisponibles = Array.from(
    new Set(asignaciones.map((fila) => fila.materia)),
  ).sort((a, b) => a.localeCompare(b));
  const materiaActiva =
    materia && materiasDisponibles.includes(materia) ? materia : null;

  const asignacionesPorMateria = materiaActiva
    ? asignaciones.filter((fila) => fila.materia === materiaActiva)
    : asignaciones;

  const evaluables = asignacionesPorMateria.filter(
    (fila) => fila.tipo === "tarea" || fila.tipo === "examen",
  );
  const recursos = asignacionesPorMateria.filter(
    (fila) => fila.tipo === "material" || fila.tipo === "anuncio",
  );

  const enlaceFiltro = (siguiente: {
    estado: Filtro | null;
    materia: string | null;
  }) => {
    const qs = new URLSearchParams();
    if (siguiente.materia) qs.set("materia", siguiente.materia);
    if (siguiente.estado) qs.set("estado", siguiente.estado);
    const query = qs.toString();
    return query ? `${RUTA}?${query}` : RUTA;
  };

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
      <div className="animate-entrada space-y-8">
        <EncabezadoPagina titulo={t("classroom.title")} />

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

        <GraficoEstadoAulaVirtual
          pendientes={cuenta("pendiente")}
          entregadas={cuenta("entregado")}
          calificadas={cuenta("calificado")}
          vencidas={cuenta("vencida")}
        />

        <section className="space-y-6">
          <h2 className="texto-titulo-seccion">{t("classroom.assignmentsTitle")}</h2>

          {materiasDisponibles.length > 0 && (
            <div className="space-y-3">
              <FilaChips etiqueta={t("classroom.filterSubjectLabel")}>
                <ChipFiltro
                  icono={Layers}
                  etiqueta={t("classroom.filterAllSubjects")}
                  activo={materiaActiva === null}
                  href={enlaceFiltro({ estado: filtro, materia: null })}
                />
                {materiasDisponibles.map((nombreMateria) => (
                  <ChipFiltro
                    key={nombreMateria}
                    icono={BookOpen}
                    etiqueta={nombreMateria}
                    activo={materiaActiva === nombreMateria}
                    href={enlaceFiltro({ estado: filtro, materia: nombreMateria })}
                  />
                ))}
              </FilaChips>

              <FilaChips etiqueta={t("classroom.filterLabel")}>
                <ChipFiltro
                  icono={ListTodo}
                  etiqueta={t("classroom.filterAll")}
                  activo={filtro === null}
                  href={enlaceFiltro({ estado: null, materia: materiaActiva })}
                />
                {(Object.keys(FILTROS) as Filtro[]).map((clave) => (
                  <ChipFiltro
                    key={clave}
                    icono={FILTROS[clave].icono}
                    etiqueta={etiquetas[clave]}
                    activo={filtro === clave}
                    href={enlaceFiltro({ estado: clave, materia: materiaActiva })}
                  />
                ))}
              </FilaChips>
            </div>
          )}

          {evaluables.length === 0 ? (
            <EstadoVacio
              icono={ClipboardCheck}
              titulo={t("classroom.assignmentsEmpty")}
            />
          ) : visibles.length === 0 ? (
            <EstadoVacio
              icono={ListTodo}
              titulo={t("classroom.filterEmpty")}
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
