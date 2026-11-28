import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * «Ver como usuario…»: un developer se pone en el lugar de UNA persona concreta (su sesión, responsabilidades y
 * datos reales). Esto es lo que se comparte entre `auth.ts` y las acciones del selector.
 *
 * La cookie no es el id suelto: lleva quién suplanta, a quién y hasta cuándo, firmado con HMAC. Así una cookie
 * copiada, manipulada o vencida no sirve, y una cookie de un developer no vale en la cuenta de otro. Además
 * `obtenerUsuarioActual` solo la honra si el rol REAL de la cuenta es developer.
 */

export const COOKIE_VER_COMO_USUARIO = "ge_ver_como_usuario";

/** Confirmación de sesión cuando `tecnico.impersonation_write` está activo (ver `exigirSinSuplantacion`). */
export const COOKIE_SUPLANTACION_CONFIRMADA = "ge_ver_como_confirmado";

/** Parámetros de la URL a la que se devuelve a quien intentó escribir suplantando; la UI los muestra. */
export const PARAM_SUPLANTACION_BLOQUEADA = "suplantacion_bloqueada";
export const PARAM_SUPLANTACION_CONFIRMAR = "suplantacion_confirmar";

/** Mismo tope que «Ver como rol»: que no se quede olvidado días. */
export const DURACION_SUPLANTACION_S = 60 * 60 * 8;

/** Clave del parámetro técnico (tabla `parametro_institucional`); sin fila = falso = escritura bloqueada. */
export const CLAVE_IMPERSONATION_WRITE = "tecnico.impersonation_write";

export type CargaSuplantacion = { objetivoId: string; realId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firma(cuerpo: string, secreto: string): string {
  return createHmac("sha256", secreto).update(cuerpo).digest("base64url");
}

/** Secreto del servidor. Falla en voz alta si no hay ninguno: sin secreto no se puede firmar nada. */
export function secretoSuplantacion(): string {
  const secreto = process.env.SUPLANTACION_SECRETO ?? process.env.AUTH_SECRET ?? process.env.SUPABASE_SECRET_KEY;

  if (!secreto) throw new Error("Falta SUPLANTACION_SECRETO (o AUTH_SECRET) para firmar «Ver como usuario».");

  return secreto;
}

export function firmarSuplantacion(
  carga: CargaSuplantacion,
  secreto: string,
  ahora: number = Date.now(),
  duracionS: number = DURACION_SUPLANTACION_S,
): string {
  const expira = Math.floor(ahora / 1000) + duracionS;
  const cuerpo = `${carga.objetivoId}.${carga.realId}.${expira}`;

  return `${cuerpo}.${firma(cuerpo, secreto)}`;
}

/** `null` si la cookie falta, está mal formada, la firma no cuadra o ya venció. */
export function leerSuplantacion(
  valor: string | undefined | null,
  secreto: string,
  ahora: number = Date.now(),
): CargaSuplantacion | null {
  if (!valor) return null;

  const partes = valor.split(".");

  if (partes.length !== 4) return null;

  const [objetivoId, realId, expira, recibida] = partes;

  if (!UUID.test(objetivoId) || !UUID.test(realId) || !/^\d+$/.test(expira)) return null;

  const esperada = firma(`${objetivoId}.${realId}.${expira}`, secreto);
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);

  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expira) * 1000 <= ahora) return null;

  return { objetivoId, realId };
}
