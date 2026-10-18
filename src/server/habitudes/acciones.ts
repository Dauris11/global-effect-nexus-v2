"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { tienePermiso } from "@/lib/rbac";

export type AccionHabitudesResultado = {
  ok: boolean;
  mensaje?: string;
  id?: string;
};

/**
 * Sube o registra un recurso pedagógico (diapositivas, manual, hoja de trabajo).
 */
export async function subirRecursoHabitudesAction(
  datos: FormData,
): Promise<AccionHabitudesResultado> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "habitudes.recursos.subir")) {
    return { ok: false, mensaje: "No tienes permiso para subir recursos a Habitudes." };
  }

  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 160);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 800);
  const categoria = String(datos.get("categoria") ?? "diapositiva");
  const formato = String(datos.get("formato") ?? "pdf").toLowerCase().trim();
  const archivoUrl = String(datos.get("archivo_url") ?? "").trim();
  const archivoNombre = String(datos.get("archivo_nombre") ?? "").trim();
  const tamanoMb = parseFloat(String(datos.get("tamano_mb") ?? "0")) || 1.0;

  if (!titulo) return { ok: false, mensaje: "El título del recurso es obligatorio." };
  if (!archivoNombre) return { ok: false, mensaje: "Debes adjuntar un archivo válido." };

  const urlFinal =
    archivoUrl ||
    `https://storage.globaleffect.org/habitudes/${categoria}/${Date.now()}_${archivoNombre}`;

  try {
    const res = await consultarUna<{ id: string }>(
      `INSERT INTO public.habitudes_recurso (
         titulo, descripcion, categoria, formato, archivo_url, archivo_nombre, tamano_mb, subido_por_id
       ) VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [titulo, descripcion, categoria, formato, urlFinal, archivoNombre, tamanoMb, usuario.id],
    );

    if (!res) return { ok: false, mensaje: "No se pudo registrar el recurso." };

    await registrar({
      usuarioId: usuario.id,
      accion: "habitudes.recurso.creado",
      entidad: "habitudes_recurso",
      entidadId: res.id,
      datos: { titulo, categoria, formato },
    });

    revalidatePath("/habitudes");
    return { ok: true, mensaje: "Recurso compartido exitosamente en el Hub.", id: res.id };
  } catch (err) {
    console.error("[habitudes] Error al registrar recurso:", err);
    return { ok: false, mensaje: "Error de servidor al guardar el recurso." };
  }
}

/**
 * Incrementa el contador de descargas de un recurso didáctico.
 */
export async function incrementarDescargaRecursoAction(
  recursoId: string,
): Promise<{ ok: boolean }> {
  try {
    await consultarUna(
      `UPDATE public.habitudes_recurso
          SET descargas_conteo = descargas_conteo + 1
        WHERE id = $1
       RETURNING id`,
      [recursoId],
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Registra una visita presencial a un liceo con fotografías de evidencia.
 */
export async function registrarVisitaLiceoAction(
  datos: FormData,
): Promise<AccionHabitudesResultado> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "habitudes.evidencias.subir")) {
    return { ok: false, mensaje: "No tienes permiso para registrar visitas a liceos." };
  }

  const liceoId = String(datos.get("liceo_id") ?? "").trim();
  const fechaVisita = String(datos.get("fecha_visita") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const temaImpartido = String(datos.get("tema_impartido") ?? "").trim().slice(0, 180);
  const tanda = String(datos.get("tanda") ?? "matutina");
  const estudiantes = parseInt(String(datos.get("estudiantes_impactados") ?? "0"), 10) || 0;
  const observaciones = String(datos.get("observaciones") ?? "").trim().slice(0, 1200);
  const fotosRaw = String(datos.get("fotos_urls") ?? "").trim();

  if (!liceoId) return { ok: false, mensaje: "Debes seleccionar el centro educativo visitado." };
  if (!temaImpartido) return { ok: false, mensaje: "Indica el tema o módulo de Habitudes impartido." };
  if (estudiantes <= 0) return { ok: false, mensaje: "Indica la cantidad estimada de estudiantes asistentes." };

  const fotosUrls = fotosRaw
    ? fotosRaw.split(",").map((u) => u.trim()).filter(Boolean)
    : [];

  try {
    const res = await consultarUna<{ id: string }>(
      `INSERT INTO public.habitudes_visita_evidencia (
         liceo_id, facilitador_id, fecha_visita, tema_impartido, tanda, estudiantes_impactados, observaciones, fotos_urls, estado
       ) VALUES ($1, $2, $3::date, $4, $5, $6, NULLIF($7, ''), $8, 'completada')
       RETURNING id`,
      [liceoId, usuario.id, fechaVisita, temaImpartido, tanda, estudiantes, observaciones, fotosUrls],
    );

    if (!res) return { ok: false, mensaje: "No se pudo registrar la visita." };

    await registrar({
      usuarioId: usuario.id,
      accion: "habitudes.visita.creada",
      entidad: "habitudes_visita_evidencia",
      entidadId: res.id,
      datos: { liceoId, estudiantes, temaImpartido },
    });

    revalidatePath("/habitudes");
    return {
      ok: true,
      mensaje: "Visita y evidencias registradas exitosamente.",
      id: res.id,
    };
  } catch (err) {
    console.error("[habitudes] Error al registrar visita:", err);
    return { ok: false, mensaje: "Error de servidor al guardar la visita." };
  }
}
