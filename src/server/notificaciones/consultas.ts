import { consultar } from "@/lib/db";

/**
 * Notificaciones internas de una cuenta.
 *
 * La tabla `notificacion` existe desde la migración 0003 y **se escribía sin
 * que nadie pudiera leerla**: al crear una tarea se inserta un aviso por
 * asignado, y hasta ahora ese aviso no aparecía en ninguna pantalla. Esto es la
 * otra mitad.
 *
 * UNA SOLA CONSULTA PARA LA LISTA Y EL CONTADOR. La campana necesita las dos
 * cosas —cuántas hay sin leer y las últimas— y se pintan en el armazón, es
 * decir **en cada página interna**: dos viajes al pooler por página, para
 * siempre, por un número que casi siempre es cero. El `count(...) OVER ()`
 * cuenta sobre TODAS las filas del usuario y no sobre las que sobreviven al
 * LIMIT, porque las funciones de ventana se calculan antes de recortar.
 */

export type Notificacion = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  enlace: string | null;
  created_at: Date;
  /** Sin leer del total de la cuenta, no de las filas devueltas. */
  sin_leer: number;
};

/**
 * Las últimas notificaciones de la cuenta, con el contador de las no leídas.
 *
 * Las no leídas van primero y luego por fecha: una campana ordenada solo por
 * fecha esconde el aviso de ayer que nadie ha abierto detrás del de hoy que ya
 * se leyó.
 */
export async function misNotificaciones(
  usuarioId: string,
  limite = 8,
): Promise<Notificacion[]> {
  return consultar<Notificacion>(
    `SELECT id,
            titulo,
            mensaje,
            tipo,
            leida,
            enlace,
            created_at,
            count(*) FILTER (WHERE NOT leida) OVER ()::int AS sin_leer
       FROM notificacion
      WHERE usuario_id = $1
      ORDER BY leida, created_at DESC
      LIMIT $2`,
    [usuarioId, limite],
  );
}
