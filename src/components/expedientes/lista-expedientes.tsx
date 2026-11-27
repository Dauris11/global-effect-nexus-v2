import { LogoUniversidad } from "@/components/universidades/logo-universidad";
import { Eye, PencilLine, TriangleAlert, UserCheck, UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { PrevisualizarExpediente } from "@/components/expedientes/previsualizar-expediente";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { llevaCuenta } from "@/lib/expedientes";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { cn } from "@/lib/utils";
import type { FilaExpediente } from "@/server/expedientes/consultas";

import { textosVistaRapida } from "./textos-vista-rapida";

/**
 * Vista de lista: tabla en pantalla ancha y filas compactas en el móvil, con
 * la foto en las dos. En una lista se compara —índice, universidad, cuenta—
 * y por eso aquí la foto es más pequeña que en las tarjetas, pero nunca falta:
 * es lo que dice de quién es cada fila sin leer el nombre.
 */
export async function ListaExpedientes({
  filas,
  idioma,
  puedeEscribir,
  umbral,
  minimoSecundaria,
  resaltarId,
}: {
  filas: FilaExpediente[];
  idioma: Locale;
  puedeEscribir: boolean;
  /** Índice por debajo del cual se marca en riesgo (parámetro becas.indice_minimo). */
  umbral: number;
  /** Promedio de secundaria mínimo para aceptar a un candidato (parámetro becas.promedio_liceo_minimo). */
  minimoSecundaria: number;
  /** Fila recién creada: entra resaltada unos segundos. */
  resaltarId?: string;
}) {
  const t = await getTranslations("records");

  return (
    <div className="overflow-hidden rounded-card border border-linea bg-card shadow-card">
      {/* ≥ md: tabla */}
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b border-linea text-left texto-meta">
          <tr>
            <th className="px-4 py-3 font-medium">{t("column.student")}</th>
            <th className="px-4 py-3 font-medium">{t("column.status")}</th>
            <th className="px-4 py-3 font-medium">{t("field.university")}</th>
            <th className="px-4 py-3 text-right font-medium">{t("column.gpa")}</th>
            <th className="px-4 py-3 font-medium">{t("lista.cuenta")}</th>
            <th className="px-4 py-3">
              <span className="sr-only">{t("lista.acciones")}</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-linea">
          {filas.map((fila) => (
            <tr key={fila.id} className={cn("group relative h-[52px] transition-colors hover:bg-muted/50", fila.id === resaltarId && "animate-resaltar")}>
              <td className="px-4 py-1.5">
                <PrevisualizarExpediente
                  fila={fila}
                  idioma={idioma}
                  puedeEscribir={puedeEscribir}
                  fotoUrl={urlDeAvatar(fila.foto_url)}
                  variante="celda"
                  textos={textosVistaRapida(fila, t)}
                />
              </td>
              <td className="px-4 py-1.5">
                <StatusBadge status={fila.estado} />
              </td>
              <td className="max-w-56 px-4 py-1.5">
                <span className="flex items-center gap-2 truncate">
                  {fila.universidad_logo && <LogoUniversidad siglas={fila.universidad ?? ""} url={fila.universidad_logo} className="size-6" />}
                  <span className="truncate">{fila.universidad ?? "—"}</span>
                </span>
              </td>
              <td className="px-4 py-1.5 text-right">
                <Indice indice={fila.indice} umbral={umbral} />
                <Secundaria valor={fila.promedio_secundaria} minimo={minimoSecundaria} etiqueta={t("lista.highSchool")} />
              </td>
              <td className="px-4 py-1.5">
                <Cuenta fila={fila} textos={{ con: t("lista.conCuenta"), sin: t("lista.sinCuenta") }} />
              </td>
              {/* Acciones al pasar el ratón (o con el foco): por encima del botón que cubre la fila. */}
              <td className="relative z-10 w-24 px-2 py-1.5 text-right">
                <span className="inline-flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button asChild variant="ghost" size="icon" aria-label={t("lista.verFicha")}>
                    <Link href={`/expedientes/${fila.id}`}><Eye /></Link>
                  </Button>
                  {puedeEscribir && (
                    <Button asChild variant="ghost" size="icon" aria-label={t("lista.editar")}>
                      <Link href={`/expedientes/${fila.id}?editar=1`}><PencilLine /></Link>
                    </Button>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* < md: filas */}
      <ul className="divide-y divide-linea md:hidden">
        {filas.map((fila) => (
          <li key={fila.id}>
            <Link
              href={`/expedientes/${fila.id}`}
              className="flex items-center gap-3 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FotoEstudiante
                nombre={fila.nombre}
                url={urlDeAvatar(fila.foto_url)}
                className="size-14 rounded-full"
                aviso="punto"
                textoSinFoto={t("sinFoto")}
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block truncate font-semibold">{fila.nombre}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={fila.estado} />
                  <Indice indice={fila.indice} umbral={umbral} />
                  <Secundaria valor={fila.promedio_secundaria} minimo={minimoSecundaria} etiqueta={t("lista.highSchool")} />
                </span>
                {fila.universidad && (
                  <span className="texto-meta flex items-center gap-1.5 truncate">
                    {fila.universidad_logo && <LogoUniversidad siglas={fila.universidad} url={fila.universidad_logo} className="size-4" />}
                    {fila.universidad}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El índice, con la señal SEMAFORO y su icono cuando cae bajo la prueba académica. */
function Indice({ indice, umbral }: { indice: number | null; umbral: number }) {
  if (indice === null) return <span className="texto-meta">—</span>;

  const enRiesgo = indice < umbral;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tabular-nums",
        enRiesgo && "text-status-danger-fg",
      )}
    >
      {enRiesgo && <TriangleAlert aria-hidden className="size-3.5" />}
      {indice.toFixed(2)}
    </span>
  );
}

/** Solo un activo lleva cuenta: en los demás estados la celda queda en blanco. */
function Cuenta({
  fila,
  textos,
}: {
  fila: FilaExpediente;
  textos: { con: string; sin: string };
}) {
  if (!llevaCuenta(fila.estado)) return <span className="texto-meta">—</span>;

  const Icono = fila.con_cuenta ? UserCheck : UserX;

  return (
    <span className={cn("inline-flex items-center gap-1.5", !fila.con_cuenta && "text-tinta-2")}>
      <Icono aria-hidden className="size-4 text-tinta-3" />
      {fila.con_cuenta ? textos.con : textos.sin}
    </span>
  );
}

/**
 * Promedio del récord de secundaria (0–100), aparte del índice universitario y con
 * su propio mínimo. Bajo el mínimo lleva el mismo triángulo que el índice en riesgo,
 * para que se lea también en grises.
 */
function Secundaria({ valor, minimo, etiqueta }: { valor: number | null; minimo: number; etiqueta: string }) {
  if (valor === null) return null;

  const bajo = valor < minimo;

  return (
    <span className={cn("texto-meta flex items-center justify-end gap-1 tabular-nums", bajo && "font-semibold text-status-danger-fg")}>
      {bajo && <TriangleAlert aria-hidden className="size-3" />}
      {etiqueta} {valor.toFixed(2)}
    </span>
  );
}
