import { TriangleAlert, UserCheck, UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { PrevisualizarExpediente } from "@/components/expedientes/previsualizar-expediente";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { llevaCuenta, visualDeEstado } from "@/lib/expedientes";
import { GPA_PRUEBA_ACADEMICA } from "@/lib/notas";
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
}: {
  filas: FilaExpediente[];
  idioma: Locale;
  puedeEscribir: boolean;
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
            <tr key={fila.id} className="transition-colors hover:bg-muted/50">
              <td className="px-4 py-2.5">
                <Link
                  href={`/expedientes/${fila.id}`}
                  className="group flex items-center gap-3 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FotoEstudiante
                    nombre={fila.nombre}
                    url={urlDeAvatar(fila.foto_url)}
                    className="size-11 rounded-full"
                    aviso="punto"
                    textoSinFoto={t("sinFoto")}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold group-hover:underline">
                      {fila.nombre}
                    </span>
                    {fila.cedula && <span className="texto-meta block">{fila.cedula}</span>}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-2.5">
                <Estado estado={fila.estado} texto={t(`status.${fila.estado}`)} />
              </td>
              <td className="max-w-56 px-4 py-2.5">
                <span className="block truncate">{fila.universidad ?? "—"}</span>
                {fila.programa && (
                  <span className="texto-meta block truncate">{fila.programa}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Indice indice={fila.indice} />
              </td>
              <td className="px-4 py-2.5">
                <Cuenta fila={fila} textos={{ con: t("lista.conCuenta"), sin: t("lista.sinCuenta") }} />
              </td>
              <td className="px-2 py-2.5 text-right">
                <PrevisualizarExpediente
                  fila={fila}
                  idioma={idioma}
                  puedeEscribir={puedeEscribir}
                  fotoUrl={urlDeAvatar(fila.foto_url)}
                  variante="boton"
                  textos={textosVistaRapida(fila, t)}
                />
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
                  <Estado estado={fila.estado} texto={t(`status.${fila.estado}`)} />
                  <Indice indice={fila.indice} />
                </span>
                {fila.universidad && (
                  <span className="texto-meta block truncate">{fila.universidad}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Estado({ estado, texto }: { estado: string; texto: string }) {
  const visual = visualDeEstado(estado);

  return (
    <Badge className={cn("gap-1", visual.insignia)}>
      <visual.icono className="size-3.5 shrink-0" />
      {texto}
    </Badge>
  );
}

/** El índice, con la señal SEMAFORO y su icono cuando cae bajo la prueba académica. */
function Indice({ indice }: { indice: number | null }) {
  if (indice === null) return <span className="texto-meta">—</span>;

  const enRiesgo = indice < GPA_PRUEBA_ACADEMICA;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tabular-nums",
        enRiesgo && "text-[#B4342B]",
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
