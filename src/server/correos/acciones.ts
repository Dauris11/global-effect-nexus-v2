"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso } from "@/lib/auth";
import { consultar, consultarUna } from "@/lib/db";

import { continuarCarta, reenviarCarta } from "./procesar";

/**
 * Decisiones de administración sobre las cartas retenidas.
 *
 * Una sola puerta: `patrocinadores.escribir`. Aprobar es la única forma de que
 * una carta con motivos de revisión llegue a un patrocinador, y queda anotado
 * quién lo hizo.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFRESCAR = "/[locale]/patrocinadores/correos";

function idDe(datos: FormData, campo = "carta"): string | null {
  const id = String(datos.get(campo) ?? "");

  return UUID.test(id) ? id : null;
}

export async function aprobarCarta(datos: FormData): Promise<void> {
  const usuario = await requerirPermiso("patrocinadores.escribir");
  const id = idDe(datos);

  if (!id) return;

  const hecho = await reenviarCarta(id, usuario.id);

  await registrar({
    usuarioId: usuario.id,
    accion: hecho ? "correo.aprobado" : "correo.aprobacion_fallida",
    entidad: "correo_patrocinador",
    entidadId: id,
  });

  revalidatePath(REFRESCAR, "page");
  revalidatePath("/[locale]/servicios-mensuales", "page");
}

export async function rechazarCarta(datos: FormData): Promise<void> {
  const usuario = await requerirPermiso("patrocinadores.escribir");
  const id = idDe(datos);

  if (!id) return;

  const fila = await consultarUna<{ id: string }>(
    `UPDATE correo_patrocinador
        SET estado = 'rechazado', revisado_por = $2, revisado_en = now()
      WHERE id = $1 AND estado IN ('sin_identificar', 'sin_patrocinador', 'retenido')
      RETURNING id`,
    [id, usuario.id],
  );

  if (fila) {
    await registrar({
      usuarioId: usuario.id,
      accion: "correo.rechazado",
      entidad: "correo_patrocinador",
      entidadId: id,
    });
  }

  revalidatePath(REFRESCAR, "page");
  revalidatePath("/[locale]/servicios-mensuales", "page");
}

/** Asigna una carta de remitente desconocido a un estudiante y la vuelve a procesar. */
export async function vincularCarta(datos: FormData): Promise<void> {
  const usuario = await requerirPermiso("patrocinadores.escribir");
  const id = idDe(datos);
  const estudianteId = idDe(datos, "estudiante");

  if (!id || !estudianteId) return;

  const fila = await consultarUna<{ id: string }>(
    `UPDATE correo_patrocinador c
        SET estudiante_id = e.id,
            -- Se vincula a mano: el remitente no se puede verificar, así que no
            -- se envía sola aunque el reenvío automático esté activo.
            autenticacion = 'desconocida'
       FROM estudiante e
      WHERE c.id = $1 AND e.id = $2 AND e.estado = 'activo'
        AND c.estado = 'sin_identificar'
      RETURNING c.id`,
    [id, estudianteId],
  );

  if (fila) {
    await registrar({
      usuarioId: usuario.id,
      accion: "correo.vinculado",
      entidad: "correo_patrocinador",
      entidadId: id,
      datos: { estudianteId },
    });
    await continuarCarta(id);
  }

  revalidatePath(REFRESCAR, "page");
}

/** Vuelve a revisar una carta retenida (por ejemplo, por falta de clave de IA o de patrocinador). */
export async function reprocesarCarta(datos: FormData): Promise<void> {
  const usuario = await requerirPermiso("patrocinadores.escribir");
  const id = idDe(datos);

  if (!id) return;

  await consultar(
    `UPDATE correo_patrocinador SET traduccion = NULL, veredicto = NULL
      WHERE id = $1 AND estado IN ('sin_patrocinador', 'retenido')`,
    [id],
  );
  await continuarCarta(id);
  await registrar({
    usuarioId: usuario.id,
    accion: "correo.reprocesado",
    entidad: "correo_patrocinador",
    entidadId: id,
  });

  revalidatePath(REFRESCAR, "page");
}
