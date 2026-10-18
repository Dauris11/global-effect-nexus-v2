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
 * Hasta octubre de 2026 había un séptimo rol, `psicologo`. La Fundación cerró
 * el departamento, la 0030 movió sus cuentas a `admin` y borró el rol: si
 * aparece en algún documento viejo, ya no existe.
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
  "expedientes.eliminar",
  "expedientes.escribir",
  "expedientes.leer",
  "expedientes.postular",
  "finanzas.escribir",
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
  "solicitudes.direccion",
  "solicitudes.gestionar",
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
  habitudes: "/expedientes",
};

/** El único acento del sistema: azul de la marca al azul más oscuro. */
const MARCA = {
  gradiente: "bg-gradient-to-br from-[#2096BA] to-[#0a6a8a]",
  badge: "bg-[#2096BA]/15 text-[#187a99]",
} as const;

/**
 * Acento visual de los roles.
 *
 * Antes había uno por rol —naranja administración, rosa para el portal
 * clínico que ya no existe, violeta contabilidad— y era la mayor fuente de color fuera de marca del sistema:
 * cada portal parecía de una aplicación distinta. Ahora todos comparten el azul
 * de la Fundación, y lo que identifica al portal es su icono y su título, no un
 * tono.
 *
 * Se conserva la forma del objeto —un gradiente y unas clases de insignia por
 * rol— porque las pantallas la consumen así, y porque si algún día vuelve a
 * hacer falta distinguir, el sitio donde hacerlo es este y no veinte archivos.
 *
 * Clases literales: Tailwind necesita verlas completas en el código.
 */
export const ESTILO_POR_ROL: Record<
  Rol,
  { gradiente: string; badge: string }
> = {
  super_admin: MARCA,
  admin: MARCA,
  docente: MARCA,
  estudiante: MARCA,
  contabilidad: MARCA,
  habitudes: MARCA,
};


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
 *   · `docente` NO tiene `academico.escribir`: registra calificaciones, pero no
 *     crea ni edita materias ni cursos, aunque los .md digan que "gestiona
 *     cursos técnicos".
 *
 * El expediente es de administración ENTERO desde la 0030: `admin` y
 * `super_admin` leen, escriben y borran cualquier ficha. El aislamiento por
 * fila que puso la 0025 protegía lo clínico, y con psicología fuera no
 * protegía nada; solo dejaba invisibles a los estudiantes sin asignar.
 *
 * Si algo de esto debe cambiar, se cambia en la base de datos y se refleja
 * aquí, nunca solo aquí.
 */
const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
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
    "solicitudes.direccion",
    "solicitudes.gestionar",
    "usuarios.administrar",
  ],
  admin: [
    "academico.escribir",
    "academico.leer",
    "expedientes.eliminar",
    "expedientes.escribir",
    "expedientes.leer",
    "ia.usar",
    "inventario.auditar",
    "inventario.escribir",
    "inventario.leer",
    "landing.administrar",
    "operaciones.escribir",
    "operaciones.leer",
    "patrocinadores.escribir",
    "patrocinadores.leer",
    "solicitudes.gestionar",
  ],
  habitudes: [
    "expedientes.postular",
    "ia.usar",
  ],
  docente: [
    "academico.leer",
    "calificaciones.registrar",
    "ia.usar",
    "operaciones.leer",
  ],
  estudiante: [
    "academico.leer",
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
  ],
};

export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol].includes(permiso);
}

/** Comprueba varios permisos a la vez; basta con uno para pasar. */
export function tieneAlgunPermiso(rol: Rol, permisos: readonly Permiso[]): boolean {
  return permisos.some((permiso) => tienePermiso(rol, permiso));
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
export function usuarioTienePermiso(
  usuario: { rol: Rol; excepciones: readonly ExcepcionPermiso[] },
  permiso: Permiso,
): boolean {
  const excepcion = usuario.excepciones.find((e) => e.permiso === permiso);
  if (excepcion !== undefined) return excepcion.concedido;
  return tienePermiso(usuario.rol, permiso);
}
