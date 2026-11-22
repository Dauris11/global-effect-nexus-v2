"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { nombresParecidos, normalizarVersion, soloDigitos, type LecturaGradua } from "@/lib/gradua";
import { usuarioTienePermiso } from "@/lib/rbac";
import { avisarRiesgoDeEstudiantes } from "@/server/academico/avisos";
import { borrarDocumento, MAXIMO_ENTREGA, subirMaterial } from "@/lib/supabase/almacen";
import { escribirResultados, leerGraduaDeBytes } from "@/server/universidades/gradua-importar";

/**
 * Subir y quitar los PDF académicos: el «gradua» (validación de asignaturas) y el
 * récord de notas de un estudiante, y el PDF oficial de un pénsum.
 *
 * Quién: el expediente de un estudiante pide `expedientes.escribir`; el pénsum,
 * `catalogo.escribir`. Van al bucket privado `documentos` con una ruta armada con
 * ids y un UUID —nunca con el nombre que traiga el archivo— y se bajan por
 * `/api/archivos-academicos/[id]`, que vuelve a comprobar permisos.
 *
 * Solo PDF, y se comprueba la firma real (`%PDF-`), no el tipo que declara el
 * navegador. Leer su contenido (OCR con revisión humana) es una fase posterior.
 */

export type EstadoArchivo = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "no_es_pdf"
    | "grande"
    | "gradua_ilegible"
    | "matricula_distinta"
    | "sin_universidad"
    | "sin_lector"
    | "error";
  /** Para decir de qué universidad no hay lector. */
  universidad?: string;
  /** Solo si el archivo era un gradua y se leyó: lo que dijo y qué se avisó. */
  lectura?: {
    filas: number;
    noCursadas: number;
    indiceReportado: number | null;
    creditos: number | null;
    /** Avisos que no impiden guardar: `nombre_distinto`, `version_distinta`, `pensum_asignado`. */
    avisos: string[];
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS_ESTUDIANTE = ["gradua", "record_notas"];

export async function subirArchivoAcademico(_p: EstadoArchivo, d: FormData): Promise<EstadoArchivo> {
  const usuario = await requerirUsuario();
  const destino = String(d.get("destino") ?? "");
  const id = String(d.get("id") ?? "");
  const tipo = destino === "pensum" ? "pensum_pdf" : String(d.get("tipo") ?? "");
  const archivo = d.get("archivo");

  if (!UUID.test(id) || !["estudiante", "pensum"].includes(destino)) return { estado: "no_encontrado" };
  if (destino === "estudiante" && !TIPOS_ESTUDIANTE.includes(tipo)) return { estado: "no_encontrado" };

  const permiso = destino === "pensum" ? "catalogo.escribir" : "expedientes.escribir";

  if (!usuarioTienePermiso(usuario, permiso)) return { estado: "no_permitido" };
  if (!(archivo instanceof File) || archivo.size === 0) return { estado: "no_es_pdf" };
  if (archivo.size > MAXIMO_ENTREGA) return { estado: "grande" };

  const bytes = new Uint8Array(await archivo.arrayBuffer());

  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return { estado: "no_es_pdf" };

  // Un gradua se LEE antes de guardarlo: si no es un gradua, o es de otra persona,
  // no se guarda nada y se dice por qué. Subirlo «para que figure» sin que cambie el
  // pénsum era justo lo que parecía no hacer nada.
  let lectura: LecturaGradua | null = null;
  const avisos: string[] = [];
  let estudiante: { matricula: string | null; nombre: string; siglas: string | null; pensum_id: string | null; pensum_version: string | null; universidad_id: string | null } | null = null;

  if (tipo === "gradua") {
    estudiante = await consultarUna(
      `SELECT e.matricula, e.nombre, u.siglas, e.pensum_id, p.version AS pensum_version, e.universidad_id
         FROM estudiante e
         LEFT JOIN universidad u ON u.id = e.universidad_id
         LEFT JOIN pensum p ON p.id = e.pensum_id
        WHERE e.id = $1`,
      [id],
    );

    if (!estudiante) return { estado: "no_encontrado" };
    // Cada universidad imprime su gradua distinto: hay que saber cuál es la del estudiante.
    if (!estudiante.siglas) return { estado: "sin_universidad" };

    const leido = await leerGraduaDeBytes(bytes, estudiante.siglas);

    if (leido === "sin_lector") return { estado: "sin_lector", universidad: estudiante.siglas };
    if (!leido) return { estado: "gradua_ilegible", universidad: estudiante.siglas };

    lectura = leido;

    // Otra persona: se rechaza. La matrícula es lo que identifica; el nombre solo avisa.
    if (estudiante.matricula && soloDigitos(estudiante.matricula) !== soloDigitos(lectura.matricula)) {
      return { estado: "matricula_distinta" };
    }
    if (!nombresParecidos(lectura.nombre, estudiante.nombre)) avisos.push("nombre_distinto");
    if (estudiante.pensum_version && normalizarVersion(lectura.version) !== normalizarVersion(estudiante.pensum_version)) {
      avisos.push("version_distinta");
    }
  }

  const existe = await consultarUna<{ id: string }>(
    destino === "pensum" ? `SELECT id FROM pensum WHERE id = $1` : `SELECT id FROM estudiante WHERE id = $1`,
    [id],
  );

  if (!existe) return { estado: "no_encontrado" };

  const ruta = `academico/${destino === "pensum" ? "pensums" : "estudiantes"}/${id}/${randomUUID()}.pdf`;
  const subida = await subirMaterial(ruta, new File([bytes as BlobPart], "archivo.pdf", { type: "application/pdf" }));

  if (!subida.ok) return { estado: "error" };

  try {
    // Fila del archivo y avance leído en UNA transacción: si algo falla no queda un
    // archivo registrado sin su avance ni un avance sin archivo.
    const archivoId = await enTransaccion(async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO archivo_academico (estudiante_id, pensum_id, tipo, ruta, nombre, tamano, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [destino === "estudiante" ? id : null, destino === "pensum" ? id : null, tipo, ruta, archivo.name.slice(0, 160), archivo.size, usuario.id],
      );
      const nuevo = r.rows[0].id;

      if (lectura) {
        await escribirResultados(c, id, nuevo, lectura);

        // Sin matrícula, se anota la del reporte, pero solo si el nombre también
        // concuerda: adoptarla de otra persona sería dejar el expediente mal marcado.
        if (!estudiante?.matricula && !avisos.includes("nombre_distinto")) {
          await c.query(`UPDATE estudiante SET matricula = $2 WHERE id = $1 AND matricula IS NULL`, [id, lectura.matricula]);
        }

        // Sin pénsum elegido, la versión del reporte lo resuelve si coincide con un
        // plan del catálogo de SU universidad.
        if (!estudiante?.pensum_id) {
          const r2 = await c.query<{ id: string; carrera_id: string }>(
            `SELECT p.id, p.carrera_id FROM pensum p JOIN carrera c ON c.id = p.carrera_id
              WHERE c.universidad_id = $1 AND regexp_replace(upper(p.version), '[^A-Z0-9]', '', 'g') = $2`,
            [estudiante?.universidad_id, normalizarVersion(lectura.version)],
          );

          if (r2.rows.length === 1) {
            await c.query(`UPDATE estudiante SET carrera_id = $2, pensum_id = $3 WHERE id = $1 AND pensum_id IS NULL`, [id, r2.rows[0].carrera_id, r2.rows[0].id]);
            avisos.push("pensum_asignado");
          }
        }
      }

      return nuevo;
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "archivo_academico.subido",
      entidad: destino === "pensum" ? "pensum" : "estudiante",
      entidadId: id,
      datos: { tipo, tamano: archivo.size, archivo: archivoId, filas: lectura?.filas.length },
    });
  } catch (error) {
    // La transacción se deshizo: el archivo ya subido al bucket no debe quedar huérfano.
    await borrarDocumento(ruta);
    console.error("[academico] no se pudo registrar el archivo", error);

    return { estado: "error" };
  }

  // Un gradua nuevo puede dejar al estudiante bajo el mínimo de su universidad: se avisa a administración.
  if (destino === "estudiante" && lectura) await avisarRiesgoDeEstudiantes([id]);

  revalidatePath("/[locale]/expedientes/[id]", "page");
  revalidatePath("/[locale]/academico/universidades", "layout");

  return {
    estado: "ok",
    lectura: lectura
      ? {
          filas: lectura.filas.length,
          noCursadas: lectura.noCursadas,
          indiceReportado: lectura.indiceReportado,
          creditos: lectura.creditosReportados,
          avisos,
        }
      : undefined,
  };
}

