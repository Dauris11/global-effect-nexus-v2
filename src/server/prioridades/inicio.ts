import { consultar } from "@/lib/db";
import type { UsuarioSesion } from "@/lib/auth";
import { diaEnRD } from "@/lib/fechas";
import { cuentasConSaldo } from "@/server/contabilidad/bancos/consultas";

/** Lo que acompaña a la lista de prioridades en `/inicio`: agenda, proyectos, contexto, cifras y equipo. */

export type EventoAgenda = { id: string; titulo: string; fecha: string; hora: string | null; tipo: "reunion" | "evento" };
export type ProyectoLiderado = { id: string; nombre: string; progreso: number; estado: string };
export type PersonaDelEquipo = { id: string; nombre: string; rol: string; vencidas: number };
export type CifrasContables = { saldoBancos: number; porPagar7: number; ingresosMes: number };
export type PastillaContexto = { clave: "prematricula"; cierra: string; sinElegir: number };

const hoyYManana = () => {
  const hoy = diaEnRD();

  return [hoy, diaEnRD(new Date(Date.now() + 86_400_000))] as const;
};

/** Reuniones donde participo u organizo y eventos del calendario, de hoy y mañana (máx. 5). */
export async function agendaDeHoy(usuario: UsuarioSesion): Promise<EventoAgenda[]> {
  const [hoy, manana] = hoyYManana();
  const [reuniones, eventos] = await Promise.all([
    consultar<EventoAgenda>(
      `SELECT r.id, r.titulo, r.fecha::text AS fecha, to_char(r.hora_inicio, 'HH24:MI') AS hora, 'reunion' AS tipo
         FROM reunion r
        WHERE r.fecha BETWEEN $2::date AND $3::date
          AND r.estado NOT IN ('cancelada')
          AND (r.organizador_usuario_id = $1
               OR EXISTS (SELECT 1 FROM reunion_participante p WHERE p.reunion_id = r.id AND p.usuario_id = $1))
        LIMIT 10`,
      [usuario.id, hoy, manana],
    ),
    consultar<EventoAgenda>(
      `SELECT e.id, e.titulo, e.fecha::text AS fecha, e.hora_inicio AS hora, 'evento' AS tipo
         FROM evento e
        WHERE e.fecha BETWEEN $1::date AND $2::date AND e.estado <> 'cancelado' AND e.tarea_id IS NULL
        LIMIT 10`,
      [hoy, manana],
    ),
  ]);

  return [...reuniones, ...eventos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "99").localeCompare(b.hora ?? "99"))
    .slice(0, 5);
}

/** Solo los proyectos que LIDERO (responsable), con su avance. */
export async function proyectosQueLidero(userId: string): Promise<ProyectoLiderado[]> {
  return consultar<ProyectoLiderado>(
    `SELECT id, nombre, coalesce(progreso, 0)::int AS progreso, estado
       FROM proyecto WHERE responsable_id = $1 AND estado <> 'completado'
      ORDER BY fecha_fin NULLS LAST LIMIT 3`,
    [userId],
  );
}

/** Lo temporal de la Fundación: máximo 2 pastillas. Hoy, la ventana de prematrícula abierta. */
export async function contextoInstitucional(): Promise<PastillaContexto[]> {
  const filas = await consultar<{ cierra: string; sin_elegir: number }>(
    `SELECT to_char(v.cierra AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD') AS cierra,
            (SELECT count(*)::int FROM estudiante e WHERE e.estado = 'activo'
                AND NOT EXISTS (SELECT 1 FROM inscripcion i WHERE i.estudiante_id = e.id AND i.periodo_id = v.periodo_id)) AS sin_elegir
       FROM ventana_prematricula v
      WHERE v.activa AND now() BETWEEN v.abre AND v.cierra
      ORDER BY v.cierra LIMIT 1`,
  ).catch(() => []);

  return filas.map((f) => ({ clave: "prematricula" as const, cierra: f.cierra, sinElegir: f.sin_elegir }));
}

/** Tres cifras de contabilidad (y nada más): saldo en bancos, por pagar a 7 días e ingresos del mes. */
export async function cifrasContables(): Promise<CifrasContables> {
  const hoy = diaEnRD();
  const [cuentas, otras] = await Promise.all([
    cuentasConSaldo(),
    consultar<{ por_pagar: string; ingresos: string }>(
      `SELECT coalesce((SELECT sum(CASE moneda WHEN 'DOP' THEN saldo ELSE saldo * contabilidad.tasa_referencia($1::date) END)
                          FROM contabilidad.cuenta_por_pagar
                         WHERE estado IN ('pendiente', 'programada', 'pagada_parcial') AND saldo > 0
                           AND fecha_vencimiento <= $1::date + 7), 0)::text AS por_pagar,
              coalesce((SELECT sum(coalesce(monto_dop, monto)) FROM contabilidad.recibo
                         WHERE tipo = 'ingreso' AND estado = 'contabilizado'
                           AND date_trunc('month', fecha) = date_trunc('month', $1::date)), 0)::text AS ingresos`,
      [hoy],
    ),
  ]);

  return {
    saldoBancos: cuentas.filter((c) => c.estado === "activa").reduce((t, c) => t + Number(c.saldo_dop ?? 0), 0),
    porPagar7: Number(otras[0]?.por_pagar ?? 0),
    ingresosMes: Number(otras[0]?.ingresos ?? 0),
  };
}

/** Pestaña «Equipo» (dirección): el personal activo ordenado por cuántas tareas vencidas tiene. */
export async function equipoConVencidas(): Promise<PersonaDelEquipo[]> {
  return consultar<PersonaDelEquipo>(
    `SELECT u.id, u.nombre, r.nombre AS rol,
            count(t.id) FILTER (WHERE t.estado NOT IN ('completada', 'cancelada')
                                  AND t.fecha_limite < (now() AT TIME ZONE 'America/Santo_Domingo')::date)::int AS vencidas
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
       LEFT JOIN tarea_asignado ta ON ta.usuario_id = u.id
       LEFT JOIN tarea t ON t.id = ta.tarea_id
      WHERE u.activo AND r.nombre NOT IN ('estudiante', 'owner') AND u.nombre NOT ILIKE 'Sistema%'
      GROUP BY u.id, u.nombre, r.nombre
      ORDER BY vencidas DESC, u.nombre`,
  );
}
