"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import {
  enlaceValido,
  esEstadoAcademia,
  esTipoAcademia,
  esTipoMaterialAcademia,
} from "@/lib/academias";
import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import {
  borrarDocumento,
  enlaceDeDocumento,
  MAXIMO_MATERIAL,
  subirMaterial,
  TIPOS_MATERIAL,
} from "@/lib/supabase/almacen";

/**
 * Alta, edición y baja de programas de academia y de sus materiales.
 *
 * Una sola puerta para las dos cosas: `academico.escribir`, que es la que ya
 * filtra estas entradas en el menú. `docente` tiene `academico.leer` y no
 * `academico.escribir`: entra al catálogo, se descarga los materiales y no
 * cambia el programa de nadie.
 *
 * LO DELICADO ESTÁ EN EL MATERIAL, y son dos cosas:
 *
 *   1. **El archivo se sube ANTES de escribir en la base, y la base se escribe
 *      en una transacción.** Son dos filas —`documento` y `material`— y una
 *      sola cosa. Si la subida falla no se toca la base; si la base falla, el
 *      archivo queda huérfano en el bucket y eso se dice en el `catch` en vez
 *      de fingir que no pasó: es basura recuperable, no un dato perdido.
 *
 *   2. **El enlace se valida.** `enlace_url` acaba en un `href`, y sin
 *      comprobarlo un `javascript:` ahí es un XSS almacenado servido a todo el
 *      equipo. La comprobación es la misma que usa la landing con `cta_enlace`
 *      y vive en `src/lib/academias.ts` para no tener dos.
 */

export type EstadoAcademias = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "nombre_vacio"
    | "fechas_incoherentes"
    | "participantes_invalido"
    | "sin_contenido"
    | "enlace_invalido"
    | "archivo_invalido"
    | "archivo_grande"
    | "tiene_materiales"
    | "error";
  /** Cuántos materiales se llevaría por delante el borrado del programa. */
  materiales?: number;
};

/* ────────────────────────────── PROGRAMAS ────────────────────────────── */

