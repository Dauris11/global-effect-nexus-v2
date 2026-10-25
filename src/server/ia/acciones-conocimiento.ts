"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccion, consultarUna } from "@/lib/db";
import { AGENTES_CLAVES, trocear } from "@/lib/ia-conocimiento";
import { usuarioTienePermiso } from "@/lib/rbac";

/**
 * Carga y mantenimiento de la base de conocimiento de los agentes.
 *
 * Quien tiene `ia.administrar` gestiona todos los agentes. Contabilidad, con
 * `contabilidad.configurar`, gestiona solo `agente_contabilidad`: es su
 * normativa y es quien sabe cuándo cambia una ley.
 */

export type EstadoConocimiento = {
  estado: "inicial" | "ok" | "invalido" | "no_permitido" | "largo" | "error";
};

const MAXIMO_TEXTO = 80_000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REFRESCAR = "/[locale]/configuracion/conocimiento";

async function puedeGestionar(agentes: readonly string[]) {
  const usuario = await requerirUsuario();

  if (usuarioTienePermiso(usuario, "ia.administrar")) return usuario;

  const soloContabilidad = agentes.every((a) => a === "agente_contabilidad");

  return soloContabilidad && usuarioTienePermiso(usuario, "contabilidad.configurar")
    ? usuario
    : null;
}

export async function ingerirDocumento(
  _previo: EstadoConocimiento,
  datos: FormData,
): Promise<EstadoConocimiento> {
  const agentes = datos
    .getAll("agentes")
    .map(String)
    .filter((a) => (AGENTES_CLAVES as readonly string[]).includes(a));

  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, 160);
  const fuente = String(datos.get("fuente") ?? "").trim().slice(0, 240);
  const version = String(datos.get("version") ?? "").trim().slice(0, 40);
  const vigente = String(datos.get("vigente_hasta") ?? "").trim();
  const verificado = String(datos.get("verificado_el") ?? "").trim();
  const texto = String(datos.get("texto") ?? "").trim();

  if (!titulo || !fuente || agentes.length === 0 || !texto) return { estado: "invalido" };
  if ((vigente && !FECHA.test(vigente)) || (verificado && !FECHA.test(verificado))) {
    return { estado: "invalido" };
  }
  if (texto.length > MAXIMO_TEXTO) return { estado: "largo" };

  const usuario = await puedeGestionar(agentes);

  if (!usuario) return { estado: "no_permitido" };

  const trozos = trocear(texto);
  const documentoId = randomUUID();

  try {
    await enTransaccion(async (cliente) => {
      for (const trozo of trozos) {
        await cliente.query(
          `INSERT INTO fragmento_conocimiento
             (fuente_tipo, fuente_id, titulo, fuente, version, contenido, agentes,
              vigente_hasta, verificado_el, creado_por)
           VALUES ('documento', $1, $2, $3, NULLIF($4, ''), $5, $6,
                   NULLIF($7, '')::date, NULLIF($8, '')::date, $9)`,
          [documentoId, titulo, fuente, version, trozo, agentes, vigente, verificado, usuario.id],
        );
      }
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "ia.documento_cargado",
      entidad: "fragmento_conocimiento",
      entidadId: documentoId,
      datos: { titulo, agentes, fragmentos: trozos.length },
    });
  } catch (error) {
    console.error("[ia] no se pudo cargar el documento", error);

    return { estado: "error" };
  }

  revalidatePath(REFRESCAR, "page");

  return { estado: "ok" };
}

/** Agentes a los que pertenece un documento, para decidir quién puede tocarlo. */
async function agentesDe(documentoId: string): Promise<string[] | null> {
  const fila = await consultarUna<{ agentes: string[] }>(
    "SELECT agentes FROM fragmento_conocimiento WHERE fuente_id = $1 LIMIT 1",
    [documentoId],
  ).catch(() => null);

  return fila?.agentes ?? null;
}

async function sobreDocumento(
  datos: FormData,
  accion: string,
  sql: string,
  extra: unknown[] = [],
) {
  const documentoId = String(datos.get("documento") ?? "");
  const agentes = await agentesDe(documentoId);

  if (!agentes) return;

  const usuario = await puedeGestionar(agentes);

  if (!usuario) return;

  await consultarUna(sql, [documentoId, ...extra]).catch((e) =>
    console.error("[ia] fallo sobre el documento", e),
  );

  await registrar({
    usuarioId: usuario.id,
    accion,
    entidad: "fragmento_conocimiento",
    entidadId: documentoId,
  });

  revalidatePath(REFRESCAR, "page");
}

/** «Revisé la norma hoy»: reinicia el aviso de «sin verificar». */
export async function marcarVerificado(datos: FormData): Promise<void> {
  await sobreDocumento(
    datos,
    "ia.documento_verificado",
    "UPDATE fragmento_conocimiento SET verificado_el = current_date WHERE fuente_id = $1 RETURNING id",
  );
}

export async function alternarDocumento(datos: FormData): Promise<void> {
  await sobreDocumento(
    datos,
    "ia.documento_alternado",
    "UPDATE fragmento_conocimiento SET activo = NOT activo WHERE fuente_id = $1 RETURNING id",
  );
}

export async function eliminarDocumento(datos: FormData): Promise<void> {
  await sobreDocumento(
    datos,
    "ia.documento_eliminado",
    "DELETE FROM fragmento_conocimiento WHERE fuente_id = $1 RETURNING id",
  );
}
