import { LogoUniversidad } from "@/components/universidades/logo-universidad";
import { GraduationCap, TrendingUp, TriangleAlert, UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { PrevisualizarExpediente } from "@/components/expedientes/previsualizar-expediente";
import { StatusBadge } from "@/components/app/status-badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { llevaCuenta } from "@/lib/expedientes";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { cn } from "@/lib/utils";
import type { FilaExpediente } from "@/server/expedientes/consultas";

import { textosVistaRapida } from "./textos-vista-rapida";

/**
 * Vista de tarjetas: la foto manda, como una ficha con retrato.
 *
 * Antes la foto era un avatar de 56 px dentro de un cuadrado; un expediente es
 * de una persona y a una persona se la reconoce por la cara antes que por el
 * nombre, así que aquí ocupa toda la parte de arriba. Tocar la foto o el
 * nombre abre la ficha; la vista rápida queda como botón aparte.
 */
export async function TarjetasExpedientes({
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
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {filas.map((fila) => {
        const enRiesgo = fila.indice !== null && fila.indice < umbral;

        return (
          <li
            key={fila.id}
            className={cn("flex flex-col overflow-hidden rounded-card border border-linea bg-card shadow-card transition-shadow duration-200 hover:shadow-elevada", fila.id === resaltarId && "animate-resaltar")}
          >
            <Link
              href={`/expedientes/${fila.id}`}
              className="group block flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative">
                <FotoEstudiante
                  nombre={fila.nombre}
                  url={urlDeAvatar(fila.foto_url)}
                  className="flex aspect-square w-full"
                  claseIcono="text-6xl"
                  aviso="pildora"
                  textoSinFoto={t("sinFoto")}
                />

                <StatusBadge status={fila.estado} className="absolute top-2.5 left-2.5 shadow-card" />
              </div>

              <div className="space-y-2 p-3.5">
                <p className="line-clamp-2 leading-snug font-semibold group-hover:underline">
                  {fila.nombre}
                </p>

                <FilaDatos className="flex-col items-start gap-y-1.5">
                  {fila.universidad &&
                    (fila.universidad_logo ? (
                      // Con logo, el logo hace de icono: siglas y escudo, no el nombre largo.
                      <span className="flex max-w-full items-center gap-2 text-sm">
                        <LogoUniversidad siglas={fila.universidad} url={fila.universidad_logo} className="size-6" />
                        <span className="truncate font-medium">{fila.universidad}</span>
                      </span>
                    ) : (
                      <Dato icono={GraduationCap} className="max-w-full">
                        {fila.universidad}
                      </Dato>
                    ))}

                  <Dato
                    icono={enRiesgo ? TriangleAlert : TrendingUp}
                    className={cn(enRiesgo && "text-[#B4342B]")}
                  >
                    {fila.indice === null
                      ? t("noGpa")
                      : `${t("column.gpa")} ${fila.indice.toFixed(2)}`}
                  </Dato>

                  {fila.promedio_secundaria !== null && (
                    <Dato
                      icono={fila.promedio_secundaria < minimoSecundaria ? TriangleAlert : GraduationCap}
                      className={cn(fila.promedio_secundaria < minimoSecundaria && "text-[#B4342B]")}
                    >
                      {t("lista.highSchool")} {fila.promedio_secundaria.toFixed(2)}
                    </Dato>
                  )}

                  {llevaCuenta(fila.estado) && !fila.con_cuenta && (
                    <Dato icono={UserX}>{t("lista.sinCuenta")}</Dato>
                  )}
                </FilaDatos>
              </div>
            </Link>

            <div className="border-t border-linea px-1.5 py-1">
              <PrevisualizarExpediente
                fila={fila}
                idioma={idioma}
                puedeEscribir={puedeEscribir}
                fotoUrl={urlDeAvatar(fila.foto_url)}
                variante="boton"
                textos={textosVistaRapida(fila, t)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
