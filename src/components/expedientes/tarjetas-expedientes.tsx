import { GraduationCap, TrendingUp, TriangleAlert, UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { PrevisualizarExpediente } from "@/components/expedientes/previsualizar-expediente";
import { Badge } from "@/components/ui/badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { llevaCuenta, visualDeEstado } from "@/lib/expedientes";
import { GPA_PRUEBA_ACADEMICA } from "@/lib/notas";
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
}: {
  filas: FilaExpediente[];
  idioma: Locale;
  puedeEscribir: boolean;
}) {
  const t = await getTranslations("records");

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {filas.map((fila) => {
        const visual = visualDeEstado(fila.estado);
        const enRiesgo = fila.indice !== null && fila.indice < GPA_PRUEBA_ACADEMICA;

        return (
          <li
            key={fila.id}
            className="flex flex-col overflow-hidden rounded-card border border-linea bg-card shadow-card transition-shadow duration-200 hover:shadow-elevada"
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
                  claseIcono="size-2/5"
                  aviso="pildora"
                  textoSinFoto={t("sinFoto")}
                />

                <Badge
                  className={cn("absolute top-2.5 left-2.5 gap-1 shadow-card", visual.insignia)}
                >
                  <visual.icono className="size-3.5 shrink-0" />
                  {t(`status.${fila.estado}`)}
                </Badge>
              </div>

              <div className="space-y-2 p-3.5">
                <p className="line-clamp-2 leading-snug font-semibold group-hover:underline">
                  {fila.nombre}
                </p>

                <FilaDatos className="flex-col items-start gap-y-1.5">
                  {fila.universidad && (
                    <Dato icono={GraduationCap} className="max-w-full">
                      {fila.universidad}
                    </Dato>
                  )}

                  <Dato
                    icono={enRiesgo ? TriangleAlert : TrendingUp}
                    className={cn(enRiesgo && "text-[#B4342B]")}
                  >
                    {fila.indice === null
                      ? t("noGpa")
                      : `${t("column.gpa")} ${fila.indice.toFixed(2)}`}
                  </Dato>

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
