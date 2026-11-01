/**
 * Control de acceso por rol.
 *
 * Los nombres de rol y los códigos de permiso replican EXACTAMENTE lo que
 * inserta `db/seed.sql` (tablas `rol`, `permiso`, `rol_permiso`). Ojo: los
 * documentos de especificación heredan la nomenclatura del prototipo Base44
 * y hablan de `profesor` y `administrativo`; en la base de datos esos roles
 * son `docente` y `admin`. Manda la base de datos.
 *
 * Las rutas, en cambio, sí conservan los slugs del inventario
 * (`/portal/profesor`, `/portal/administrativo`) porque son URLs públicas ya
 * documentadas.
 *
 * Roles que ya no existen: `psicologo` (la 0030 movió sus cuentas a `admin`) y
 * `colaborador` (la 0065 hizo lo mismo). Si aparecen en un documento viejo,
 * no los reintroduzcas.
 *
 * El reparto de permisos por rol de este archivo es el de FÁBRICA. En marcha
 * manda `rol_permiso`, que el super_admin edita en `/configuracion/permisos`
 * y que la sesión trae en `permisosRol`; estas constantes solo sirven de
 * valor inicial y de respaldo.
 */

export const ROLES = [
  "super_admin",
  "admin",
  "docente",
  "estudiante",
  "contabilidad",
  // Programa Habitudes: da las clases y lleva a los reclutas por el embudo.
  // Postula al candidato y ahí acaba su acceso; el expediente completo es de
  // administración (migración 0030).
  "habitudes",
  // Director de Habitudes (DH): supervisión pedagógica, monitoreo de profesores y liceos en La Vega
  "dir_habitudes",
  // Chofer institucional: operador exclusivo de rutas y seguimiento del transporte
  "chofer",
] as const;

export type Rol = (typeof ROLES)[number];

/**
 * Roles que se pueden asignar desde la pantalla de personal.
 *
 * Todos menos `estudiante`: ese no se crea a mano, sale del expediente cuando
 * administración enlaza la ficha con una cuenta. Vive aquí y no en el archivo de
 * acciones porque un archivo `"use server"` solo puede exportar funciones async
 * —Next lo rechaza al cargar la página, y `tsc` no lo detecta—.
 */
export const ROLES_ASIGNABLES: readonly Rol[] = ROLES.filter(
  (rol) => rol !== "estudiante",
);

/**
 * Los 19 permisos de la tabla `permiso`: los que había en producción, menos
 * `psicologia.leer` y `psicologia.escribir` (0030) y más los dos de
 * solicitudes (0031).
 */
export const PERMISOS = [
  "academico.escribir",
  "academico.leer",
  "calificaciones.registrar",
  // Permisos finos de contabilidad (migración 0034).
  // Los permisos finanzas.* siguen existiendo para compatibilidad
  // con el dashboard viejo; el módulo nuevo usa contabilidad.*
  "contabilidad.aprobar",
  "contabilidad.asiento_manual",
  "contabilidad.auditar",
  "contabilidad.cerrar_periodo",
  "contabilidad.conciliar",
  "contabilidad.configurar",
  "contabilidad.leer",
  "contabilidad.nomina",
  "contabilidad.registrar",
  // Permiso de capacidad: habilita la docencia de Global Effect 360 a quien
  // no es `docente` (p. ej. un profesor de Habitudes que da una clase de 360).
  "docencia.impartir",
  "expedientes.eliminar",
  "expedientes.escribir",
  "expedientes.leer",
  "expedientes.postular",
  "finanzas.escribir",
  "finanzas.leer",
  "habitudes.evidencias.auditar",
  "habitudes.evidencias.subir",
  "habitudes.recursos.leer",
  "habitudes.recursos.subir",
  "habitudes.supervisar",
  "ia.administrar",
  "ia.usar",
  "inventario.auditar",
  "inventario.eliminar",
  "inventario.escribir",
  "inventario.leer",
  "landing.administrar",
  "operaciones.escribir",
  "operaciones.leer",
  "patrocinadores.escribir",
  "patrocinadores.leer",
  "proyectos.asignar_rol",
  "rendicion.enviar",
  "rendicion.revisar",
  "reuniones.agendar",
  "reuniones.gestionar",
  "reuniones.leer",
  "solicitudes.direccion",
  "solicitudes.gestionar",
  "transporte.gestionar",
  "transporte.operar",
  "usuarios.administrar",
] as const;

export type Permiso = (typeof PERMISOS)[number];

/** Portal al que se envía a cada rol tras iniciar sesión. */
export const PORTAL_POR_ROL: Record<Rol, string> = {
  super_admin: "/dashboard",
  admin: "/dashboard",
  docente: "/portal/profesor",
  estudiante: "/portal/estudiante",
  contabilidad: "/portal/contabilidad",
  habitudes: "/habitudes",
  dir_habitudes: "/habitudes",
  chofer: "/portal/chofer",
};

