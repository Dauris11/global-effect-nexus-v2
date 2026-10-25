"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirRol } from "@/lib/auth";
import { enTransaccion } from "@/lib/db";
import { aMinutos, DEFINICIONES, validarParametro } from "@/lib/parametros";
import { parametros } from "@/server/parametros/consultas";

/**
 * Guarda los parámetros institucionales. `admin` y `super_admin`: es lo que
 * coordinación necesita ajustar (el horario del comedor, por ejemplo) y no
 * concede acceso a nada.
 *
 * El formulario manda TODOS los campos; solo se escribe lo que cambió respecto
 * al valor vigente, y un valor igual al de fábrica borra la fila en vez de
 * guardarlo: así «restablecer» y «escribir lo mismo» son la misma cosa y la
 * tabla solo guarda excepciones. Cada cambio queda en `audit_log` con el antes y
 * el después.
 */

export type EstadoParametros = {
  estado: "inicial" | "ok" | "sin_cambios" | "invalido" | "error";
  /** Clave del campo que falló y por qué, para pintarlo en su sitio. */
  errores?: Record<string, "hora" | "numero" | "rango" | "correo" | "orden">;
  cambiados?: number;
};

export async function guardarParametros(
  _previo: EstadoParametros,
  datos: FormData,
): Promise<EstadoParametros> {
  const usuario = await requerirRol(["admin", "super_admin"]);

  const vigentes = await parametros();
  const errores: NonNullable<EstadoParametros["errores"]> = {};
  const nuevos: Record<string, string> = {};

  for (const def of DEFINICIONES) {
    const crudo = datos.get(def.clave);

    if (typeof crudo !== "string") continue;

    const validado = validarParametro(def, crudo);

    if (validado.ok) nuevos[def.clave] = validado.valor;
    else errores[def.clave] = validado.error;
  }

  // El comedor tiene que abrir antes de cerrar: se comprueba con los valores que
  // quedarían, no con los de antes.
  const apertura = nuevos["comedor.apertura"] ?? vigentes["comedor.apertura"];
  const cierre = nuevos["comedor.cierre"] ?? vigentes["comedor.cierre"];

  if (aMinutos(apertura) >= aMinutos(cierre) && !errores["comedor.cierre"]) {
    errores["comedor.cierre"] = "orden";
  }

  if (Object.keys(errores).length > 0) return { estado: "invalido", errores };

  const cambios = DEFINICIONES.filter(
    (def) => nuevos[def.clave] !== undefined && nuevos[def.clave] !== vigentes[def.clave],
  );

  if (cambios.length === 0) return { estado: "sin_cambios" };

  try {
    await enTransaccion(async (cliente) => {
      for (const def of cambios) {
        const valor = nuevos[def.clave]!;

        if (valor === String(def.defecto)) {
          await cliente.query("DELETE FROM public.parametro_institucional WHERE clave = $1", [def.clave]);
        } else {
          await cliente.query(
            `INSERT INTO public.parametro_institucional (clave, valor, actualizado_por)
             VALUES ($1, $2, $3)
             ON CONFLICT (clave) DO UPDATE
               SET valor = EXCLUDED.valor, actualizado_por = EXCLUDED.actualizado_por,
                   actualizado_en = now()`,
            [def.clave, valor, usuario.id],
          );
        }
      }
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "parametro.editado",
      entidad: "parametro_institucional",
      datos: {
        cambios: Object.fromEntries(cambios.map((d) => [d.clave, { antes: vigentes[d.clave], despues: nuevos[d.clave] }])),
      },
    });

    // Los parámetros se leen en la portada, el comedor y el asistente.
    revalidatePath("/", "layout");

    return { estado: "ok", cambiados: cambios.length };
  } catch (error) {
    console.error("[parametros] no se pudo guardar", error);

    return { estado: "error" };
  }
}
