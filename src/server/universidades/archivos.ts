"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { soloDigitos, type LecturaGradua } from "@/lib/gradua";
import { usuarioTienePermiso } from "@/lib/rbac";
import { borrarDocumento, MAXIMO_ENTREGA, subirMaterial } from "@/lib/supabase/almacen";
import { escribirAvance, leerGraduaDeBytes } from "@/server/universidades/gradua-importar";

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
    | "error";
  /** Solo si el archivo era un gradua y se leyó: lo que dijo. */
  lectura?: { filas: number; noCursadas: number; indiceReportado: number | null; creditos: number | null };
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

  if (tipo === "gradua") {
    lectura = await leerGraduaDeBytes(bytes);

    if (!lectura) return { estado: "gradua_ilegible" };

    const est = await consultarUna<{ matricula: string | null }>(`SELECT matricula FROM estudiante WHERE id = $1`, [id]);

    if (est?.matricula && soloDigitos(est.matricula) !== soloDigitos(lectura.matricula)) {
      return { estado: "matricula_distinta" };
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

      if (lectura) await escribirAvance(c, id, nuevo, lectura);

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
  await consultarUna(`DELETE FROM avance_pensum WHERE archivo_id = $1 RETURNING id`, [id]);
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
