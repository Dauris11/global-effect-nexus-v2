import { FORMATOS_DE } from "@/lib/exportar";
import type { Permiso } from "@/lib/rbac";

import type { Documento, Formato } from "./documento";
import { documentoAvance, documentoFicha, documentoRecord } from "./documentos/expediente";
import {
  documentoClase360,
  documentoEstudiantesPatrocinador,
  documentoEstudiantesUniversidad,
  documentoListaExpedientes,
  documentoNotasUniversidad,
  documentoPlanDeEstudios,
  documentoRiesgo,
} from "./documentos/listas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Todo lo que el sistema sabe imprimir o exportar. Cada documento dice quién puede pedirlo
 * (basta UNO de los permisos), en qué formatos tiene sentido y cómo se arma. La ficha de un
 * estudiante, por ejemplo, no tiene sentido en CSV; una lista sí en los cuatro.
 */
export type DefinicionExportacion = {
  permisos: readonly Permiso[];
  formatos: readonly Formato[];
  /** Entidad y parámetro que identifican lo exportado, para la bitácora. */
  entidad: string;
  construir: (p: URLSearchParams) => Promise<Documento | null>;
};

const id = (p: URLSearchParams, clave = "id") => {
  const v = p.get(clave) ?? "";

  return UUID.test(v) ? v : null;
};

export const EXPORTACIONES: Record<string, DefinicionExportacion> = {
  ficha: { permisos: ["expedientes.leer"], formatos: FORMATOS_DE["ficha"], entidad: "estudiante", construir: async (p) => (id(p) ? documentoFicha(id(p)!) : null) },
  record: { permisos: ["expedientes.leer"], formatos: FORMATOS_DE["record"], entidad: "estudiante", construir: async (p) => (id(p) ? documentoRecord(id(p)!) : null) },
  avance: { permisos: ["expedientes.leer"], formatos: FORMATOS_DE["avance"], entidad: "estudiante", construir: async (p) => (id(p) ? documentoAvance(id(p)!) : null) },
  expedientes: { permisos: ["expedientes.leer"], formatos: FORMATOS_DE["expedientes"], entidad: "estudiante", construir: (p) => documentoListaExpedientes(p) },
  riesgo: { permisos: ["expedientes.leer"], formatos: FORMATOS_DE["riesgo"], entidad: "estudiante", construir: () => documentoRiesgo() },
  "estudiantes-universidad": { permisos: ["expedientes.leer"], formatos: FORMATOS_DE["estudiantes-universidad"], entidad: "universidad", construir: async (p) => (id(p) ? documentoEstudiantesUniversidad(id(p)!) : null) },
  "notas-universidad": { permisos: ["expedientes.leer"], formatos: FORMATOS_DE["notas-universidad"], entidad: "universidad", construir: async (p) => (id(p) ? documentoNotasUniversidad(id(p)!) : null) },
  "plan-estudios": { permisos: ["catalogo.leer"], formatos: FORMATOS_DE["plan-estudios"], entidad: "pensum", construir: async (p) => (id(p) ? documentoPlanDeEstudios(id(p)!) : null) },
  "clase-360": { permisos: ["expedientes.leer", "docencia.impartir"], formatos: FORMATOS_DE["clase-360"], entidad: "materia_360", construir: async (p) => (id(p, "materia") && id(p, "periodo") ? documentoClase360(id(p, "materia")!, id(p, "periodo")!, false) : null) },
  "asistencia-360": { permisos: ["expedientes.leer", "docencia.impartir"], formatos: FORMATOS_DE["asistencia-360"], entidad: "materia_360", construir: async (p) => (id(p, "materia") && id(p, "periodo") ? documentoClase360(id(p, "materia")!, id(p, "periodo")!, true) : null) },
  "estudiantes-patrocinador": { permisos: ["patrocinadores.leer"], formatos: FORMATOS_DE["estudiantes-patrocinador"], entidad: "patrocinador", construir: async (p) => (id(p) ? documentoEstudiantesPatrocinador(id(p)!) : null) },
};

export type TipoExportacion = keyof typeof EXPORTACIONES;
