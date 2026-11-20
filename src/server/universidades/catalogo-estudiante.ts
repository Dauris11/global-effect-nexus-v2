/**
 * Valida y resuelve la elección de catálogo de un expediente (universidad →
 * carrera → pénsum). La comprueba el servidor porque los desplegables en cascada
 * del navegador no son una garantía: la carrera tiene que ser de esa
 * universidad, el pénsum de esa carrera, y la universidad estar activa.
 *
 * Devuelve también el texto espejo (`siglas` y nombre de la carrera) que se
 * sigue escribiendo en `estudiante.universidad` y `.programa`: listados, filtros
 * y el tope de créditos por universidad todavía los leen.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EleccionCatalogo = {
  universidadId: string | null;
  carreraId: string | null;
  pensumId: string | null;
  siglas: string | null;
  carrera: string | null;
};

type Consulta = { query: (sql: string, valores: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

/** `null` si la cadena no es válida. */
export async function resolverCatalogo(
  cliente: Consulta,
  datos: FormData,
): Promise<EleccionCatalogo | null> {
  const leer = (k: string) => String(datos.get(k) ?? "").trim();
  const universidadId = leer("universidad_id");
  const carreraId = leer("carrera_id");
  const pensumId = leer("pensum_id");

  const vacio: EleccionCatalogo = { universidadId: null, carreraId: null, pensumId: null, siglas: null, carrera: null };

  if (!universidadId) return carreraId || pensumId ? null : vacio;
  if (!UUID.test(universidadId) || (carreraId && !UUID.test(carreraId)) || (pensumId && !UUID.test(pensumId))) return null;
  if (pensumId && !carreraId) return null;

  const { rows } = await cliente.query(
    `SELECT u.siglas,
            c.nombre AS carrera,
            (p.id IS NOT NULL) AS pensum_ok
       FROM universidad u
       LEFT JOIN carrera c ON c.id = NULLIF($2, '')::uuid AND c.universidad_id = u.id
       LEFT JOIN pensum p ON p.id = NULLIF($3, '')::uuid AND p.carrera_id = c.id
      WHERE u.id = $1 AND u.activa`,
    [universidadId, carreraId, pensumId],
  );
  const f = rows[0] as { siglas: string; carrera: string | null; pensum_ok: boolean } | undefined;

  if (!f || (carreraId && !f.carrera) || (pensumId && !f.pensum_ok)) return null;

  return {
    universidadId,
    carreraId: carreraId || null,
    pensumId: pensumId || null,
    siglas: f.siglas,
    carrera: f.carrera,
  };
}
