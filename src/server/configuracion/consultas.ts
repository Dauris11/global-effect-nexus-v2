import { consultar, consultarUna } from "@/lib/db";

/**
 * Lo que la pantalla de configuración necesita saber de la base.
 *
 * Va aparte de `@/server/personal/consultas` a propósito, aunque las dos lean
 * `usuario`: aquella cruza cada cuenta con Supabase Auth para saber cuándo
 * entró por última vez —una llamada a la API de administración por pantalla—, y
 * eso es lo que hace falta para GESTIONAR cuentas, no para enumerarlas. Aquí
 * solo se enumeran, así que la pantalla no depende de que Auth responda.
 *
 * Y por eso esta pantalla no gestiona: el alta, el cambio de rol y el reinicio
 * de acceso viven en `/administrativo/personal`, que ya está construido. Dos
 * pantallas que cambian roles serían dos sitios donde arreglar el mismo fallo.
 */

export type CuentaDelSistema = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

/**
 * Las cuentas de trabajo, sin los estudiantes.
 *
 * Se excluye el rol `estudiante` por lo mismo que en personal: son cientos, no
 * son cuentas de trabajo y su sitio es el expediente. Una tabla de "usuarios
 * del sistema" con 300 estudiantes dentro no se puede leer.
 */
export async function cuentasDelSistema(): Promise<CuentaDelSistema[]> {
  return consultar<CuentaDelSistema>(
    `SELECT u.id, u.nombre, u.email::text AS email, r.nombre AS rol, u.activo
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE r.nombre <> 'estudiante'
      ORDER BY u.activo DESC, r.nombre, u.nombre
      LIMIT 200`,
  );
}

export type CifrasDelSistema = {
  cuentas: number;
  activas: number;
  estudiantes: number;
  eventos: number;
};

/**
 * Cuatro cifras del estado del sistema, en un solo viaje.
 *
 * `eventos` cuenta `audit_log` entero. Es un `count(*)` sin filtro sobre una
 * tabla que solo crece, y hoy son miles: si algún día son millones habrá que
 * cambiarlo por una estimación (`reltuples`), pero estimar desde el principio
 * habría sido optimizar contra un problema que no existe todavía.
 */
export async function cifrasDelSistema(): Promise<CifrasDelSistema> {
  const fila = await consultarUna<CifrasDelSistema>(
    `SELECT (SELECT count(*)::int FROM usuario u JOIN rol r ON r.id = u.rol_id
              WHERE r.nombre <> 'estudiante') AS cuentas,
            (SELECT count(*)::int FROM usuario u JOIN rol r ON r.id = u.rol_id
              WHERE r.nombre <> 'estudiante' AND u.activo) AS activas,
            (SELECT count(*)::int FROM estudiante) AS estudiantes,
            (SELECT count(*)::int FROM audit_log) AS eventos`,
  );

  return fila ?? { cuentas: 0, activas: 0, estudiantes: 0, eventos: 0 };
}