/**
 * Cómo se agrupan los permisos en la pantalla de permisos: por el prefijo del
 * código, en seis módulos. Vive aquí, junto al catálogo, para que un permiso
 * nuevo caiga en un grupo y no quede huérfano.
 */
export const GRUPOS_PERMISOS = {
  academic: ["academico", "calificaciones", "docencia"],
  accounting: ["contabilidad", "finanzas", "rendicion"],
  habitudes: ["habitudes"],
  records: ["expedientes", "solicitudes"],
  operations: [
    "inventario",
    "operaciones",
    "patrocinadores",
    "proyectos",
    "reuniones",
    "transporte",
  ],
  platform: ["ia", "landing", "usuarios"],
} as const;

export type GrupoPermiso = keyof typeof GRUPOS_PERMISOS;

export function grupoDePermiso(permiso: Permiso): GrupoPermiso {
  const prefijo = permiso.split(".")[0];
  const grupo = (Object.keys(GRUPOS_PERMISOS) as GrupoPermiso[]).find((g) =>
    (GRUPOS_PERMISOS[g] as readonly string[]).includes(prefijo),
  );
  return grupo ?? "platform";
}

/** Clave de traducción de un permiso: next-intl no admite puntos en las claves. */
export function clavePermiso(permiso: Permiso): string {
  return permiso.replaceAll(".", "_");
}

export function esPermiso(valor: unknown): valor is Permiso {
  return typeof valor === "string" && (PERMISOS as readonly string[]).includes(valor);
}

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

/**
 * Permisos concedidos a cada rol.
 *
 * Copia literal de lo que hay en `rol_permiso`, para decidir qué se dibuja sin
 * una consulta extra en cada render. La base sigue siendo la autoridad: toda
 * escritura se valida además en el servidor.
 *
 * Hay tres asimetrías que no son lo que sugieren los documentos de
 * especificación y que es fácil "corregir" por error:
 *
 *   · `super_admin` NO lo tiene todo: no tiene `expedientes.postular`, que es
 *     el trabajo de Habitudes y no una función de dirección.
 *   · `admin` NO tiene `finanzas.leer`: la contabilidad es de `contabilidad` y
 *     `super_admin`. Tampoco `solicitudes.direccion`: el segundo nivel de
 *     aprobación (becas y gastos grandes) es de dirección.
 *   · `docente` NO tiene `academico.escribir`: pone tareas y la nota final de
 *     sus clases de Global Effect 360, pero no crea ni edita el catálogo.
 *
 * El expediente es de administración ENTERO desde la 0030: `admin` y
 * `super_admin` leen, escriben y borran cualquier ficha. El aislamiento por
 * fila que puso la 0025 protegía lo clínico, y con psicología fuera no
 * protegía nada; solo dejaba invisibles a los estudiantes sin asignar.
 *
 * Si algo de esto debe cambiar, se cambia en la base de datos y se refleja
 * aquí, nunca solo aquí.
 */
