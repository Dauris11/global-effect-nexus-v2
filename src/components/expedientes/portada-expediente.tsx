import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  IdCard,
  Lock,
  UserCheck,
  UserX,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { VincularCuenta } from "@/components/expedientes/vincular-cuenta";
import { Badge } from "@/components/ui/badge";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { llevaCuenta, visualDeEstado } from "@/lib/expedientes";
import { fechaCorta } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type {
  CuentaSinVincular,
  CuentaVinculada,
  ExpedienteCompleto,
} from "@/server/expedientes/consultas";

/**
 * Portada del expediente: la tarjeta con la que empieza la ficha.
 *
 * La foto estaba solo dentro del formulario de edición, así que para ponerle
 * cara a un expediente había que abrirlo para editar. Aquí va arriba, junto al
 * nombre, el estado y lo que ata a la persona con el resto del sistema: dónde
 * estudia y con qué cuenta entra al portal. Solo los activos la llevan; a un
 * activo sin cuenta su portal no le ve ni las materias ni las tareas que le
 * dejan los docentes, por eso se dice aquí y se arregla desde aquí.
 */
export async function PortadaExpediente({
  expediente,
  foto,
  cuenta,
  cuentasLibres,
  puedeEditar,
}: {
  expediente: Pick<
    ExpedienteCompleto,
    | "id"
    | "nombre"
    | "estado"
    | "cedula"
    | "universidad"
    | "programa"
    | "donde_estudia"
    | "fecha_ingreso"
  >;
  foto: string | null;
  cuenta: CuentaVinculada | null;
  cuentasLibres: CuentaSinVincular[];
  puedeEditar: boolean;
}) {
  const t = await getTranslations("records");
  const idioma = (await getLocale()) === "en" ? "en" : "es";
  const visual = visualDeEstado(expediente.estado);
  const estudios = expediente.universidad ?? expediente.donde_estudia;
  // Solo los activos llevan cuenta del portal: postulados y suspendidos no.
  const activo = llevaCuenta(expediente.estado);

  return (
    <section className="rounded-card border border-linea bg-card p-5 shadow-card md:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <FotoEstudiante
          nombre={expediente.nombre}
          url={foto}
          className="size-28 rounded-full ring-4 ring-background shadow-card"
          aviso="punto"
          textoSinFoto={t("sinFoto")}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="texto-titulo-pagina font-semibold">{expediente.nombre}</h1>

            <Badge className={cn("gap-1", visual.insignia)}>
              <visual.icono className="size-3.5 shrink-0" />
              {t(`status.${expediente.estado}`)}
            </Badge>
          </div>

          <FilaDatos>
            {estudios && <Dato icono={GraduationCap}>{estudios}</Dato>}
            {expediente.programa && <Dato icono={BookOpen}>{expediente.programa}</Dato>}
            {expediente.cedula && <Dato icono={IdCard}>{expediente.cedula}</Dato>}
            {expediente.fecha_ingreso && (
              <Dato icono={CalendarDays}>
                {t("detail.since")} {fechaCorta(expediente.fecha_ingreso, idioma)}
              </Dato>
            )}
          </FilaDatos>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-4">
        {cuenta ? (
          <Dato icono={UserCheck} className="text-tinta">
            {t("portada.cuenta", { email: cuenta.email })}
          </Dato>
        ) : activo ? (
          <Dato icono={UserX}>{t("portada.sinCuenta")}</Dato>
        ) : (
          <Dato icono={Lock}>{t("portada.cuentaSoloActivos")}</Dato>
        )}

        {/* A un activo se le vincula o cambia la cuenta; a otro estado solo se
            le puede soltar la que le haya quedado de cuando estaba activo. */}
        {puedeEditar && (activo || cuenta) && (
          <VincularCuenta
            estudianteId={expediente.id}
            vinculada={cuenta ? { id: cuenta.id, email: cuenta.email } : null}
            cuentas={activo ? cuentasLibres : []}
            soloDesvincular={!activo}
          />
        )}
      </div>
    </section>
  );
}
