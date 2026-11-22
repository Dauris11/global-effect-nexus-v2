/**
 * Qué tan llena está la ficha de un estudiante, por sección del formulario, para que quien
 * hizo un registro rápido sepa qué falta completar. Cuenta datos que de verdad se piden en
 * la Fundación; un campo vacío es «falta», aunque la respuesta correcta sea «ninguna».
 */
export const SECCIONES_FICHA = ["identity", "academic", "family", "housing", "health", "social"] as const;

export type SeccionFicha = (typeof SECCIONES_FICHA)[number];

type Dato = string | number | null | undefined;

export type DatosFicha = {
  cedula: Dato;
  fecha_nacimiento: Dato;
  telefono: Dato;
  email: Dato;
  direccion: Dato;
  universidad_id: Dato;
  carrera_id: Dato;
  pensum_id: Dato;
  matricula: Dato;
  fecha_ingreso: Dato;
  centro_educativo: Dato;
  con_quien_vive: Dato;
  hermanos_cantidad: Dato;
  casa_propia: Dato;
  tipo_casa: Dato;
  habitaciones: Dato;
  enfermedades: Dato;
  alergias: Dato;
  contacto_emergencia_nombre: Dato;
  contacto_emergencia_telefono: Dato;
  historia_de_vida: Dato;
  situacion_familiar: Dato;
  situacion_economica: Dato;
  motivo_beca: Dato;
  metas_academicas: Dato;
  /** Cuántos familiares tienen al menos el nombre. */
  familiares_con_nombre: number;
};

const CAMPOS: Record<SeccionFicha, readonly (keyof DatosFicha)[]> = {
  identity: ["cedula", "fecha_nacimiento", "telefono", "email", "direccion"],
  academic: ["universidad_id", "carrera_id", "pensum_id", "matricula", "fecha_ingreso", "centro_educativo"],
  family: ["con_quien_vive", "hermanos_cantidad", "familiares_con_nombre"],
  housing: ["casa_propia", "tipo_casa", "habitaciones"],
  health: ["enfermedades", "alergias", "contacto_emergencia_nombre", "contacto_emergencia_telefono"],
  social: ["historia_de_vida", "situacion_familiar", "situacion_economica", "motivo_beca", "metas_academicas"],
};

const lleno = (v: Dato) => v !== null && v !== undefined && String(v).trim() !== "" && v !== 0;

export function completitudFicha(d: DatosFicha): { porcentaje: number; incompletas: SeccionFicha[] } {
  let total = 0;
  let hechos = 0;
  const incompletas: SeccionFicha[] = [];

  for (const seccion of SECCIONES_FICHA) {
    let faltan = false;

    for (const campo of CAMPOS[seccion]) {
      total++;
      // Cero habitaciones o cero hermanos sí es una respuesta; solo se pide que no esté vacío.
      const valor = d[campo];
      const hay = campo === "hermanos_cantidad" || campo === "habitaciones" ? valor !== null && valor !== undefined : lleno(valor);

      if (hay) hechos++;
      else faltan = true;
    }

    if (faltan) incompletas.push(seccion);
  }

  return { porcentaje: Math.round((hechos / total) * 100), incompletas };
}
