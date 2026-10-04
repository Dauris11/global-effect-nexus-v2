import { consultar, consultarUna } from "@/lib/db";
import { identidadesPorCorreo } from "@/lib/supabase/admin";

/**
 * El equipo: quién tiene cuenta, con qué rol y si la usa.
 *
 * Cruza dos fuentes porque el dato está repartido: `usuario` sabe el rol y si la
 * cuenta está activa, y Supabase Auth sabe cuándo entró por última vez. Lo
 * segundo es lo que dice si una invitación llegó a usarse alguna vez, y no está
 * en nuestra base.
 */

export type PersonaDelEquipo = {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  /** `false` cuando nadie ha enlazado la cuenta con una identidad de acceso. */
  puede_entrar: boolean;
  tareas_abiertas: number;
  /** ISO, o `null` si nunca ha entrado. Viene de Supabase Auth. */
  ultimo_acceso: string | null;
};

export type CifrasEquipo = {
  total: number;
  activas: number;
  inactivas: number;
  sin_entrar: number;
};

/**
 * Las personas del equipo, con su carga de trabajo.
 *
 * Se excluye el rol `estudiante`: son cientos y no forman parte del equipo, su
 * sitio es el expediente. Esta pantalla es de cuentas de trabajo.
 */
export async function equipo(): Promise<PersonaDelEquipo[]> {
  const filas = await consultar<Omit<PersonaDelEquipo, "ultimo_acceso">>(
    `SELECT u.id,
            u.email::text AS email,
            u.nombre,
            r.nombre AS rol,
            u.activo,
            (u.auth_user_id IS NOT NULL) AS puede_entrar,
            (SELECT count(*)::int
               FROM tarea_asignado ta
               JOIN tarea t ON t.id = ta.tarea_id
              WHERE ta.usuario_id = u.id
                AND t.estado IN ('pendiente', 'en_progreso')) AS tareas_abiertas
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE r.nombre <> 'estudiante'
      ORDER BY u.activo DESC, r.nombre, u.nombre`,
  );

  const identidades = await identidadesPorCorreo();

  return filas.map((fila) => ({
    ...fila,
    ultimo_acceso: identidades.get(fila.email.toLowerCase())?.last_sign_in_at ?? null,
  }));
}

/** Las cuatro cifras de cabecera, del mismo conjunto que la lista. */
export async function cifrasEquipo(): Promise<CifrasEquipo> {
  const fila = await consultarUna<Omit<CifrasEquipo, "sin_entrar">>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE u.activo)::int AS activas,
            count(*) FILTER (WHERE NOT u.activo)::int AS inactivas
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE r.nombre <> 'estudiante'`,
  );

  // "Sin primer acceso" sale de Auth, así que se cuenta sobre la lista ya
  // cruzada en vez de con una segunda consulta a la base.
  const lista = await equipo();

  return {
    ...(fila ?? { total: 0, activas: 0, inactivas: 0 }),
    sin_entrar: lista.filter((p) => p.ultimo_acceso === null).length,
  };
}

/** Los roles que se pueden asignar, con cuánta gente hay en cada uno. */
export async function repartoPorRol(): Promise<
  { rol: string; total: number }[]
> {
  return consultar<{ rol: string; total: number }>(
    `SELECT r.nombre AS rol,
            count(u.id) FILTER (WHERE u.activo)::int AS total
       FROM rol r
       LEFT JOIN usuario u ON u.rol_id = r.id
      WHERE r.nombre <> 'estudiante'
      GROUP BY r.nombre
      ORDER BY r.nombre`,
  );
}
