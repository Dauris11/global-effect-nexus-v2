"use server";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import {
  DEFINICIONES_TECNICAS,
  parametroTecnico,
  type ClaveParametroTecnico,
} from "@/server/parametros/tecnicos";

export type ResultadoParametroTecnico = { ok: true; cambiado: boolean } | { ok: false; error: "invalido" };

/**
 * Guarda un parámetro técnico. Solo `tecnico.parametros` (developer). Un valor igual al de fábrica borra la
 * fila, como en los institucionales: la tabla solo guarda excepciones. Queda en `audit_log` con antes y después.
 */
export async function guardarParametroTecnico(
  clave: ClaveParametroTecnico,
  valor: string,
): Promise<ResultadoParametroTecnico> {
  const usuario = await requerirPermiso("tecnico.parametros");
  const def = DEFINICIONES_TECNICAS.find((d) => d.clave === clave);

  if (!def || (def.tipo === "booleano" && valor !== "true" && valor !== "false")) {
    return { ok: false, error: "invalido" };
  }

  const antes = await parametroTecnico(clave);

  if (antes === valor) return { ok: true, cambiado: false };

  if (valor === def.defecto) {
    await consultarUna(`DELETE FROM public.parametro_institucional WHERE clave = $1 RETURNING clave`, [clave]);
  } else {
    await consultarUna(
      `INSERT INTO public.parametro_institucional (clave, valor, actualizado_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (clave) DO UPDATE
         SET valor = EXCLUDED.valor, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()
       RETURNING clave`,
      [clave, valor, usuario.realId],
    );
  }

  await registrar({
    usuarioId: usuario.realId,
    accion: "parametro_tecnico.editado",
    entidad: "parametro_institucional",
    datos: { clave, antes, despues: valor },
  });

  return { ok: true, cambiado: true };
}
