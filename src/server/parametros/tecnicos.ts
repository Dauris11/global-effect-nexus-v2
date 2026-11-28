import { consultarUna } from "@/lib/db";
import { CLAVE_IMPERSONATION_WRITE } from "@/lib/suplantacion";

/**
 * Parámetros TÉCNICOS (solo `tecnico.parametros`, o sea developer). Viven en la misma tabla que los
 * institucionales (`parametro_institucional`) pero con prefijo `tecnico.` y NO aparecen en
 * `src/lib/parametros.ts`: así la pantalla de coordinación (admin/owner) ni los ve ni los puede guardar.
 *
 * Este archivo solo LEE y no importa `auth.ts` (que lo usa para el guard de «Ver como usuario…»); la acción
 * que escribe está en `acciones-tecnicas.ts`.
 */

export const DEFINICIONES_TECNICAS = [
  // 0 = «Ver como usuario…» no puede escribir; 1 = puede, con confirmación de la sesión. Por defecto bloqueado.
  { clave: CLAVE_IMPERSONATION_WRITE, tipo: "booleano", defecto: "false" },
] as const;

export type ClaveParametroTecnico = (typeof DEFINICIONES_TECNICAS)[number]["clave"];

export async function parametroTecnico(clave: ClaveParametroTecnico): Promise<string> {
  const def = DEFINICIONES_TECNICAS.find((d) => d.clave === clave);
  const fila = await consultarUna<{ valor: string }>(
    `SELECT valor FROM public.parametro_institucional WHERE clave = $1`,
    [clave],
  );

  return fila?.valor ?? def?.defecto ?? "";
}

/** `true` solo si un developer lo activó explícitamente. Ante un fallo de lectura, bloqueado. */
export async function impersonationWriteActivo(): Promise<boolean> {
  try {
    return (await parametroTecnico(CLAVE_IMPERSONATION_WRITE)) === "true";
  } catch (error) {
    console.error("[suplantacion] no se pudo leer impersonation_write; se bloquea", error);
    return false;
  }
}
