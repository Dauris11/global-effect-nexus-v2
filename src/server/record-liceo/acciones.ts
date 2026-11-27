"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { nombresParecidos } from "@/lib/gradua";
import { MAXIMO_DOCUMENTO_OCR } from "@/lib/ia";
import { borradorDeEntrada, fusionarGrados, pendientesDeRevisar, promediosDelRecord, validarRecord, type ErrorRecord, type GradoLiceo } from "@/lib/record-liceo";
import { usuarioTienePermiso } from "@/lib/rbac";
import { borrarDocumento, subirMaterial } from "@/lib/supabase/almacen";
import { leerRecordDeArchivo } from "@/server/record-liceo/lectura";

/**
 * Acciones del récord de notas de secundaria. Todas piden `expedientes.escribir`
 * y lo vuelven a comprobar: esconder el botón no es control de acceso.
 *
 * El flujo es siempre el mismo: foto o captura a mano → BORRADOR → una persona lo
 * revisa en una tabla → confirma → el servidor valida de nuevo, recalcula los
 * promedios (no se fía de los del navegador ni de los del papel) y guarda todo
 * en una sola transacción. Nada llega a `record_liceo_grado` sin esa confirmación.
 *
 * Esto es aparte del índice universitario: no escribe en `historial_calificacion`
 * ni en `resultado_materia`, y su promedio es de 0 a 100.
 */

export type EstadoRecordLiceo = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "sin_archivo"
    | "demasiados_archivos"
    | "tipo_no_admitido"
    | "demasiado_grande"
    | "sin_clave"
    | "ilegible"
    | "sin_filas"
    | "dato_invalido"
    | ErrorRecord
    | "error";
  /** Tras leer: el borrador completo (lo que había en pantalla más lo leído). */
  grados?: GradoLiceo[];
  /** Tras leer: cuántas fotos se aceptaron y cuántas no se pudieron leer. */
  leidas?: number;
  descartadas?: number;
  sinNota?: number;
  dudosas?: number;
  /** Avisos que no impiden seguir, p. ej. `nombre_distinto`. */
  avisos?: string[];
  /** Tras confirmar. */
  promedioGlobal?: number | null;
  promedioAnual?: number | null;
  totalNotas?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAXIMO_FOTOS = 4;
const RUTA_PAGINA = "/[locale]/expedientes/[id]";

async function usuarioConPermiso() {
  const usuario = await requerirUsuario();

  return usuarioTienePermiso(usuario, "expedientes.escribir") ? usuario : null;
}

/** El tipo real sale de los primeros bytes, no del que declare el navegador. */
function tipoPorFirma(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };

  return null;
}

function jsonDe(d: FormData, clave: string): unknown {
  try {
    return JSON.parse(String(d.get(clave) ?? "null"));
  } catch {
    return null;
  }
}

