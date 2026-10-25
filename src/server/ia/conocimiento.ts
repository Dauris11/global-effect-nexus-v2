import { consultar } from "@/lib/db";
import { DIAS_SIN_VERIFICAR } from "@/lib/ia-conocimiento";

/**
 * Base de conocimiento por agente.
 *
 * El filtro por agente va DENTRO de la consulta (`$1 = ANY(agentes)`) y no se
 * aplica después en código: un agente nunca recupera un fragmento que no le
 * pertenece, ni siquiera para descartarlo. Quien llama pasa la clave que el
 * servidor derivó del rol de la sesión, nunca una que venga del cliente.
 *
 * Búsqueda por texto (tsvector en español + similitud de palabras). La columna
 * `embedding` existe pero no se usa hasta elegir proveedor de embeddings.
 */

export type FragmentoEncontrado = {
  id: string;
  titulo: string | null;
  fuente: string | null;
  version: string | null;
  contenido: string;
  verificadoEl: string | null;
  /** Sin revisión humana en más de 90 días (o nunca revisada). */
  sinVerificar: boolean;
};

export async function buscarConocimiento(
  agente: string,
  consulta: string,
  limite = 5,
): Promise<FragmentoEncontrado[]> {
  const texto = consulta.trim().slice(0, 300);

  if (!texto) return [];

  const rows = await consultar<{
    id: string;
    titulo: string | null;
    fuente: string | null;
    version: string | null;
    contenido: string;
    verificado_el: string | null;
    sin_verificar: boolean;
  }>(
    `SELECT f.id, f.titulo, f.fuente, f.version, f.contenido,
            f.verificado_el::text AS verificado_el,
            (f.verificado_el IS NULL
               OR f.verificado_el < current_date - $4::int) AS sin_verificar
       FROM fragmento_conocimiento f,
            websearch_to_tsquery('spanish', $2) q
      WHERE f.activo
        AND $1 = ANY (f.agentes)
        AND (f.vigente_hasta IS NULL OR f.vigente_hasta >= current_date)
        AND (f.contenido_tsv @@ q OR word_similarity($2, f.contenido) > 0.45)
      ORDER BY ts_rank(f.contenido_tsv, q) + word_similarity($2, f.contenido) DESC
      LIMIT $3`,
    [agente, texto, Math.min(Math.max(limite, 1), 10), DIAS_SIN_VERIFICAR],
  );

  return rows.map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    fuente: fila.fuente,
    version: fila.version,
    contenido: fila.contenido,
    verificadoEl: fila.verificado_el,
    sinVerificar: fila.sin_verificar,
  }));
}