export async function quitarArchivoAcademico(_p: EstadoArchivo, d: FormData): Promise<EstadoArchivo> {
  const usuario = await requerirUsuario();
  const id = String(d.get("id") ?? "");

  if (!UUID.test(id)) return { estado: "no_encontrado" };

  const fila = await consultarUna<{ ruta: string; estudiante_id: string | null; pensum_id: string | null; tipo: string }>(
    `SELECT ruta, estudiante_id, pensum_id, tipo FROM archivo_academico WHERE id = $1`,
    [id],
  );

  if (!fila) return { estado: "no_encontrado" };

  const permiso = fila.pensum_id ? "catalogo.escribir" : "expedientes.escribir";

  if (!usuarioTienePermiso(usuario, permiso)) return { estado: "no_permitido" };

  // Quitar un gradua quita también el avance que se leyó de él.
  await consultarUna(`DELETE FROM resultado_materia WHERE archivo_id = $1 RETURNING id`, [id]);
  await consultarUna(`DELETE FROM archivo_academico WHERE id = $1 RETURNING id`, [id]);
  await borrarDocumento(fila.ruta);
  await registrar({
    usuarioId: usuario.id,
    accion: "archivo_academico.quitado",
    entidad: fila.pensum_id ? "pensum" : "estudiante",
    entidadId: (fila.pensum_id ?? fila.estudiante_id) as string,
    datos: { tipo: fila.tipo },
  });

  revalidatePath("/[locale]/expedientes/[id]", "page");
  revalidatePath("/[locale]/academico/universidades", "layout");

  return { estado: "ok" };
}
