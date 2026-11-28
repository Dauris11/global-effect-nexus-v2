"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccion, consultarUna } from "@/lib/db";
import { AGENTES_CLAVES, trocear } from "@/lib/ia-conocimiento";
import { revisarEntrada } from "@/lib/ia-seguridad";
import { puedeGestionarAgentes } from "@/server/ia/permisos-conocimiento";

/**
 * Carga y mantenimiento de la base de conocimiento de los agentes.
 *
 * Quien tiene `tecnico.conocimiento` (developer) gestiona todos los agentes. Contabilidad, con
 * `contabilidad.configurar`, gestiona solo `agente_contabilidad`: es su
 * normativa y es quien sabe cuándo cambia una ley. `admin`, con
 * `ia.conocimiento`, gestiona solo `agente_estudiante`.
 *
 * Todo texto que entra pasa por `revisarEntrada`: lo que se guarda aquí lo
 * leerá el modelo como referencia, así que un documento con código, JSON,
 * etiquetas o órdenes disfrazadas se RECHAZA (no se reescribe en silencio).
 */

export type EstadoConocimiento = {
  estado:
    | "inicial"
    | "ok"
    | "invalido"
    | "no_permitido"
    | "largo"
    | "error"
    // Rechazos de `revisarEntrada`.
    | "codigo"
    | "instrucciones"
    | "etiquetas"
    | "caracteres";
};

const MAXIMO_TEXTO = 80_000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFRESCAR = "/[locale]/configuracion/conocimiento";

async function puedeGestionar(agentes: readonly string[]) {
  const usuario = await requerirUsuario();

  return puedeGestionarAgentes(usuario, agentes) ? usuario : null;
}

type CamposDocumento = {
  agentes: string[];
  titulo: string;
  fuente: string;
  version: string;
  vigente: string;
  verificado: string;
  texto: string;
};

/**
 * Lee y valida el formulario de un documento (alta y edición comparten reglas).
 * Devuelve el estado de error o los campos ya limpios.
 */
function leerDocumento(datos: FormData): CamposDocumento | EstadoConocimiento {
  const agentes = datos
    .getAll("agentes")
    .map(String)
    .filter((a) => (AGENTES_CLAVES as readonly string[]).includes(a));

  const crudo = {
    titulo: String(datos.get("titulo") ?? "").trim().slice(0, 160),
    fuente: String(datos.get("fuente") ?? "").trim().slice(0, 240),
    version: String(datos.get("version") ?? "").trim().slice(0, 40),
    vigente: String(datos.get("vigente_hasta") ?? "").trim(),
    verificado: String(datos.get("verificado_el") ?? "").trim(),
    texto: String(datos.get("texto") ?? "").trim(),
  };

  if (!crudo.titulo || !crudo.fuente || agentes.length === 0 || !crudo.texto) {
    return { estado: "invalido" };
  }
  if (
    (crudo.vigente && !FECHA.test(crudo.vigente)) ||
    (crudo.verificado && !FECHA.test(crudo.verificado))
  ) {
    return { estado: "invalido" };
  }
  if (crudo.texto.length > MAXIMO_TEXTO) return { estado: "largo" };

  // Título, fuente y versión también llegan al modelo (se citan), no solo el cuerpo.
  const limpios: Record<"titulo" | "fuente" | "version" | "texto", string> = {
    titulo: "",
    fuente: "",
    version: "",
    texto: "",
  };

  for (const campo of ["titulo", "fuente", "version", "texto"] as const) {
    if (campo === "version" && !crudo.version) continue;

    const revision = revisarEntrada(crudo[campo]);

    if (!revision.ok) return { estado: revision.motivo };
    limpios[campo] = revision.texto;
  }

  return { agentes, ...crudo, ...limpios };
}

const esCampos = (v: CamposDocumento | EstadoConocimiento): v is CamposDocumento =>
  "texto" in v;

type Cliente = Parameters<Parameters<typeof enTransaccion>[0]>[0];