/** Fotos → lectura con IA → borrador. Las fotos se suben una sola vez y quedan «pendientes». */
export async function leerRecordLiceo(_p: EstadoRecordLiceo, d: FormData): Promise<EstadoRecordLiceo> {
  const usuario = await usuarioConPermiso();

  if (!usuario) return { estado: "no_permitido" };

  const estudianteId = String(d.get("estudiante") ?? "");

  if (!UUID.test(estudianteId)) return { estado: "no_encontrado" };

  const archivos = d.getAll("fotos").filter((x): x is File => x instanceof File && x.size > 0);

  if (archivos.length === 0) return { estado: "sin_archivo" };
  if (archivos.length > MAXIMO_FOTOS) return { estado: "demasiados_archivos" };

  const estudiante = await consultarUna<{ nombre: string }>(`SELECT nombre FROM estudiante WHERE id = $1`, [estudianteId]);

  if (!estudiante) return { estado: "no_encontrado" };

  const preparados: { bytes: Uint8Array; mime: string; ext: string; nombre: string }[] = [];

  for (const a of archivos) {
    if (a.size > MAXIMO_DOCUMENTO_OCR) return { estado: "demasiado_grande" };

    const bytes = new Uint8Array(await a.arrayBuffer());
    const tipo = tipoPorFirma(bytes);

    if (!tipo) return { estado: "tipo_no_admitido" };
    preparados.push({ bytes, ...tipo, nombre: a.name.slice(0, 160) || `record.${tipo.ext}` });
  }

  // Cada imagen se lee por separado y luego se une por grado + año + centro: el
  // frente y el reverso del récord son dos lecturas de un mismo récord.
  const lecturas = await Promise.all(
    preparados.map((p) => leerRecordDeArchivo({ mime: p.mime, base64: Buffer.from(p.bytes).toString("base64"), bytes: p.bytes.length })),
  );
  const buenas = lecturas.flatMap((l, i) => (l.estado === "ok" ? [{ l, p: preparados[i] }] : []));

  if (buenas.length === 0) {
    const primera = lecturas[0];

    return { estado: primera.estado === "ok" ? "error" : primera.estado };
  }

  const avisos: string[] = [];

  if (buenas.some(({ l }) => l.estado === "ok" && l.estudiante && !nombresParecidos(l.estudiante, estudiante.nombre))) avisos.push("nombre_distinto");

  const actual = borradorDeEntrada(jsonDe(d, "actual"));
  const grados = buenas.reduce<GradoLiceo[]>((acc, { l }) => (l.estado === "ok" ? fusionarGrados(acc, l.grados) : acc), actual);

  // Solo se guardan las fotos que sí eran un récord: una foto que no se pudo leer
  // no se queda en el bucket «por si acaso».
  const subidas: string[] = [];

  try {
    const recordId = await enTransaccion(async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO record_liceo (estudiante_id, creado_por, borrador) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (estudiante_id) DO UPDATE SET borrador = EXCLUDED.borrador, updated_at = now()
         RETURNING id`,
        [estudianteId, usuario.id, JSON.stringify(grados)],
      );
      const id = r.rows[0].id;

      for (const { p } of buenas) {
        const ruta = `academico/estudiantes/${estudianteId}/record-liceo/${randomUUID()}.${p.ext}`;
        const subida = await subirMaterial(ruta, new File([p.bytes as BlobPart], `foto.${p.ext}`, { type: p.mime }));

        if (!subida.ok) throw new Error("no se pudo subir la foto");
        subidas.push(ruta);

        await c.query(
          `INSERT INTO archivo_academico (estudiante_id, tipo, ruta, nombre, tamano, subido_por, mime, record_liceo_id, pendiente)
           VALUES ($1, 'record_notas', $2, $3, $4, $5, $6, $7, true)`,
          [estudianteId, ruta, p.nombre, p.bytes.length, usuario.id, p.mime, id],
        );
      }

      return id;
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "record_liceo.leido",
      entidad: "record_liceo",
      entidadId: recordId,
      datos: { fotos: buenas.length, descartadas: lecturas.length - buenas.length, grados: grados.length },
    });
  } catch (error) {
    // La transacción se deshizo: lo ya subido al bucket no debe quedar huérfano.
    await Promise.all(subidas.map((r) => borrarDocumento(r)));
    console.error("[record-liceo] no se pudo guardar la lectura", error);

    return { estado: "error" };
  }

  revalidatePath(RUTA_PAGINA, "page");

  return { estado: "ok", grados, leidas: buenas.length, descartadas: lecturas.length - buenas.length, avisos, ...pendientesDeRevisar(grados) };
}

/** Valida otra vez, recalcula los promedios y guarda todo o nada. */
export async function confirmarRecordLiceo(_p: EstadoRecordLiceo, d: FormData): Promise<EstadoRecordLiceo> {
  const usuario = await usuarioConPermiso();

  if (!usuario) return { estado: "no_permitido" };

  const estudianteId = String(d.get("estudiante") ?? "");

  if (!UUID.test(estudianteId)) return { estado: "no_encontrado" };

  const v = validarRecord(jsonDe(d, "grados"));

  if (!v.ok) return { estado: v.error };

  const existe = await consultarUna<{ id: string }>(`SELECT id FROM estudiante WHERE id = $1`, [estudianteId]);

  if (!existe) return { estado: "no_encontrado" };

  // Los promedios SIEMPRE se recalculan aquí, de las notas ya validadas.
  const promedios = promediosDelRecord(v.grados);

  try {
    const recordId = await enTransaccion(async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO record_liceo (estudiante_id, creado_por, confirmado_por, confirmado_at, borrador)
         VALUES ($1, $2, $2, now(), NULL)
         ON CONFLICT (estudiante_id) DO UPDATE SET confirmado_por = $2, confirmado_at = now(), borrador = NULL, updated_at = now()
         RETURNING id`,
        [estudianteId, usuario.id],
      );
      const id = r.rows[0].id;

      // Se reemplaza lo confirmado por lo revisado: agregar el 6.º más adelante es
      // editar el récord y volver a confirmar, y los dos promedios se recalculan.
      await c.query(`DELETE FROM record_liceo_grado WHERE record_id = $1`, [id]);

      for (const g of v.grados) {
        const rg = await c.query<{ id: string }>(
          `INSERT INTO record_liceo_grado (record_id, grado, anio_inicio, anio_fin, centro) VALUES ($1, $2, $3, $3 + 1, $4) RETURNING id`,
          [id, g.grado, g.anioInicio, g.centro],
        );

        for (const [i, n] of g.notas.entries()) {
          await c.query(`INSERT INTO record_liceo_nota (grado_id, orden, materia, es_modulo, nota) VALUES ($1, $2, $3, $4, $5)`, [rg.rows[0].id, i + 1, n.materia, n.esModulo, n.nota]);
        }
      }

      await c.query(`UPDATE archivo_academico SET pendiente = false WHERE record_liceo_id = $1`, [id]);
      await c.query(`UPDATE estudiante SET promedio_secundaria = $2, promedio_secundaria_anual = $3 WHERE id = $1`, [estudianteId, promedios.global, promedios.anual]);

      return id;
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "record_liceo.confirmado",
      entidad: "record_liceo",
      entidadId: recordId,
      datos: { grados: v.grados.length, notas: promedios.totalNotas, global: promedios.global, anual: promedios.anual },
    });
  } catch (error) {
    console.error("[record-liceo] no se pudo confirmar", error);

    return { estado: "error" };
  }

  revalidatePath(RUTA_PAGINA, "page");
  revalidatePath("/[locale]/expedientes", "page");

  return { estado: "ok", promedioGlobal: promedios.global, promedioAnual: promedios.anual, totalNotas: promedios.totalNotas };
}

