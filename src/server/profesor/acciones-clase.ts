"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import type { MarcaDeAsistencia, OrigenClase } from "@/lib/clases";
import { enTransaccion, consultarUna } from "@/lib/db";
import { SQL_HOY_RD } from "@/lib/fecha-rd";
import { usuarioTienePermiso } from "@/lib/rbac";
import { MAXIMO_MATERIAL, subirMaterial, TIPOS_MATERIAL } from "@/lib/supabase/almacen";

/**
 * Acciones de la pantalla de clase del docente que no existían como un solo
 * paso: pasar asistencia (con la sesión de hoy incluida) y subir material con
 * archivo.
 *
 * La frontera es la de siempre: `academico.escribir` sobre cualquier clase, o
 * `docencia.impartir` y SOLO las suyas, comprobado dentro de la propia
 * escritura (el id de una clase ajena no encuentra fila).
 */

export type EstadoClase =
  | "ok"
  | "no_permitido"
  | "no_encontrado"
  | "invalido"
  | "fuera_de_periodo"
  | "archivo_no_admitido"
  | "archivo_grande"
  | "error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function permisoDeDocencia() {
  const usuario = await requerirUsuario();
  const administra = usuarioTienePermiso(usuario, "academico.escribir");

  if (!administra && !usuarioTienePermiso(usuario, "docencia.impartir")) return null;

  return { usuario, docenteId: administra ? null : usuario.id };
}

/**
 * Pasa la asistencia de HOY de una clase: crea la sesión del día si no existe y
 * guarda la marca de cada estudiante, todo en una transacción. Presente, ausente
 * o tarde (tarde = presente con `tarde`, migración 0135). Repetirla corrige.
 */
export async function guardarAsistenciaDelDia(datos: {
  origen: OrigenClase;
  claseId: string;
  periodoId: string;
  marcas: { inscripcionId: string; marca: MarcaDeAsistencia }[];
}): Promise<{ estado: EstadoClase }> {
  const permiso = await permisoDeDocencia();
  if (!permiso) return { estado: "no_permitido" };

  const { origen, claseId, periodoId, marcas } = datos;
  const validas = ["presente", "ausente", "tarde"];

  if (
    !UUID.test(claseId) ||
    !UUID.test(periodoId) ||
    marcas.length === 0 ||
    !marcas.every((m) => UUID.test(m.inscripcionId) && validas.includes(m.marca))
  ) {
    return { estado: "invalido" };
  }

  const g = origen === "g360";
  const tabla = {
    sesion: g ? "sesion_360" : "sesion_materia",
    asistencia: g ? "asistencia_360" : "asistencia_materia",
    inscripcion: g ? "inscripcion_360" : "inscripcion",
    columna: g ? "materia_360_id" : "materia_id",
  };

  try {
    const resultado = await enTransaccion(async (cliente) => {
      // La clase es suya (o es coordinación) y hoy cae dentro del período.
      const clase = await cliente.query<{ dentro: boolean }>(
        g
          ? `SELECT (${SQL_HOY_RD} BETWEEN p.fecha_inicio AND p.fecha_fin) AS dentro
               FROM materia_360 m, periodo p
              WHERE m.id = $1 AND p.id = $2 AND ($3::uuid IS NULL OR m.docente_id = $3)`
          : `SELECT (${SQL_HOY_RD} BETWEEN p.fecha_inicio AND p.fecha_fin) AS dentro
               FROM materia m, periodo p
              WHERE m.id = $1 AND p.id = $2 AND ($3::uuid IS NULL OR m.profesor_usuario_id = $3)`,
        [claseId, periodoId, permiso.docenteId],
      );

      if (clase.rowCount === 0) return "no_encontrado" as const;
      if (!clase.rows[0].dentro) return "fuera_de_periodo" as const;

      const sesion = await cliente.query<{ id: string }>(
        `INSERT INTO ${tabla.sesion} (${tabla.columna}, periodo_id, fecha, creado_por)
         VALUES ($1, $2, ${SQL_HOY_RD}, $3)
         ON CONFLICT (${tabla.columna}, periodo_id, fecha) DO UPDATE SET fecha = EXCLUDED.fecha
         RETURNING id`,
        [claseId, periodoId, permiso.usuario.id],
      );

      const marcadas = await cliente.query(
        `INSERT INTO ${tabla.asistencia} (sesion_id, inscripcion_id, presente, tarde, marcado_por, marcado_en)
         SELECT $1, x.id, x.presente, x.tarde, $5, now()
           FROM unnest($2::uuid[], $3::boolean[], $4::boolean[]) AS x(id, presente, tarde)
           JOIN ${tabla.inscripcion} i
             ON i.id = x.id AND i.materia_id = $6 AND i.periodo_id = $7 AND i.estado <> 'retirada'
         ON CONFLICT (sesion_id, inscripcion_id)
         DO UPDATE SET presente = EXCLUDED.presente, tarde = EXCLUDED.tarde,
                       marcado_por = EXCLUDED.marcado_por, marcado_en = now()`,
        [
          sesion.rows[0].id,
          marcas.map((m) => m.inscripcionId),
          marcas.map((m) => m.marca !== "ausente"),
          marcas.map((m) => m.marca === "tarde"),
          permiso.usuario.id,
          claseId,
          periodoId,
        ],
      );

      return { sesionId: sesion.rows[0].id, marcadas: marcadas.rowCount ?? 0 };
    });

    if (typeof resultado === "string") return { estado: resultado };

    await registrar({
      usuarioId: permiso.usuario.id,
      accion: g ? "asistencia_360.marcada" : "asistencia_materia.marcada",
      entidad: tabla.sesion,
      entidadId: resultado.sesionId,
      datos: { marcadas: resultado.marcadas },
    });
  } catch (error) {
    console.error("[docencia] no se pudo guardar la asistencia del día", error);

    return { estado: "error" };
  }

  revalidatePath("/[locale]/portal/profesor/clases", "layout");
  revalidatePath("/[locale]/portal/estudiante/clases", "layout");

  return { estado: "ok" };
}

