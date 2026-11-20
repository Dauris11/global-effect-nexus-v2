import { consultar } from "@/lib/db";
import { leerGradua, type LecturaGradua } from "@/lib/gradua";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";

/**
 * Lectura e importación del gradua. Va aparte de `archivos.ts` (que es
 * `"use server"` y solo puede exportar acciones) para que la subida y el
 * reproceso de graduas viejos usen el mismo código.
 */

type Cliente = { query: (sql: string, valores?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

/** Texto del PDF, una fila por línea. `unpdf` trae su propio pdf.js, sin binarios del sistema. */
export async function textoDelPdf(bytes: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes.slice());
  const { text } = await extractText(pdf, { mergePages: false });

  return text;
}

/** `null` si el PDF no es un gradua legible. */
export async function leerGraduaDeBytes(bytes: Uint8Array): Promise<LecturaGradua | null> {
  try {
    return leerGradua(await textoDelPdf(bytes));
  } catch (error) {
    console.error("[academico] no se pudo leer el PDF del gradua", error);

    return null;
  }
}

/**
 * Sustituye el avance de un gradua anterior por el del nuevo. Se llama DENTRO de
 * la transacción que también escribe la fila del archivo: o queda todo o nada.
 */
export async function escribirAvance(c: Cliente, estudianteId: string, archivoId: string, l: LecturaGradua) {
  await c.query(`DELETE FROM avance_pensum WHERE estudiante_id = $1 AND fuente = 'gradua'`, [estudianteId]);

  // Dos filas con el mismo código (dos electivas en un mismo cupo) harían fallar la
  // restricción única; manda la primera, que es la que tiene resultado.
  const vistos = new Set<string>();

  for (const f of l.filas) {
    if (vistos.has(f.codigo)) continue;
    vistos.add(f.codigo);
    await c.query(
      `INSERT INTO avance_pensum (estudiante_id, codigo, detalle, nombre, creditos, puntos, periodo, letra, fuente, archivo_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'gradua', $9)`,
      [estudianteId, f.codigo, f.detalle, f.nombre, f.creditos, f.puntos, f.periodo, f.letra, archivoId],
    );
  }

  await c.query(`UPDATE archivo_academico SET leido_en = now(), resumen = $2::jsonb WHERE id = $1`, [
    archivoId,
    JSON.stringify({
      matricula: l.matricula, nombre: l.nombre, version: l.version, filas: l.filas.length,
      noCursadas: l.noCursadas, indiceReportado: l.indiceReportado,
      creditosReportados: l.creditosReportados, puntosReportados: l.puntosReportados,
    }),
  ]);
  await c.query(`UPDATE estudiante SET matricula = $2 WHERE id = $1 AND matricula IS NULL`, [estudianteId, l.matricula]);
}

/**
 * Graduas subidos ANTES de existir el lector (o cuya lectura falló): se descargan,
 * se leen y se importan. Devuelve cuántos se pudieron leer. Si había varios de un
 * mismo estudiante, el más reciente es el que manda.
 */
export async function releerGraduasPendientes(
  enTransaccion: <T>(fn: (c: Cliente) => Promise<T>) => Promise<T>,
): Promise<{ leidos: number; fallidos: string[] }> {
  const pendientes = await consultar<{ id: string; estudiante_id: string; ruta: string; nombre: string }>(
    `SELECT id, estudiante_id, ruta, nombre FROM archivo_academico
      WHERE tipo = 'gradua' AND leido_en IS NULL ORDER BY created_at`,
  );
  let leidos = 0;
  const fallidos: string[] = [];

  for (const a of pendientes) {
    const url = await enlaceDeDocumento(a.ruta, 120);
    const res = url ? await fetch(url) : null;
    const lectura = res?.ok ? await leerGraduaDeBytes(new Uint8Array(await res.arrayBuffer())) : null;

    if (!lectura) {
      fallidos.push(a.nombre);
      continue;
    }

    await enTransaccion((c) => escribirAvance(c, a.estudiante_id, a.id, lectura));
    leidos++;
  }

  return { leidos, fallidos };
}