/** Descarta el borrador y borra las fotos que aún no se habían confirmado. */
export async function descartarBorradorRecordLiceo(_p: EstadoRecordLiceo, d: FormData): Promise<EstadoRecordLiceo> {
  const usuario = await usuarioConPermiso();

  if (!usuario) return { estado: "no_permitido" };

  const estudianteId = String(d.get("estudiante") ?? "");

  if (!UUID.test(estudianteId)) return { estado: "no_encontrado" };

  const record = await consultarUna<{ id: string; confirmado_at: string | null }>(
    `SELECT id, confirmado_at::text AS confirmado_at FROM record_liceo WHERE estudiante_id = $1`,
    [estudianteId],
  );

  if (!record) return { estado: "ok" };

  const pendientes = await consultar<{ ruta: string }>(`SELECT ruta FROM archivo_academico WHERE record_liceo_id = $1 AND pendiente`, [record.id]);

  await enTransaccion(async (c) => {
    await c.query(`DELETE FROM archivo_academico WHERE record_liceo_id = $1 AND pendiente`, [record.id]);

    // Un récord que nunca se confirmó y se quedó sin fotos no tiene nada que guardar.
    if (record.confirmado_at) await c.query(`UPDATE record_liceo SET borrador = NULL, updated_at = now() WHERE id = $1`, [record.id]);
    else await c.query(`DELETE FROM record_liceo WHERE id = $1`, [record.id]);
  });
  await Promise.all(pendientes.map((p) => borrarDocumento(p.ruta)));
  await registrar({ usuarioId: usuario.id, accion: "record_liceo.borrador_descartado", entidad: "record_liceo", entidadId: record.id, datos: { fotos: pendientes.length } });

  revalidatePath(RUTA_PAGINA, "page");

  return { estado: "ok" };
}

/**
 * Quita el récord confirmado: las notas, las fotos (también del bucket) y los dos
 * promedios del estudiante. Es lo único que se borra aquí, y solo a pedido de una
 * persona con permiso, con confirmación en pantalla; queda en la bitácora con lo
 * que valían los promedios. No toca nada del índice universitario.
 */
export async function quitarRecordLiceo(_p: EstadoRecordLiceo, d: FormData): Promise<EstadoRecordLiceo> {
  const usuario = await usuarioConPermiso();

  if (!usuario) return { estado: "no_permitido" };

  const estudianteId = String(d.get("estudiante") ?? "");

  if (!UUID.test(estudianteId)) return { estado: "no_encontrado" };

  const antes = await consultarUna<{ id: string; global: number | null; anual: number | null }>(
    `SELECT r.id, e.promedio_secundaria::float8 AS global, e.promedio_secundaria_anual::float8 AS anual
       FROM record_liceo r JOIN estudiante e ON e.id = r.estudiante_id WHERE r.estudiante_id = $1`,
    [estudianteId],
  );

  if (!antes) return { estado: "ok" };

  const fotos = await consultar<{ ruta: string }>(`SELECT ruta FROM archivo_academico WHERE record_liceo_id = $1`, [antes.id]);

  try {
    await enTransaccion(async (c) => {
      // El récord arrastra sus grados, notas y filas de archivo (ON DELETE CASCADE).
      await c.query(`DELETE FROM record_liceo WHERE id = $1`, [antes.id]);
      await c.query(`UPDATE estudiante SET promedio_secundaria = NULL, promedio_secundaria_anual = NULL WHERE id = $1`, [estudianteId]);
    });
  } catch (error) {
    console.error("[record-liceo] no se pudo quitar", error);

    return { estado: "error" };
  }

  // Con la fila ya borrada, un fallo del bucket deja un archivo suelto pero nunca un récord a medias.
  await Promise.all(fotos.map((f) => borrarDocumento(f.ruta)));
  await registrar({
    usuarioId: usuario.id,
    accion: "record_liceo.quitado",
    entidad: "estudiante",
    entidadId: estudianteId,
    datos: { fotos: fotos.length, global: antes.global, anual: antes.anual },
  });

  revalidatePath(RUTA_PAGINA, "page");
  revalidatePath("/[locale]/expedientes", "page");

  return { estado: "ok" };
}
