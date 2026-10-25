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
    await consultarUna<{ id: string }>(
      `INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, datos)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        usuarioId,
        accion,
        entidad,
        entidadId ?? null,
        datos ? JSON.stringify(datos) : null,
      ],
    );
  } catch (error) {
    console.error("[auditoria] no se pudo registrar", accion, error);
  }
}