export const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  // super_admin: solo lectura y auditoría en contabilidad.
  // Separación de funciones: quien audita no opera.
  // finanzas.escribir retirado en 0034 (a super_admin) y en 0036 (a todos).
  super_admin: [
    "academico.escribir",
    "academico.leer",
    "calificaciones.registrar",
    "contabilidad.auditar",
    "contabilidad.leer",
    "expedientes.eliminar",
    "expedientes.escribir",
    "expedientes.leer",
    "finanzas.leer",
    "ia.administrar",
    "ia.usar",
    "inventario.auditar",
    "inventario.eliminar",
    "inventario.escribir",
    "inventario.leer",
    "landing.administrar",
    "operaciones.escribir",
    "operaciones.leer",
    "patrocinadores.escribir",
    "patrocinadores.leer",
    "proyectos.asignar_rol",
    "rendicion.enviar",
    "rendicion.revisar",
    "habitudes.evidencias.auditar",
    "habitudes.evidencias.subir",
    "habitudes.recursos.leer",
    "habitudes.recursos.subir",
    "habitudes.supervisar",
    "reuniones.agendar",
    "reuniones.gestionar",
    "reuniones.leer",
    "solicitudes.direccion",
    "solicitudes.gestionar",
    "transporte.gestionar",
    "transporte.operar",
    "usuarios.administrar",
  ],
  admin: [
    "academico.escribir",
    "academico.leer",
    "expedientes.eliminar",
    "expedientes.escribir",
    "expedientes.leer",
    "habitudes.evidencias.auditar",
    "habitudes.evidencias.subir",
    "habitudes.recursos.leer",
    "habitudes.recursos.subir",
    "habitudes.supervisar",
    "ia.usar",
    "inventario.auditar",
    "inventario.escribir",
    "inventario.leer",
    "landing.administrar",
    "operaciones.escribir",
    "operaciones.leer",
    "patrocinadores.escribir",
    "patrocinadores.leer",
    "rendicion.enviar",
    "rendicion.revisar",
    "reuniones.agendar",
    "reuniones.gestionar",
    "reuniones.leer",
    "solicitudes.gestionar",
    "transporte.gestionar",
    "transporte.operar",
  ],
  habitudes: [
    "expedientes.postular",
    "habitudes.evidencias.subir",
    "habitudes.recursos.leer",
    "habitudes.recursos.subir",
    "ia.usar",
    "rendicion.enviar",
    "reuniones.agendar",
    "reuniones.leer",
  ],
  dir_habitudes: [
    "expedientes.postular",
    "habitudes.evidencias.auditar",
    "habitudes.evidencias.subir",
    "habitudes.recursos.leer",
    "habitudes.recursos.subir",
    "habitudes.supervisar",
    "ia.usar",
    "operaciones.leer",
    "rendicion.enviar",
    "reuniones.agendar",
    "reuniones.gestionar",
    "reuniones.leer",
  ],
  docente: [
    "academico.leer",
    "calificaciones.registrar",
    "docencia.impartir",
    "habitudes.evidencias.subir",
    "habitudes.recursos.leer",
    "habitudes.recursos.subir",
    "ia.usar",
    "operaciones.leer",
    "rendicion.enviar",
    "reuniones.agendar",
    "reuniones.leer",
  ],
  estudiante: [
    "academico.leer",
    "ia.usar",
    "reuniones.agendar",
    "reuniones.leer",
  ],
  chofer: [
    "transporte.operar",
    "ia.usar",
  ],
  // contabilidad: todos los permisos del módulo menos auditar.
  // Un auxiliar puede tener registrar sin aprobar via usuario_permiso.
  contabilidad: [
    "contabilidad.aprobar",
    "contabilidad.asiento_manual",
    "contabilidad.cerrar_periodo",
    "contabilidad.conciliar",
    "contabilidad.configurar",
    "contabilidad.leer",
    "contabilidad.nomina",
    "contabilidad.registrar",
    "finanzas.leer",
    "ia.usar",
    "inventario.auditar",
    "inventario.leer",
    "patrocinadores.leer",
    "rendicion.enviar",
    "rendicion.revisar",
    "reuniones.agendar",
    "reuniones.leer",
  ],
};

/**
 * Reparto de FÁBRICA de un rol. Para decidir qué puede una PERSONA usa
 * `usuarioTienePermiso`: este ignora lo que el super_admin cambió en la base.
 */
export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol].includes(permiso);
}

/**
 * Excepción individual al reparto por rol, de `usuario_permiso` (0034).
 * Existe para el auxiliar contable que registra pero no aprueba: así
 * nadie aprueba lo que él mismo registró sin crear un rol para una persona.
 */
export type ExcepcionPermiso = {
  permiso: Permiso;
  concedido: boolean; // true = suma al rol, false = resta al rol
};

/**
 * Permiso de una PERSONA: su rol más sus excepciones. Una excepción, sea
 * para conceder o para revocar, gana sobre el rol.
 *
 * Recibe el usuario de la sesión y no el rol suelto porque `tienePermiso`
 * por rol sigue siendo correcto para todo lo que no tiene excepciones;
 * contabilidad y `requerirPermiso` usan esta.
 */
export type UsuarioConPermisos = {
  rol: Rol;
  /** La sesión siempre las trae; un usuario parcial (scripts) no tiene. */
  excepciones?: readonly ExcepcionPermiso[];
  /** Lo que `rol_permiso` concede al rol; sin él se usa el reparto de fábrica. */
  permisosRol?: readonly Permiso[];
};

export function usuarioTienePermiso(
  usuario: UsuarioConPermisos,
  permiso: Permiso,
): boolean {
  const excepcion = usuario.excepciones?.find((e) => e.permiso === permiso);
  if (excepcion !== undefined) return excepcion.concedido;
  return (usuario.permisosRol ?? PERMISOS_POR_ROL[usuario.rol]).includes(permiso);
}

/** Basta con uno de los permisos para pasar. */
export function usuarioTieneAlgunPermiso(
  usuario: UsuarioConPermisos,
  permisos: readonly Permiso[],
): boolean {
  return permisos.some((permiso) => usuarioTienePermiso(usuario, permiso));
}

/**
 * Todo lo que la persona puede, ya resuelto: rol más excepciones. Viaja al
 * armazón del navegador para que el menú muestre también lo que se le
 * habilitó a título personal, no solo lo de su rol.
 */
export function permisosEfectivos(usuario: UsuarioConPermisos): Permiso[] {
  return PERMISOS.filter((permiso) => usuarioTienePermiso(usuario, permiso));
}
