import { consultar } from "@/lib/db";
import { LECTORES_GRADUA, type LecturaGradua } from "@/lib/gradua";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { avisarRiesgoDeEstudiantes } from "@/server/academico/avisos";

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

/**
 * `null` si el PDF no es un gradua legible. Cada universidad imprime el suyo, así
 * que se usa el lector de ESA universidad (por siglas); si no hay uno, se devuelve
 * `"sin_lector"` para poder decir «todavía no sabemos leer el de X» y no «esto no
 * es un gradua».
 */
export async function leerGraduaDeBytes(bytes: Uint8Array, siglas: string | null): Promise<LecturaGradua | null | "sin_lector"> {
  const lector = siglas ? LECTORES_GRADUA[siglas.toUpperCase()] : undefined;

  if (!lector) return "sin_lector";

  try {
    return lector(await textoDelPdf(bytes));
  } catch (error) {
    console.error("[academico] no se pudo leer el PDF del gradua", error);

    return null;
  }
}

/**
 * Pasa lo leído al formato nativo: una fila por INTENTO (materia + año + ronda).
 * Reemplaza solo las filas que vinieron de un gradua anterior —un gradua nuevo
 * trae el historial completo—; lo cargado a mano o por calificaciones no se toca.
 * Se llama DENTRO de la transacción que también escribe la fila del archivo.
 */
export async function escribirResultados(c: Cliente, estudianteId: string, archivoId: string, l: LecturaGradua) {
  await c.query(`DELETE FROM resultado_materia WHERE estudiante_id = $1 AND fuente = 'gradua'`, [estudianteId]);

  for (const f of l.filas) {
    // Dos electivas en un mismo cupo y período chocarían con la restricción única;
    // manda la primera que llegó, que es la que tiene resultado.
    await c.query(
      `INSERT INTO resultado_materia (estudiante_id, codigo, detalle, nombre, creditos, anio, ronda, letra, puntos, fuente, archivo_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'gradua', $10)
       ON CONFLICT (estudiante_id, codigo, anio, ronda) DO NOTHING`,
      [estudianteId, f.codigo, f.detalle, f.nombre, f.creditos, f.anio, f.ronda, f.letra, f.puntos, archivoId],
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
}

/**
 * Graduas subidos ANTES de existir el lector (o cuya lectura falló): se descargan,
 * se leen y se importan. Devuelve cuántos se pudieron leer. Si había varios de un
 * mismo estudiante, el más reciente es el que manda.
 */
export async function releerGraduasPendientes(
  enTransaccion: <T>(fn: (c: Cliente) => Promise<T>) => Promise<T>,
): Promise<{ leidos: number; fallidos: string[] }> {
  const pendientes = await consultar<{ id: string; estudiante_id: string; ruta: string; nombre: string; siglas: string | null }>(
    `SELECT a.id, a.estudiante_id, a.ruta, a.nombre, u.siglas
       FROM archivo_academico a
       JOIN estudiante e ON e.id = a.estudiante_id
       LEFT JOIN universidad u ON u.id = e.universidad_id
      WHERE a.tipo = 'gradua' AND a.leido_en IS NULL ORDER BY a.created_at`,
  );
  let leidos = 0;
  const fallidos: string[] = [];

  for (const a of pendientes) {
    const url = await enlaceDeDocumento(a.ruta, 120);
    const res = url ? await fetch(url) : null;
    const lectura = res?.ok ? await leerGraduaDeBytes(new Uint8Array(await res.arrayBuffer()), a.siglas) : null;

    if (!lectura || lectura === "sin_lector") {
      fallidos.push(a.nombre);
      continue;
    }

    await enTransaccion((c) => escribirResultados(c, a.estudiante_id, a.id, lectura));
    await avisarRiesgoDeEstudiantes([a.estudiante_id]);
    leidos++;
  }

  return { leidos, fallidos };
}
