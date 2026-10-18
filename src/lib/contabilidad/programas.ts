/**
 * Programas y centros de costo de la Fundación Global Effect (La Vega, RD).
 *
 * Cada factura, recibo o gasto de caja chica puede imputarse analíticamente
 * a uno de estos programas, permitiendo una rendición de cuentas transparente
 * frente a donantes y auditorías ISFL.
 */

export const PROGRAMAS_INSTITUCIONALES = [
  {
    codigo: "academias",
    nombre: "Academias Técnicas y Formación",
    descripcion: "Cursos de tecnología, artes, oficios y capacitación técnica para jóvenes.",
  },
  {
    codigo: "habitudes",
    nombre: "Programa Habitudes",
    descripcion: "Formación en liderazgo, principios, desarrollo del carácter y reclutamiento del embudo.",
  },
  {
    codigo: "comedor",
    nombre: "Comedor y Nutrición Infantil",
    descripcion: "Alimentación comunitaria diaria y meriendas para estudiantes del programa.",
  },
  {
    codigo: "bienestar",
    nombre: "Bienestar y Salud Estudiantil",
    descripcion: "Jornadas médicas, odontología, medicamentos preventivos y apoyo a familias.",
  },
  {
    codigo: "infraestructura",
    nombre: "Mantenimiento e Infraestructura",
    descripcion: "Mantenimiento físico del campus, talleres, aulas, energía, agua y equipos.",
  },
  {
    codigo: "operaciones",
    nombre: "Operaciones y Logística General",
    descripcion: "Transporte, suministros generales, eventos y soporte institucional.",
  },
  {
    codigo: "administrativo",
    nombre: "Gestión Administrativa y Legal",
    descripcion: "Asesoría contable, legal, licencias, plataforma Nexus y gobernanza.",
  },
] as const;

export type CodigoPrograma = (typeof PROGRAMAS_INSTITUCIONALES)[number]["codigo"];

export function obtenerPrograma(codigo: string | null | undefined) {
  if (!codigo) return null;
  return PROGRAMAS_INSTITUCIONALES.find((p) => p.codigo === codigo) ?? null;
}

export function nombrePrograma(codigo: string | null | undefined): string {
  const p = obtenerPrograma(codigo);
  return p ? p.nombre : "Sin programa asignado";
}
