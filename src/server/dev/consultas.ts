import { consultar, consultarUna } from "@/lib/db";

/**
 * Lecturas del panel `/dev`. Cada una es de SOLO lectura y la pantalla ya exige `tecnico.dev_panel`; aquí no se
 * vuelve a comprobar porque ninguna se llama desde un componente cliente.
 */

export type FiltroRegistro = "todos" | "sesion" | "tecnico" | "bloqueadas";

/** Prefijo de `audit_log.accion` de cada chip. Parametrizado en el SQL: nada de interpolar. */
const PATRON_ACCION: Record<FiltroRegistro, string> = {
  todos: "%",
  sesion: "sesion.%",
  tecnico: "parametro_tecnico.%",
  bloqueadas: "sesion.ver_como_escritura_%",
};

export const FILTROS_REGISTRO = Object.keys(PATRON_ACCION) as FiltroRegistro[];

export const esFiltroRegistro = (v: string | undefined): v is FiltroRegistro =>
  v !== undefined && v in PATRON_ACCION;

export type EventoReciente = {
  id: string;
  accion: string;
  entidad: string;
  created_at: Date;
  actor: string | null;
};

/**
 * Los últimos eventos de `audit_log`. Es la única bitácora que el sistema escribe de punta a punta; no hay
 * tabla de logs de aplicación. El detalle (`datos`) NO se trae: el visor completo de Configuración → Auditoría
 * ya tapa lo clínico histórico en SQL, y este resumen no debe abrir una puerta de atrás a eso.
 */
export function eventosRecientes(filtro: FiltroRegistro, busqueda: string, limite = 15): Promise<EventoReciente[]> {
  return consultar<EventoReciente>(
    `SELECT a.id, a.accion, a.entidad, a.created_at, u.nombre AS actor
       FROM audit_log a
       LEFT JOIN usuario u ON u.id = a.usuario_id
      WHERE a.accion LIKE $1
        AND a.entidad NOT IN ('cita_psicologia', 'nota_psicologica', 'perfil_psicologico')
        AND ($2 = '' OR a.accion ILIKE '%' || $2 || '%' OR a.entidad ILIKE '%' || $2 || '%' OR u.nombre ILIKE '%' || $2 || '%')
      ORDER BY a.created_at DESC
      LIMIT $3`,
    [PATRON_ACCION[filtro], busqueda.trim().slice(0, 80), limite],
  );
}

export type EstadoColaCorreo = {
  pendientes: number;
  fallidos: number;
  ultimo_envio: Date | null;
  ultimo_error: string | null;
};

/** Estado de `correo_cola`: lo pendiente, lo que falló, y cuándo salió el último correo. */
export async function estadoColaCorreo(): Promise<EstadoColaCorreo> {
  const fila = await consultarUna<EstadoColaCorreo>(
    `SELECT count(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
            count(*) FILTER (WHERE estado = 'fallido')::int AS fallidos,
            max(enviado_en) AS ultimo_envio,
            (SELECT ultimo_error FROM correo_cola WHERE estado = 'fallido' ORDER BY created_at DESC LIMIT 1) AS ultimo_error
       FROM correo_cola`,
  );

  return fila ?? { pendientes: 0, fallidos: 0, ultimo_envio: null, ultimo_error: null };
}
