"use server";

import { revalidatePath } from "next/cache";

import { requerirPermiso } from "@/lib/auth";
import { consultar } from "@/lib/db";

/** La cocina marca (o desmarca) que ya sirvió a una persona de la lista. Exige `operaciones.escribir`. */
export async function marcarServido(id: string, servido: boolean): Promise<{ ok: boolean }> {
  await requerirPermiso("operaciones.escribir");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { ok: false };

  await consultar(`UPDATE public.inscripcion_comida SET servido = $2 WHERE id = $1`, [id, servido]);
  revalidatePath("/[locale]/inscripcion-comida", "page");

  return { ok: true };
}