/** Inserta los fragmentos de un documento con su orden (la edición lo necesita). */
async function insertarFragmentos(
  cliente: Cliente,
  {
    documentoId,
    trozos,
    campos,
    activo,
    creadoPor,
  }: {
    documentoId: string;
    trozos: readonly string[];
    campos: CamposDocumento;
    activo: boolean;
    creadoPor: string;
  },
) {
  for (const [orden, trozo] of trozos.entries()) {
    await cliente.query(
      `INSERT INTO fragmento_conocimiento
         (fuente_tipo, fuente_id, titulo, fuente, version, contenido, agentes,
          vigente_hasta, verificado_el, creado_por, activo, orden)
       VALUES ('documento', $1, $2, $3, NULLIF($4, ''), $5, $6,
               NULLIF($7, '')::date, NULLIF($8, '')::date, $9, $10, $11)`,
      [
        documentoId,
        campos.titulo,
        campos.fuente,
        campos.version,
        trozo,
        campos.agentes,
        campos.vigente,
        campos.verificado,
        creadoPor,
        activo,
        orden,
      ],
    );
  }
}

export async function ingerirDocumento(
  _previo: EstadoConocimiento,
  datos: FormData,
): Promise<EstadoConocimiento> {
  const campos = leerDocumento(datos);

  if (!esCampos(campos)) return campos;

  const { agentes, titulo, fuente, version, vigente, verificado, texto } = campos;

  const usuario = await puedeGestionar(agentes);

  if (!usuario) return { estado: "no_permitido" };

  const trozos = trocear(texto);
  const documentoId = randomUUID();

  try {
    await enTransaccion(async (cliente) => {
      await insertarFragmentos(cliente, {
        documentoId,
        trozos,
        campos,
        activo: true,
        creadoPor: usuario.id,
      });
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

/**
 * Edita un documento: se reemplazan sus fragmentos dentro de UNA transacción
 * y con el mismo `fuente_id`, así el documento no desaparece ni queda a medias
 * si algo falla. Se conserva si estaba activo.
 *
 * Se exige permiso sobre los agentes de ANTES y los de DESPUÉS: sin lo
 * primero, cualquiera con acceso a un agente podría tocar documentos ajenos;
 * sin lo segundo, podría moverlos a un agente que no le corresponde.
 */
export async function editarDocumento(
  _previo: EstadoConocimiento,
  datos: FormData,
): Promise<EstadoConocimiento> {
  const documentoId = String(datos.get("documento") ?? "");

  if (!UUID.test(documentoId)) return { estado: "invalido" };

  const campos = leerDocumento(datos);

  if (!esCampos(campos)) return campos;

  const antes = await agentesDe(documentoId);

  if (!antes) return { estado: "invalido" };

  const usuario = await requerirUsuario();

  if (!puedeGestionarAgentes(usuario, antes) || !puedeGestionarAgentes(usuario, campos.agentes)) {
    return { estado: "no_permitido" };
  }

  const trozos = trocear(campos.texto);

  try {
    await enTransaccion(async (cliente) => {
      const previo = await cliente.query<{ activo: boolean; creado_por: string | null }>(
        `SELECT bool_and(activo) AS activo, (array_agg(creado_por))[1] AS creado_por
           FROM fragmento_conocimiento
          WHERE fuente_id = $1 AND fuente_tipo = 'documento'`,
        [documentoId],
      );

      await cliente.query(
        "DELETE FROM fragmento_conocimiento WHERE fuente_id = $1 AND fuente_tipo = 'documento'",
        [documentoId],
      );

      await insertarFragmentos(cliente, {
        documentoId,
        trozos,
        campos,
        activo: previo.rows[0]?.activo ?? true,
        creadoPor: previo.rows[0]?.creado_por ?? usuario.id,
      });
    });

    await registrar({
      usuarioId: usuario.id,
      accion: "ia.documento_editado",
      entidad: "fragmento_conocimiento",
      entidadId: documentoId,
      datos: { titulo: campos.titulo, agentes: campos.agentes, fragmentos: trozos.length },
    });
  } catch (error) {
    console.error("[ia] no se pudo editar el documento", error);

    return { estado: "error" };
  }

  revalidatePath(REFRESCAR, "page");

  return { estado: "ok" };
}

/** Agentes a los que pertenece un documento, para decidir quién puede tocarlo. */
async function agentesDe(documentoId: string): Promise<string[] | null> {
  const fila = await consultarUna<{ agentes: string[] }>(
    "SELECT agentes FROM fragmento_conocimiento WHERE fuente_id = $1 AND fuente_tipo = 'documento' LIMIT 1",
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

  if (!UUID.test(documentoId)) return;

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
