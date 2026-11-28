import { consultarUna } from "@/lib/db";

/**
 * Por qué una persona ya autenticada no puede entrar al portal.
 *
 * Solo se llama DESPUÉS de autenticar bien (contraseña o Google correctos): antes
 * decir «no registrada» o «desactivada» le contaría a un desconocido qué correos
 * existen. `inactive` = hay fila pero `activo = false`; `notRegistered` = no hay fila
 * (o su rol no se reconoce).
 */
export async function motivoSinAcceso(authUserId: string): Promise<"notRegistered" | "inactive"> {
  const fila = await consultarUna<{ activo: boolean }>(
    "SELECT activo FROM usuario WHERE auth_user_id = $1",
    [authUserId],
  ).catch(() => null);

  return fila && !fila.activo ? "inactive" : "notRegistered";
}
