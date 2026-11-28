"use server";

import { obtenerUsuarioActual } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { usuarioTienePermiso, type Rol } from "@/lib/rbac";

export type PersonaVerComo = { id: string; nombre: string; email: string; rol: Rol };

/**
 * Personas a las que un developer puede «ver como». Solo `tecnico.dev_panel`.
 *
 * Usa `obtenerUsuarioActual` y no `requerirUsuario` a propósito: con «Ver como usuario…» ya activo, la sesión
 * efectiva es la de otra persona, y `requerirUsuario` bloquearía esta búsqueda (es una acción del servidor) justo
 * cuando el developer quiere saltar a una tercera. El permiso se comprueba contra la cuenta REAL: si está
 * suplantando, basta con que su rol real sea developer, porque los permisos efectivos ya no son los suyos.
 *
 * La búsqueda es en SQL y con tope de 20 filas: la lista de personas no viaja entera al navegador. Quedan fuera
 * las cuentas inactivas, la propia y las de otros developers (nadie «ve como» desarrollador).
 */
export async function buscarPersonasVerComo(texto: string): Promise<PersonaVerComo[]> {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) return [];

  const autorizado = usuario.suplantando
    ? usuario.rolReal === "developer"
    : usuarioTienePermiso(usuario, "tecnico.dev_panel");

  if (!autorizado) return [];

  const q = texto.trim().slice(0, 80);

  return consultar<PersonaVerComo>(
    `SELECT u.id, u.nombre, u.email::text AS email, r.nombre AS rol
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.activo AND r.nombre <> 'developer' AND u.id <> $1
        AND ($2 = '' OR u.nombre ILIKE '%' || $2 || '%' OR u.email::text ILIKE '%' || $2 || '%')
      ORDER BY u.nombre
      LIMIT 20`,
    [usuario.realId, q],
  );
}
