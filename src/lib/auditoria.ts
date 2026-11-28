import { consultarUna } from "@/lib/db";

/**
 * Registro de acciones sensibles en `audit_log`.
 *
 * Estaba pendiente como trabajo transversal y empezó en el antiguo módulo de
 * psicología (cerrado en la 0030). Hoy lo usan las decisiones de solicitudes,
 * los expedientes, el catálogo académico y contabilidad: quién aprobó, quién
 * borró y quién consultó tiene que quedar anotado con nombre y fecha.
 *
 * `datos` guarda lo justo para entender el cambio —el estado anterior, el
 * nuevo— y NUNCA el contenido de la nota: duplicar el texto clínico en una
 * segunda tabla multiplica el sitio desde el que se puede filtrar. Que la nota
 * existe y quién la escribió es auditoría; lo que dice, no.
 *
 * No lanza nunca. Si el registro falla, la acción del usuario ya se hizo y
 * abortarla ahora sería peor: se anota el fallo en el servidor y se sigue.
 */
export async function registrar({
  usuarioId,
  accion,
  entidad,
  entidadId,
  datos,
}: {
  /** `null` cuando no hay cuenta: un intento de acceso fallido no tiene autor. */
  usuarioId: string | null;
  /** Verbo en pasado y en minúsculas: `cita.completada`, `nota.creada`. */
  accion: string;
  /** Tabla afectada, tal como se llama en la base. */
  entidad: string;
  entidadId?: string | null;
  datos?: Record<string, unknown>;
}): Promise<void> {
  try {
    // «Ver como usuario…»: si quien actúa es una persona suplantada, el autor de verdad es el developer. Se anota
    // a su nombre y la persona suplantada queda en `datos`, para que nadie cargue con lo que otro hizo. Import
    // dinámico porque `auth.ts` también usa este archivo; fuera de una petición (scripts) simplemente no aplica.
    let autor = usuarioId;
    let detalle = datos;

    try {
      const { obtenerUsuarioActual } = await import("@/lib/auth");
      const sesion = await obtenerUsuarioActual();

      if (sesion?.suplantando && usuarioId === sesion.id) {
        autor = sesion.realId;
        detalle = { ...datos, suplantando_a: sesion.id, suplantando_a_nombre: sesion.nombre };
      }
    } catch {
      // Sin contexto de petición no hay suplantación que atribuir.
    }

    await consultarUna<{ id: string }>(
      `INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, datos)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        autor,
        accion,
        entidad,
        entidadId ?? null,
        detalle ? JSON.stringify(detalle) : null,
      ],
    );
  } catch (error) {
    console.error("[auditoria] no se pudo registrar", accion, error);
  }
}
