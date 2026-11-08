"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { estaEnLaVega } from "@/lib/la-vega-geografia";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { subirMaterial } from "@/lib/supabase/almacen";

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

  if (!usuarioTienePermiso(usuario, "habitudes.recursos.subir")) {
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

  const archivo = datos.get("archivo");
  let urlFinal = archivoUrl;

  if (archivo && archivo instanceof File && archivo.size > 0) {
    const nombreLimpio = archivoNombre.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = `habitudes/${categoria}/${Date.now()}_${nombreLimpio}`;
    const subida = await subirMaterial(ruta, archivo);
    if (subida.ok) {
      urlFinal = subida.ruta;
    }
  }

  if (!urlFinal) {
    urlFinal = `https://storage.globaleffect.org/habitudes/${categoria}/${Date.now()}_${archivoNombre}`;
  }

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

  if (!usuarioTienePermiso(usuario, "habitudes.evidencias.subir")) {
    return { ok: false, mensaje: "No tienes permiso para registrar visitas a liceos." };
  }

  const liceoId = String(datos.get("liceo_id") ?? "").trim();
  const fechaVisita = String(datos.get("fecha_visita") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const temaImpartido = String(datos.get("tema_impartido") ?? "").trim().slice(0, 180);
  const tanda = String(datos.get("tanda") ?? "matutina");
  const estudiantes = parseInt(String(datos.get("estudiantes_impactados") ?? "0"), 10) || 0;
  const observaciones = String(datos.get("observaciones") ?? "").trim().slice(0, 1200);
  const fotosRaw = String(datos.get("fotos_urls") ?? "").trim();
  const latitudRaw = datos.get("latitud");
  const longitudRaw = datos.get("longitud");
  const latitud = latitudRaw ? parseFloat(String(latitudRaw)) : null;
  const longitud = longitudRaw ? parseFloat(String(longitudRaw)) : null;

  if (!liceoId) return { ok: false, mensaje: "Debes seleccionar el centro educativo visitado." };
  if (!temaImpartido) return { ok: false, mensaje: "Indica el tema o módulo de Habitudes impartido." };
  if (estudiantes <= 0) return { ok: false, mensaje: "Indica la cantidad estimada de estudiantes asistentes." };

  const fotosUrls = fotosRaw
    ? fotosRaw.split(",").map((u) => u.trim()).filter(Boolean)
    : [];

  try {
    const res = await consultarUna<{ id: string }>(
      `INSERT INTO public.habitudes_visita_evidencia (
         liceo_id, facilitador_id, fecha_visita, tema_impartido, tanda, estudiantes_impactados, observaciones, fotos_urls, estado, latitud, longitud
       ) VALUES ($1, $2, $3::date, $4, $5, $6, NULLIF($7, ''), $8, 'completada', $9, $10)
       RETURNING id`,
      [liceoId, usuario.id, fechaVisita, temaImpartido, tanda, estudiantes, observaciones, fotosUrls, latitud, longitud],
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

/**
 * Asigna un profesor de Habitudes a un liceo en La Vega con su tanda correspondiente.
 * Exclusivo de Director de Habitudes (DH), Admin o Superadmin.
 */
export async function asignarProfesorLiceoAction({
  liceoId,
  profesorId,
  tanda,
  materiaTaller,
}: {
  liceoId: string;
  profesorId: string;
  tanda: string;
  materiaTaller?: string;
}): Promise<AccionHabitudesResultado> {
  const usuario = await requerirPermiso("habitudes.supervisar");

  try {
    const res = await consultarUna<{ id: string }>(
      `INSERT INTO public.habitudes_liceo_profesor (
         liceo_id, profesor_id, tanda, materia_taller, asignado_por
       ) VALUES ($1, $2, $3, COALESCE($4, 'Liderazgo Habitudes'), $5)
       ON CONFLICT (liceo_id, profesor_id, tanda)
       DO UPDATE SET activo = true,
                     materia_taller = EXCLUDED.materia_taller
       RETURNING id`,
      [liceoId, profesorId, tanda, materiaTaller || null, usuario.id],
    );

    if (!res) return { ok: false, mensaje: "No se pudo asignar el profesor al liceo." };

    await registrar({
      usuarioId: usuario.id,
      accion: "habitudes.liceo.profesor_asignado",
      entidad: "habitudes_liceo_profesor",
      entidadId: res.id,
      datos: { liceoId, profesorId, tanda },
    });

    revalidatePath("/habitudes");
    return { ok: true, mensaje: "Profesor asignado al liceo exitosamente.", id: res.id };
  } catch (err) {
    console.error("[habitudes] Error al asignar profesor:", err);
    return { ok: false, mensaje: "Error al registrar la asignación del docente." };
  }
}

/**
 * Vincula un estudiante de la Fundación a un liceo de Habitudes.
 */
export async function asignarEstudianteLiceoAction({
  liceoId,
  estudianteId,
  grado,
  seccion,
}: {
  liceoId: string;
  estudianteId: string;
  grado?: string;
  seccion?: string;
}): Promise<AccionHabitudesResultado> {
  const usuario = await requerirPermiso("habitudes.supervisar");

  try {
    const res = await consultarUna<{ id: string }>(
      `INSERT INTO public.habitudes_liceo_estudiante (
         liceo_id, estudiante_id, grado, seccion, registrado_por
       ) VALUES ($1, $2, COALESCE($3, '5to Secundaria'), COALESCE($4, 'A'), $5)
       ON CONFLICT (liceo_id, estudiante_id)
       DO UPDATE SET activo = true, grado = EXCLUDED.grado, seccion = EXCLUDED.seccion
       RETURNING id`,
      [liceoId, estudianteId, grado || null, seccion || null, usuario.id],
    );

    if (!res) return { ok: false, mensaje: "No se pudo registrar al estudiante en el liceo." };

    await registrar({
      usuarioId: usuario.id,
      accion: "habitudes.liceo.estudiante_asignado",
      entidad: "habitudes_liceo_estudiante",
      entidadId: res.id,
      datos: { liceoId, estudianteId },
    });

    revalidatePath("/habitudes");
    return { ok: true, mensaje: "Estudiante vinculado al liceo con éxito.", id: res.id };
  } catch (err) {
    console.error("[habitudes] Error al vincular estudiante:", err);
    return { ok: false, mensaje: "Error al registrar vinculación del estudiante." };
  }
}

/**
 * Guarda las coordenadas y dirección de un liceo, verificando la regla estricta de La Vega.
 */
export async function guardarUbicacionLiceoAction({
  liceoId,
  latitud,
  longitud,
  municipio,
  distritoMunicipal,
  sector,
  calle,
}: {
  liceoId: string;
  latitud: number;
  longitud: number;
  municipio: string;
  distritoMunicipal?: string;
  sector?: string;
  calle?: string;
}): Promise<AccionHabitudesResultado> {
  const usuario = await requerirPermiso("habitudes.supervisar");

  // Regla estricta: debe estar dentro de la provincia de La Vega
  if (!estaEnLaVega(latitud, longitud)) {
    return {
      ok: false,
      mensaje: "Error: La ubicación debe estar estrictamente dentro de la provincia de La Vega.",
    };
  }

  try {
    await consultarUna(
      `UPDATE public.habitudes_liceo
          SET latitud = $1,
              longitud = $2,
              municipio = $3,
              distrito_municipal = $4,
              sector = $5,
              calle = $6
        WHERE id = $7
       RETURNING id`,
      [
        latitud,
        longitud,
        municipio,
        distritoMunicipal || null,
        sector || null,
        calle || null,
        liceoId,
      ],
    );

    await registrar({
      usuarioId: usuario.id,
      accion: "habitudes.liceo.geolocalizado",
      entidad: "habitudes_liceo",
      entidadId: liceoId,
      datos: { latitud, longitud, municipio },
    });

    revalidatePath("/habitudes");
    return { ok: true, mensaje: "Ubicación del liceo guardada correctamente en La Vega." };
  } catch (err) {
    console.error("[habitudes] Error al guardar geolocalización de liceo:", err);
    return { ok: false, mensaje: "Error al actualizar coordenadas del liceo." };
  }
}

/**
 * Guarda la ubicación de vivienda de un estudiante en su expediente,
 * validando que caiga estrictamente dentro de la provincia de La Vega.
 */
export async function guardarUbicacionViviendaEstudianteAction({
  estudianteId,
  latitud,
  longitud,
  municipio,
  distritoMunicipal,
  sector,
  calle,
  numeroCasa,
  referenciaUbicacion,
}: {
  estudianteId: string;
  latitud: number;
  longitud: number;
  municipio: string;
  distritoMunicipal?: string;
  sector?: string;
  calle?: string;
  numeroCasa?: string;
  referenciaUbicacion?: string;
}): Promise<AccionHabitudesResultado> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) {
    return { ok: false, mensaje: "No tienes permiso para actualizar expedientes de estudiantes." };
  }

  // Regla estricta: debe pertenecer a la provincia de La Vega
  if (!estaEnLaVega(latitud, longitud)) {
    return {
      ok: false,
      mensaje: "La vivienda del estudiante debe ubicarse estrictamente en la provincia de La Vega.",
    };
  }

  try {
    await consultarUna(
      `INSERT INTO public.perfil_vivienda (
         estudiante_id, municipio, distrito_municipal, sector, calle, numero_casa, referencia_ubicacion, latitud, longitud, ciudad_residencia
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'La Vega')
       ON CONFLICT (estudiante_id)
       DO UPDATE SET municipio = EXCLUDED.municipio,
                     distrito_municipal = EXCLUDED.distrito_municipal,
                     sector = EXCLUDED.sector,
                     calle = EXCLUDED.calle,
                     numero_casa = EXCLUDED.numero_casa,
                     referencia_ubicacion = EXCLUDED.referencia_ubicacion,
                     latitud = EXCLUDED.latitud,
                     longitud = EXCLUDED.longitud,
                     ciudad_residencia = 'La Vega'
       RETURNING estudiante_id`,
      [
        estudianteId,
        municipio,
        distritoMunicipal || null,
        sector || null,
        calle || null,
        numeroCasa || null,
        referenciaUbicacion || null,
        latitud,
        longitud,
      ],
    );

    await registrar({
      usuarioId: usuario.id,
      accion: "expediente.vivienda.geolocalizada",
      entidad: "perfil_vivienda",
      entidadId: estudianteId,
      datos: { latitud, longitud, municipio, sector },
    });

    revalidatePath(`/expedientes/${estudianteId}`);
    return { ok: true, mensaje: "Ubicación de vivienda guardada exitosamente en el expediente." };
  } catch (err) {
    console.error("[expedientes] Error al guardar vivienda:", err);
    return { ok: false, mensaje: "Error de servidor al guardar la ubicación de vivienda." };
  }
}