/** Alta y edición de un programa. Con `id` vacío, es un alta. */
export async function guardarAcademia(
  _previo: EstadoAcademias,
  datos: FormData,
): Promise<EstadoAcademias> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const nombre = texto(datos.get("nombre"), 160);
  const tipo = String(datos.get("tipo") ?? "liderazgo");
  const estado = String(datos.get("estado") ?? "activa");
  const descripcion = texto(datos.get("descripcion"), 900);
  const facilitador = texto(datos.get("facilitador"), 160);
  const inicio = texto(datos.get("fecha_inicio"), 10);
  const fin = texto(datos.get("fecha_fin"), 10);
  const participantesTexto = texto(datos.get("participantes"), 6);

  if (!nombre) return { estado: "nombre_vacio" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };

  if ((inicio && !esFechaIso(inicio)) || (fin && !esFechaIso(fin))) {
    return { estado: "fechas_incoherentes" };
  }

  // Un programa que acaba antes de empezar es la incoherencia que la pantalla
  // de períodos ya señala en el catálogo académico, y aquí se rechaza de
  // entrada: la tabla no tiene CHECK que lo impida.
  if (inicio && fin && fin < inicio) return { estado: "fechas_incoherentes" };

  const participantes =
    participantesTexto === "" ? 0 : Number(participantesTexto);

  // El CHECK de la 0007 exige `participantes >= 0`. Se comprueba antes para
  // poder decir qué campo está mal en vez de devolver un error de base.
  if (!Number.isInteger(participantes) || participantes < 0) {
    return { estado: "participantes_invalido" };
  }

  const tipoOk = esTipoAcademia(tipo) ? tipo : "liderazgo";
  const estadoOk = esEstadoAcademia(estado) ? estado : "activa";

  try {
    const guardado = id
      ? await consultarUna<{ id: string }>(
          `UPDATE academia
              SET nombre = $2, tipo = $3, descripcion = NULLIF($4, ''),
                  facilitador = NULLIF($5, ''), estado = $6,
                  participantes = $7,
                  fecha_inicio = NULLIF($8, '')::date,
                  fecha_fin = NULLIF($9, '')::date
            WHERE id = $1
          RETURNING id`,
          [
            id,
            nombre,
            tipoOk,
            descripcion,
            facilitador,
            estadoOk,
            participantes,
            inicio,
            fin,
          ],
        )
      : await consultarUna<{ id: string }>(
          `INSERT INTO academia
                  (nombre, tipo, descripcion, facilitador, estado,
                   participantes, fecha_inicio, fecha_fin)
           VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, $6,
                   NULLIF($7, '')::date, NULLIF($8, '')::date)
           RETURNING id`,
          [
            nombre,
            tipoOk,
            descripcion,
            facilitador,
            estadoOk,
            participantes,
            inicio,
            fin,
          ],
        );

    if (!guardado) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "academia.editada" : "academia.creada",
      entidad: "academia",
      entidadId: guardado.id,
      datos: { nombre, tipo: tipoOk, estado: estadoOk },
    });
  } catch (error) {
    console.error("[academias] no se pudo guardar el programa", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Borra un programa, pero solo si no tiene materiales.
 *
 * `material.academia_id` es **ON DELETE CASCADE** (0007): borrar el programa se
 * llevaría en silencio todas sus guías, presentaciones y enlaces. Así que aquí
 * se cuenta primero y, si hay algo, se responde `tiene_materiales` con el
 * número —que es lo que la pantalla enseña— en vez de preguntar «¿seguro?» sin
 * decir qué se pierde.
 *
 * Los archivos del bucket no se borran en cascada, claro. Otra razón para
 * obligar a vaciar el programa antes: cada material se borra por su pantalla,
 * que sí se lleva su archivo.
 */
export async function eliminarAcademia(
  _previo: EstadoAcademias,
  datos: FormData,
): Promise<EstadoAcademias> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();

  if (!esUuid(id)) return { estado: "no_encontrado" };

  try {
    const cuantos = await consultarUna<{ total: number }>(
      `SELECT count(*)::int AS total FROM material WHERE academia_id = $1`,
      [id],
    );

    if ((cuantos?.total ?? 0) > 0) {
      return { estado: "tiene_materiales", materiales: cuantos!.total };
    }

    const borrado = await consultarUna<{ id: string; nombre: string }>(
      `DELETE FROM academia WHERE id = $1 RETURNING id, nombre`,
      [id],
    );

    if (!borrado) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "academia.eliminada",
      entidad: "academia",
      entidadId: borrado.id,
      datos: { nombre: borrado.nombre },
    });
  } catch (error) {
    console.error("[academias] no se pudo borrar el programa", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/* ────────────────────────────── MATERIALES ───────────────────────────── */

/**
 * Alta y edición de un material.
 *
 * Un material tiene que llevar ALGO: un archivo o un enlace. Uno sin ninguna de
 * las dos cosas es una fila que ocupa sitio en el repositorio y no se puede
 * abrir, así que se rechaza al crear. Al editar no se exige de nuevo: el que ya
 * tiene archivo sigue teniéndolo aunque el formulario venga sin uno nuevo.
 */
export async function guardarMaterial(
  _previo: EstadoAcademias,
  datos: FormData,
): Promise<EstadoAcademias> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const academiaId = String(datos.get("academia_id") ?? "").trim();
  const titulo = texto(datos.get("titulo"), 200);
  const descripcion = texto(datos.get("descripcion"), 900);
  const tipo = String(datos.get("tipo") ?? "documento");
  const autor = texto(datos.get("autor"), 160);
  const enlace = texto(datos.get("enlace_url"), 500);
  const archivo = datos.get("archivo");

  if (!titulo) return { estado: "nombre_vacio" };
  if (!esUuid(academiaId)) return { estado: "no_encontrado" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };
  if (enlace && !enlaceValido(enlace)) return { estado: "enlace_invalido" };

  const tipoOk = esTipoMaterialAcademia(tipo) ? tipo : "documento";
  const subeArchivo = archivo instanceof File && archivo.size > 0;

  if (subeArchivo) {
    const file = archivo as File;

    // El tipo se comprueba en el servidor y no solo con el `accept` del input:
    // el `accept` es una sugerencia del navegador que se salta con una petición
    // a mano.
    if (!(TIPOS_MATERIAL as readonly string[]).includes(file.type)) {
      return { estado: "archivo_invalido" };
    }

    if (file.size > MAXIMO_MATERIAL) return { estado: "archivo_grande" };
  }

  if (!id && !subeArchivo && !enlace) return { estado: "sin_contenido" };

  // La ruta se compone con ids y NUNCA con el nombre del archivo que subieron:
  // ese nombre lo elige quien sube y acabaría formando parte de una URL.
  let subida: { ok: true; ruta: string } | { ok: false } | null = null;
  let nombreArchivo: string | null = null;
  let mime: string | null = null;
  let tamano: number | null = null;

  if (subeArchivo) {
    const file = archivo as File;

    nombreArchivo = file.name.slice(0, 200);
    mime = file.type;
    tamano = file.size;

    subida = await subirMaterial(
      `academias/${academiaId}/${randomUUID()}.${extensionDe(file.type)}`,
      file,
    );

    if (!subida.ok) return { estado: "error" };
  }

  const rutaSubida = subida?.ok ? subida.ruta : null;

  try {
    const guardado = await enTransaccion(async (cliente) => {
      let documentoId: string | null = null;

      if (rutaSubida) {
        const doc = await cliente.query<{ id: string }>(
          `INSERT INTO documento
                  (nombre, storage_key, tipo, mime, tamano_bytes, subido_por_id)
           VALUES ($1, $2, 'material_educativo', $3, $4, $5)
           RETURNING id`,
          [nombreArchivo, rutaSubida, mime, tamano, usuario.id],
        );

        documentoId = doc.rows[0]?.id ?? null;
      }

      if (id) {
        // `coalesce($6, documento_id)`: sin archivo nuevo se conserva el que ya
        // tenía. Un UPDATE que pusiera NULL dejaría el material apuntando a la
        // nada y el archivo suelto en el bucket.
        const fila = await cliente.query<{ id: string }>(
          `UPDATE material
              SET titulo = $2, descripcion = NULLIF($3, ''), academia_id = $4::uuid,
                  tipo = $5, documento_id = coalesce($6::uuid, documento_id),
                  enlace_url = NULLIF($7, ''), autor = NULLIF($8, '')
            WHERE id = $1
          RETURNING id`,
          [
            id,
            titulo,
            descripcion,
            academiaId,
            tipoOk,
            documentoId,
            enlace,
            autor,
          ],
        );

        return fila.rows[0]?.id ?? null;
      }

      const fila = await cliente.query<{ id: string }>(
        `INSERT INTO material
                (titulo, descripcion, academia_id, tipo, documento_id, enlace_url, autor)
         VALUES ($1, NULLIF($2, ''), $3::uuid, $4, $5::uuid, NULLIF($6, ''), NULLIF($7, ''))
         RETURNING id`,
        [titulo, descripcion, academiaId, tipoOk, documentoId, enlace, autor],
      );

      return fila.rows[0]?.id ?? null;
    });

    if (!guardado) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "material.editado" : "material.creado",
      entidad: "material",
      entidadId: guardado,
      datos: { titulo, tipo: tipoOk, conArchivo: Boolean(rutaSubida) },
    });
  } catch (error) {
    // El archivo ya está subido y la base no se escribió: queda huérfano en el
    // bucket. Se anota con su ruta para poder limpiarlo, y no se intenta
    // borrarlo aquí: si la transacción falló por un fallo de red, el borrado
    // fallaría igual y taparía este mensaje con otro.
    console.error(
      "[academias] no se pudo guardar el material",
      rutaSubida ? `(archivo huérfano en documentos/${rutaSubida})` : "",
      error,
    );
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Borra un material y, con él, su archivo.
 *
 * El orden es base primero y bucket después. Al revés —archivo y luego fila—
 * un fallo intermedio dejaría en el repositorio un material que se puede
 * pulsar y no se puede descargar, que es peor que un archivo de sobra en el
 * bucket.
 *
 * La fila de `documento` se borra también: nada más la referencia, y dejarla
 * sería dejar el índice de un archivo que ya no existe.
 */
export async function eliminarMaterial(
  _previo: EstadoAcademias,
  datos: FormData,
): Promise<EstadoAcademias> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();

  if (!esUuid(id)) return { estado: "no_encontrado" };

  let ruta: string | null = null;

  try {
    const borrado = await enTransaccion(async (cliente) => {
      // Se lee antes de borrar porque hace falta la clave del archivo, que
      // vive en la otra tabla. `FOR UPDATE OF m` bloquea la fila del material
      // —no la del documento— para que dos borrados simultáneos no acaben
      // firmando los dos que ellos fueron quien lo borró.
      const previo = await cliente.query<{
        id: string;
        titulo: string;
        documento_id: string | null;
        storage_key: string | null;
      }>(
        `SELECT m.id, m.titulo, m.documento_id, d.storage_key
           FROM material m
           LEFT JOIN documento d ON d.id = m.documento_id
          WHERE m.id = $1
            FOR UPDATE OF m`,
        [id],
      );

      const material = previo.rows[0];

      if (!material) return null;

      await cliente.query(`DELETE FROM material WHERE id = $1`, [material.id]);

      // Después del material y no antes: `material.documento_id` es
      // ON DELETE SET NULL, así que borrar el documento primero dejaría el
      // material apuntando a la nada si la transacción se quedara a medias.
      if (material.documento_id) {
        await cliente.query(`DELETE FROM documento WHERE id = $1`, [
          material.documento_id,
        ]);
      }

      return material;
    });

    if (!borrado) return { estado: "no_encontrado" };

    ruta = borrado.storage_key;

    await registrar({
      usuarioId: usuario.id,
      accion: "material.eliminado",
      entidad: "material",
      entidadId: borrado.id,
      datos: { titulo: borrado.titulo },
    });
  } catch (error) {
    console.error("[academias] no se pudo borrar el material", error);
    return { estado: "error" };
  }

  // Fuera de la transacción a propósito: borrar en Storage no se puede
  // deshacer con un ROLLBACK, así que se hace cuando la base ya está
  // confirmada. `borrarDocumento` no lanza.
  await borrarDocumento(ruta);

  refrescar();

  return { estado: "ok" };
}