const EXTENSION_POR_TIPO: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * Publica un material (con archivo del bucket privado) o un anuncio en una
 * clase. El archivo se sube AQUÍ y la ruta la compone el servidor con ids: el
 * navegador nunca dicta una ruta del bucket (con una ajena, el enlace firmado
 * del estudiante abriría el trabajo de otra persona).
 *
 * El tipo del archivo se comprueba contra una lista cerrada y el tamaño contra
 * `MAXIMO_MATERIAL`, sobre el archivo real y no sobre lo que declare el cliente.
 */
export async function publicarMaterialDeClase(datos: FormData): Promise<{ estado: EstadoClase }> {
  const permiso = await permisoDeDocencia();
  if (!permiso) return { estado: "no_permitido" };

  const origen = String(datos.get("origen") ?? "") === "g360" ? "g360" : "universidad";
  const claseId = String(datos.get("clase") ?? "");
  const periodoId = String(datos.get("periodo") ?? "");
  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 160);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 900);
  const tipo = String(datos.get("tipo") ?? "material") === "anuncio" ? "anuncio" : "material";
  const archivo = datos.get("archivo");
  const hayArchivo = archivo instanceof File && archivo.size > 0;

  if (!UUID.test(claseId) || !titulo) return { estado: "invalido" };
  if (origen === "g360" && !UUID.test(periodoId)) return { estado: "invalido" };

  let ruta: string | null = null;

  if (hayArchivo) {
    if (!(TIPOS_MATERIAL as readonly string[]).includes(archivo.type)) {
      return { estado: "archivo_no_admitido" };
    }
    if (archivo.size > MAXIMO_MATERIAL) return { estado: "archivo_grande" };
    ruta = `materiales-clase/${origen}/${claseId}/${randomUUID()}.${EXTENSION_POR_TIPO[archivo.type]}`;
  }

  try {
    // La clase tiene que ser suya ANTES de subir nada al bucket.
    const suya = await consultarUna<{ id: string }>(
      origen === "g360"
        ? `SELECT m.id FROM materia_360 m
            WHERE m.id = $1 AND ($2::uuid IS NULL OR m.docente_id = $2)
              AND EXISTS (SELECT 1 FROM inscripcion_360 i
                           WHERE i.materia_id = m.id AND i.periodo_id = $3 AND i.estado <> 'retirada')`
        : `SELECT m.id FROM materia m
            WHERE m.id = $1 AND ($2::uuid IS NULL OR m.profesor_usuario_id = $2)`,
      origen === "g360" ? [claseId, permiso.docenteId, periodoId] : [claseId, permiso.docenteId],
    );

    if (!suya) return { estado: "no_encontrado" };

    if (ruta && hayArchivo) {
      const subida = await subirMaterial(ruta, archivo);

      if (!subida.ok) return { estado: "error" };
    }

    const creada = await consultarUna<{ id: string }>(
      origen === "g360"
        ? `INSERT INTO asignacion (titulo, descripcion, tipo, materia_360_id, creada_por_id, periodo_id, archivo_url)
           VALUES ($1, NULLIF($2, ''), $3::tipo_asignacion, $4, $5, $6, $7) RETURNING id`
        : `INSERT INTO asignacion (titulo, descripcion, tipo, materia_id, creada_por_id, periodo_id, archivo_url)
           SELECT $1, NULLIF($2, ''), $3::tipo_asignacion, m.id, $5, m.periodo_id, $6
             FROM materia m WHERE m.id = $4 RETURNING id`,
      origen === "g360"
        ? [titulo, descripcion, tipo, claseId, permiso.usuario.id, periodoId, ruta]
        : [titulo, descripcion, tipo, claseId, permiso.usuario.id, ruta],
    );

    await registrar({
      usuarioId: permiso.usuario.id,
      accion: "material.publicado",
      entidad: "asignacion",
      entidadId: creada?.id,
      datos: { titulo, tipo, origen, clase: claseId },
    });
  } catch (error) {
    console.error("[docencia] no se pudo publicar el material", error);

    return { estado: "error" };
  }

  revalidatePath("/[locale]/portal/profesor/clases", "layout");
  revalidatePath("/[locale]/portal/estudiante/clases", "layout");
  revalidatePath("/[locale]/portal/estudiante/tareas", "page");

  return { estado: "ok" };
}
