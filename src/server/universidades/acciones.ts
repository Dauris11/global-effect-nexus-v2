"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { leerPuntosPorLetra } from "@/lib/indice-academico";
import { leerListaDePensum } from "@/lib/pensum";
import { usuarioTienePermiso } from "@/lib/rbac";

/**
 * Escrituras del catálogo universidad → carrera → pénsum → materias.
 *
 * El catálogo es de la institución, así que escribir exige `catalogo.escribir`
 * (admin y super_admin). Vincular a un estudiante con el catálogo es edición de
 * su expediente: `expedientes.escribir`. Nada se borra: una universidad o
 * carrera con estudiantes colgando se desactiva, y las FK son RESTRICT para que
 * ni un SQL a mano se lleve un pénsum por delante.
 */

export type EstadoCatalogo = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "dato_invalido"
    | "duplicado"
    | "error";
  /** Materias cargadas / líneas rechazadas, para la carga por lista. */
  cargadas?: number;
  rechazadas?: number[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGIMENES = ["cuatrimestre", "trimestre", "semestre"];

const texto = (d: FormData, k: string, max: number) => String(d.get(k) ?? "").trim().slice(0, max);

async function conPermiso(permiso: "catalogo.escribir" | "expedientes.escribir") {
  const usuario = await requerirUsuario();

  return usuarioTienePermiso(usuario, permiso) ? usuario : null;
}

/** Los códigos de error únicos de Postgres se dicen como «duplicado». */
function esDuplicado(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

function refrescar() {
  revalidatePath("/[locale]/academico/universidades", "layout");
  revalidatePath("/[locale]/expedientes/[id]", "page");
}

export async function guardarUniversidad(_p: EstadoCatalogo, d: FormData): Promise<EstadoCatalogo> {
  const usuario = await conPermiso("catalogo.escribir");

  if (!usuario) return { estado: "no_permitido" };

  const id = texto(d, "id", 40);
  const siglas = texto(d, "siglas", 20).toUpperCase();
  const nombre = texto(d, "nombre", 160);
  const regimen = texto(d, "regimen", 20);
  const activa = d.get("activa") !== "no";
  // Reglas de calificación de ESTA universidad (cada una tiene las suyas).
  const puntos = leerPuntosPorLetra(texto(d, "puntos", 200));
  const letraMinima = texto(d, "letra_minima", 3).toUpperCase();
  const retirada = d.get("retirada") !== "no";
  const redondeo = texto(d, "redondeo", 12) === "redondear" ? "redondear" : "truncar";
  const confirmadas = d.get("confirmadas") === "si";

  if (!siglas || !nombre || !REGIMENES.includes(regimen) || (id && !UUID.test(id)) || !puntos || !(letraMinima in puntos)) {
    return { estado: "dato_invalido" };
  }

  try {
    const fila = id
      ? await consultarUna<{ id: string }>(
          `UPDATE universidad SET siglas = $2, nombre = $3, regimen = $4, activa = $5,
                  puntos_por_letra = $6::jsonb, letra_minima_aprobar = $7,
                  retirada_cuenta_en_divisor = $8, redondeo_indice = $9, reglas_confirmadas = $10
            WHERE id = $1 RETURNING id`,
          [id, siglas, nombre, regimen, activa, JSON.stringify(puntos), letraMinima, retirada, redondeo, confirmadas],
        )
      : await consultarUna<{ id: string }>(
          `INSERT INTO universidad (siglas, nombre, regimen, activa, puntos_por_letra, letra_minima_aprobar,
                                   retirada_cuenta_en_divisor, redondeo_indice, reglas_confirmadas)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9) RETURNING id`,
          [siglas, nombre, regimen, activa, JSON.stringify(puntos), letraMinima, retirada, redondeo, confirmadas],
        );

    if (!fila) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "universidad.editada" : "universidad.creada",
      entidad: "universidad",
      entidadId: fila.id,
      datos: { siglas, regimen, activa, puntos, letraMinima, retirada, redondeo, confirmadas },
    });
  } catch (error) {
    if (esDuplicado(error)) return { estado: "duplicado" };
    console.error("[universidades] no se pudo guardar la universidad", error);

    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

export async function guardarCarrera(_p: EstadoCatalogo, d: FormData): Promise<EstadoCatalogo> {
  const usuario = await conPermiso("catalogo.escribir");

  if (!usuario) return { estado: "no_permitido" };

  const id = texto(d, "id", 40);
  const universidadId = texto(d, "universidad", 40);
  const nombre = texto(d, "nombre", 160);
  const activa = d.get("activa") !== "no";

  if (!nombre || (id && !UUID.test(id)) || (!id && !UUID.test(universidadId))) return { estado: "dato_invalido" };

  try {
    const fila = id
      ? await consultarUna<{ id: string }>(`UPDATE carrera SET nombre = $2, activa = $3 WHERE id = $1 RETURNING id`, [id, nombre, activa])
      : await consultarUna<{ id: string }>(
          `INSERT INTO carrera (universidad_id, nombre, activa) VALUES ($1, $2, $3) RETURNING id`,
          [universidadId, nombre, activa],
        );

    if (!fila) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "carrera.editada" : "carrera.creada",
      entidad: "carrera",
      entidadId: fila.id,
      datos: { nombre, activa },
    });
  } catch (error) {
    if (esDuplicado(error)) return { estado: "duplicado" };
    // FK a universidad inexistente.
    if ((error as { code?: string }).code === "23503") return { estado: "no_encontrado" };
    console.error("[universidades] no se pudo guardar la carrera", error);

    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

export async function guardarPensum(_p: EstadoCatalogo, d: FormData): Promise<EstadoCatalogo> {
  const usuario = await conPermiso("catalogo.escribir");

  if (!usuario) return { estado: "no_permitido" };

  const id = texto(d, "id", 40);
  const carreraId = texto(d, "carrera", 40);
  const version = texto(d, "version", 40);
  const vigente = d.get("vigente") !== "no";

  if (!version || (id && !UUID.test(id)) || (!id && !UUID.test(carreraId))) return { estado: "dato_invalido" };

  try {
    const fila = id
      ? await consultarUna<{ id: string }>(`UPDATE pensum SET version = $2, vigente = $3 WHERE id = $1 RETURNING id`, [id, version, vigente])
      : await consultarUna<{ id: string }>(
          `INSERT INTO pensum (carrera_id, version, vigente) VALUES ($1, $2, $3) RETURNING id`,
          [carreraId, version, vigente],
        );

    if (!fila) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "pensum.editado" : "pensum.creado",
      entidad: "pensum",
      entidadId: fila.id,
      datos: { version, vigente },
    });
  } catch (error) {
    if (esDuplicado(error)) return { estado: "duplicado" };
    if ((error as { code?: string }).code === "23503") return { estado: "no_encontrado" };
    console.error("[universidades] no se pudo guardar el pénsum", error);

    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Carga una lista pegada de materias en un pénsum. Si el código ya existe se
 * actualiza (así se corrige un crédito pegando de nuevo la lista). Todo en una
 * transacción: o entra la lista legible completa o no entra nada.
 */
export async function cargarMateriasPensum(_p: EstadoCatalogo, d: FormData): Promise<EstadoCatalogo> {
  const usuario = await conPermiso("catalogo.escribir");

  if (!usuario) return { estado: "no_permitido" };

  const pensumId = texto(d, "pensum", 40);
  const lista = String(d.get("lista") ?? "").slice(0, 60_000);

  if (!UUID.test(pensumId)) return { estado: "no_encontrado" };

  const { materias, rechazadas } = leerListaDePensum(lista);

  if (materias.length === 0) return { estado: "dato_invalido", rechazadas };

  try {
    const existe = await enTransaccion(async (cliente) => {
      const { rows } = await cliente.query(`SELECT 1 FROM pensum WHERE id = $1`, [pensumId]);

      if (rows.length === 0) return false;

      for (const m of materias) {
        await cliente.query(
          `INSERT INTO pensum_materia (pensum_id, codigo, nombre, creditos, periodo_sugerido, prerrequisitos)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (pensum_id, codigo)
           DO UPDATE SET nombre = EXCLUDED.nombre, creditos = EXCLUDED.creditos,
                         periodo_sugerido = EXCLUDED.periodo_sugerido, prerrequisitos = EXCLUDED.prerrequisitos`,
          [pensumId, m.codigo, m.nombre, m.creditos, m.periodoSugerido, m.prerrequisitos],
        );
      }

      return true;
    });

    if (!existe) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "pensum.materias_cargadas",
      entidad: "pensum",
      entidadId: pensumId,
      datos: { cargadas: materias.length, rechazadas: rechazadas.length },
    });
  } catch (error) {
    console.error("[universidades] no se pudieron cargar las materias", error);

    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok", cargadas: materias.length, rechazadas };
}

export async function quitarMateriaPensum(_p: EstadoCatalogo, d: FormData): Promise<EstadoCatalogo> {
  const usuario = await conPermiso("catalogo.escribir");

  if (!usuario) return { estado: "no_permitido" };

  const id = texto(d, "id", 40);

  if (!UUID.test(id)) return { estado: "no_encontrado" };

  const fila = await consultarUna<{ pensum_id: string }>(`DELETE FROM pensum_materia WHERE id = $1 RETURNING pensum_id`, [id]);

  if (!fila) return { estado: "no_encontrado" };

  await registrar({ usuarioId: usuario.id, accion: "pensum.materia_quitada", entidad: "pensum", entidadId: fila.pensum_id, datos: { materia: id } });
  refrescar();

  return { estado: "ok" };
}

/**
 * Elige universidad, carrera y pénsum de un estudiante. El servidor valida la
 * cadena —la carrera es de esa universidad y el pénsum de esa carrera— porque
 * los selectores en cascada del navegador no son una garantía. También deja
 * escritas las columnas de texto que el resto del sistema (listados, filtros,
 * reglas de créditos) todavía lee.
 */
export async function vincularCatalogo(_p: EstadoCatalogo, d: FormData): Promise<EstadoCatalogo> {
  const usuario = await conPermiso("expedientes.escribir");

  if (!usuario) return { estado: "no_permitido" };

  const estudianteId = texto(d, "estudiante", 40);
  const universidadId = texto(d, "universidad", 40);
  const carreraId = texto(d, "carrera", 40);
  const pensumId = texto(d, "pensum", 40);
  const matricula = texto(d, "matricula", 40);

  if (!UUID.test(estudianteId)) return { estado: "no_encontrado" };
  // Cada nivel exige el anterior; se permite dejar el catálogo a medias.
  if ((universidadId && !UUID.test(universidadId)) || (carreraId && (!universidadId || !UUID.test(carreraId))) ||
      (pensumId && (!carreraId || !UUID.test(pensumId)))) {
    return { estado: "dato_invalido" };
  }

  try {
    const ok = await enTransaccion(async (cliente) => {
      const { rows } = await cliente.query<{ siglas: string | null; carrera: string | null }>(
        `SELECT (SELECT siglas FROM universidad WHERE id = NULLIF($1, '')::uuid AND activa) AS siglas,
                (SELECT c.nombre FROM carrera c
                  WHERE c.id = NULLIF($2, '')::uuid AND c.universidad_id = NULLIF($1, '')::uuid) AS carrera,
                (SELECT count(*) FROM pensum p WHERE p.id = NULLIF($3, '')::uuid AND p.carrera_id = NULLIF($2, '')::uuid) AS pensum`,
        [universidadId, carreraId, pensumId],
      );
      const f = rows[0] as { siglas: string | null; carrera: string | null; pensum: string };

      if ((universidadId && !f.siglas) || (carreraId && !f.carrera) || (pensumId && f.pensum !== "1")) return false;

      const r = await cliente.query(
        `UPDATE estudiante
            SET universidad_id = NULLIF($2, '')::uuid, carrera_id = NULLIF($3, '')::uuid,
                pensum_id = NULLIF($4, '')::uuid, matricula = NULLIF($5, ''),
                universidad = COALESCE($6, universidad), programa = COALESCE($7, programa)
          WHERE id = $1`,
        [estudianteId, universidadId, carreraId, pensumId, matricula, f.siglas, f.carrera],
      );

      return (r.rowCount ?? 0) > 0 ? true : null;
    });

    if (ok === null) return { estado: "no_encontrado" };
    if (!ok) return { estado: "dato_invalido" };

    await registrar({
      usuarioId: usuario.id,
      accion: "expediente.catalogo_vinculado",
      entidad: "estudiante",
      entidadId: estudianteId,
      datos: { universidadId, carreraId, pensumId },
    });
  } catch (error) {
    console.error("[universidades] no se pudo vincular el catálogo", error);

    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}