/**
 * Descarga de un material: firma el enlace y manda al navegador allí.
 *
 * NO se firman los enlaces al pintar la lista. Parece lo natural —traer cada
 * fila con su URL lista— y sale carísimo: son 300 materiales como máximo y una
 * petición a Storage por cada uno, en cada visita, para firmar enlaces que
 * nadie va a pulsar. Aquí se firma **uno, al pulsarlo**.
 *
 * Y hay una segunda razón, mejor: el permiso se comprueba en el momento de la
 * descarga. Un enlace firmado al pintar sigue sirviendo diez minutos después
 * aunque a esa cuenta se le haya retirado el acceso entre medias.
 *
 * `redirect()` lanza por diseño en Next, así que va FUERA del `try`: dentro, el
 * `catch` se comería la redirección y la descarga no pasaría nunca.
 */
export async function descargarMaterial(datos: FormData): Promise<void> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.leer")) return;

  const id = String(datos.get("id") ?? "").trim();

  if (!esUuid(id)) return;

  const fila = await consultarUna<{ storage_key: string | null }>(
    `SELECT d.storage_key
       FROM material m
       JOIN documento d ON d.id = m.documento_id
      WHERE m.id = $1`,
    [id],
  );

  const enlace = await enlaceDeDocumento(fila?.storage_key ?? null);

  // Sin enlace no se redirige a ninguna parte: la pantalla se queda como
  // estaba, que es mejor que llevar a un 404 de Storage.
  if (!enlace) return;

  redirect(enlace);
}

/** Las dos pantallas del módulo comparten datos: se refrescan las dos. */
function refrescar(): void {
  revalidatePath("/[locale]/academias/programas", "page");
  revalidatePath("/[locale]/academias/materiales", "page");
}

/** Texto del formulario, recortado y sin espacios de sobra. */
function texto(valor: FormDataEntryValue | null, largo: number): string {
  return String(valor ?? "")
    .trim()
    .slice(0, largo);
}

/** Extensión por tipo MIME, para que la clave del bucket la lleve. */
function extensionDe(mime: string): string {
  return (
    {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "pptx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
    }[mime] ?? "bin"
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

/** `YYYY-MM-DD` y además un día que exista. */
function esFechaIso(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;

  const fecha = new Date(`${valor}T00:00:00Z`);

  return (
    !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
  );
}
