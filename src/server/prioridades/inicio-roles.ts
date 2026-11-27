import { consultarUna } from "@/lib/db";
import { claveMes, diaEnRD } from "@/lib/fechas";
import { indiceDelEstudiante, umbralDeIndice } from "@/server/academico/indice";
import { clasesDelDocente, type ClaseDelDocente } from "@/server/profesor/clases";
import { condicionEnLaFundacion, reunionesEstudiante } from "@/server/estudiantes/portal";

/** Datos propios de cada inicio por rol (los comunes están en `inicio.ts`). */

export type BecaDelMes = {
  indice: number | null;
  minimo: number;
  /** Estados de `status-map`: activa / prueba_academica / pendiente / cumplio / programada. */
  estadoBeca: string;
  servicio: "cumplio" | "pendiente";
  reunion: "cumplio" | "programada" | "pendiente";
};

export async function becaDelMes(usuarioId: string, estudianteId: string | null): Promise<BecaDelMes> {
  const mes = claveMes();
  const [condicion, reuniones, indice, minimo] = await Promise.all([
    condicionEnLaFundacion(estudianteId, 3),
    reunionesEstudiante(usuarioId, estudianteId),
    indiceDelEstudiante(estudianteId),
    umbralDeIndice(),
  ]);
  const delMes = condicion.find((m) => m.mes === mes);
  const hayReunion = reuniones.some((r) => r.fecha.startsWith(mes));

  return {
    indice,
    minimo,
    estadoBeca: indice === null ? "pendiente" : indice >= minimo ? "activa" : "prueba_academica",
    servicio: delMes?.hizo_servicio ? "cumplio" : "pendiente",
    reunion: delMes?.asistio_reunion ? "cumplio" : hayReunion ? "programada" : "pendiente",
  };
}

/** Las clases del docente y cuáles tienen sesión hoy (las tarjetas de «Mis clases de hoy»). */
export async function clasesDelDocenteHoy(docenteId: string): Promise<{ todas: ClaseDelDocente[]; hoy: ClaseDelDocente[] }> {
  const todas = await clasesDelDocente(docenteId);
  const hoy = diaEnRD();

  return { todas, hoy: todas.filter((c) => c.proxima_sesion === hoy) };
}

/** «431 estudiantes en 7 liceos este año»: lo que antes eran cuatro tarjetas en el inicio de Habitudes. */
export async function impactoDelAnio(): Promise<{ estudiantes: number; liceos: number }> {
  const f = await consultarUna<{ estudiantes: number; liceos: number }>(
    `SELECT coalesce(sum(estudiantes_impactados), 0)::int AS estudiantes, count(DISTINCT liceo_id)::int AS liceos
       FROM public.habitudes_visita_evidencia
      WHERE estado <> 'borrador'
        AND fecha_visita >= date_trunc('year', (now() AT TIME ZONE 'America/Santo_Domingo'))::date`,
  );

  return f ?? { estudiantes: 0, liceos: 0 };
}
