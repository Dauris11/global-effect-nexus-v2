"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna } from "@/lib/db";
import { validarPeriodo, type PeriodoExistente } from "@/lib/periodos";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";

/**
 * Alta, edición y baja del catálogo académico: períodos y materias.
 *
 * Las notas no están aquí: la única que pone la Fundación es la final de 360, y
 * vive en `@/server/profesor/acciones` con `calificaciones.registrar`, porque
 * `admin` monta el catálogo pero **no pone notas** y el docente pone notas pero
 * **no toca el catálogo**.
 *
 * EL CATÁLOGO. Una sola puerta: `academico.escribir`, que hoy tienen `admin` y
 * `super_admin`. Aquí no hay dueño: un período es de la institución, y una materia
 * de la carrera la abre coordinación. El docente tiene `academico.leer` y ve el
 * catálogo; no lo toca.
 *
 * BORRAR ES LO PELIGROSO. Las dos tablas cuelgan de claves ajenas en cascada:
 * borrar un período se lleva sus inscripciones, y borrar una materia se lleva
 * su matrícula y sus tareas con las entregas dentro. Por eso ninguna de las dos
 * bajas borra a ciegas: se cuentan las dependencias primero y, si hay alguna,
 * se devuelve `tiene_datos` con el detalle para que la pantalla diga qué se
 * perdería. Para retirar algo que ya se usó están los estados —`completado` en
 * un período, `inactiva` en una materia—, que es lo que la interfaz propone.
 */

export type EstadoCatalogo = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "nombre_vacio"
    | "fechas_faltan"
    | "fin_antes_de_inicio"
    | "tipo_invalido"
    | "anio_distinto"
    | "traslape"
    | "demasiados_en_anio"
    | "duplicado"
    | "tiene_datos"
    | "faltan_campos"
    | "nota_invalida"
    | "invalido"
    | "error";
  /**
   * Qué cuelga de lo que se intentó borrar, por clave de `rowActions.deps`.
   * Solo viaja con `tiene_datos`: la pantalla enumera lo que se perdería en
   * lugar de decir un "no se puede" sin explicación.
   */
  dependencias?: Record<string, number>;
};

const ESTADOS_PERIODO = ["planificado", "activo", "completado"];
const ESTADOS_MATERIA = ["activa", "inactiva"];

/** Violación de UNIQUE en PostgreSQL. `periodo.nombre` es único (0006). */
const UNIQUE_VIOLATION = "23505";

// ────────────────────────────────────────────────────────────────────────────
// Períodos
// ────────────────────────────────────────────────────────────────────────────

/** Alta y edición de un período. Con `id` vacío, es un alta. */
export async function guardarPeriodo(
  _previo: EstadoCatalogo,
  datos: FormData,
): Promise<EstadoCatalogo> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 60);
  const inicio = String(datos.get("inicio") ?? "").trim();
  const fin = String(datos.get("fin") ?? "").trim();
  const tipo = String(datos.get("tipo") ?? "cuatrimestre");
  const estado = String(datos.get("estado") ?? "planificado");

  if (!nombre) return { estado: "nombre_vacio" };
  if (!inicio || !fin) return { estado: "fechas_faltan" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };

  // Desplegables que se pueden manipular en el navegador: se comprueban aquí.
  const estadoOk = ESTADOS_PERIODO.includes(estado) ? estado : "planificado";

  // Las reglas del cuatrimestre (tipo, fechas, mismo año, sin traslape, máximo
  // por año) viven en `validarPeriodo`. Se corren antes de escribir para poder
  // decir cuál falla; el CHECK de la tabla solo sabe de fin >= inicio.
  const existentes = await consultar<PeriodoExistente>(
    `SELECT id, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
            to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin
       FROM periodo`,
  );
  const error = validarPeriodo(
    { id: id || null, tipo, fecha_inicio: inicio, fecha_fin: fin },
    existentes,
  );
  if (error === "fechas_invalidas") return { estado: "fechas_faltan" };
  if (error) return { estado: error };
  const tipoOk = tipo;

  try {
    if (id) {
      const editado = await consultarUna<{ id: string }>(
        `UPDATE periodo
            SET nombre = $2, fecha_inicio = $3::date, fecha_fin = $4::date,
                tipo = $5, estado = $6
          WHERE id = $1
        RETURNING id`,
        [id, nombre, inicio, fin, tipoOk, estadoOk],
      );

      if (!editado) return { estado: "no_encontrado" };

      await anotar(usuario.id, "periodo", "periodo.editado", editado.id, {
        nombre,
        estado: estadoOk,
      });
    } else {
      const creado = await consultarUna<{ id: string }>(
        `INSERT INTO periodo (nombre, fecha_inicio, fecha_fin, tipo, estado)
         VALUES ($1, $2::date, $3::date, $4, $5)
         RETURNING id`,
        [nombre, inicio, fin, tipoOk, estadoOk],
      );

      if (!creado) return { estado: "error" };

      await anotar(usuario.id, "periodo", "periodo.creado", creado.id, {
        nombre,
      });
    }
  } catch (error) {
    if (esViolacionDeUnico(error)) return { estado: "duplicado" };

    console.error("[academico] no se pudo guardar el período", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Borra un período, y solo si no cuelga nada de él.
 *
 * `inscripcion.periodo_id` e `inscripcion_360.periodo_id` son ON DELETE
 * CASCADE: borrar un cuatrimestre con matrícula se llevaría por delante las
 * inscripciones —y las notas de 360— de todos sus estudiantes sin avisar. Las
 * materias solo perderían la referencia (SET NULL), pero quedarían huérfanas de
 * calendario, que tampoco es un estado en el que dejar el catálogo.
 */
export async function eliminarPeriodo(
  _previo: EstadoCatalogo,
  datos: FormData,
): Promise<EstadoCatalogo> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrado" };

  const ocupado = await consultarUna<{
    subjects: number;
    enrollments360: number;
    enrollments: number;
  }>(
    `SELECT (SELECT count(*)::int FROM materia     WHERE periodo_id = $1) AS subjects,
            (SELECT count(*)::int FROM inscripcion_360 WHERE periodo_id = $1) AS enrollments360,
            (SELECT count(*)::int FROM inscripcion WHERE periodo_id = $1) AS enrollments`,
    [id],
  );

  const dependencias = soloLoQueTieneAlgo(ocupado);

  if (dependencias) return { estado: "tiene_datos", dependencias };

  const borrado = await consultarUna<{ id: string; nombre: string }>(
    `DELETE FROM periodo WHERE id = $1 RETURNING id, nombre`,
    [id],
  );

  if (!borrado) return { estado: "no_encontrado" };

  await anotar(usuario.id, "periodo", "periodo.eliminado", borrado.id, {
    nombre: borrado.nombre,
  });

  refrescar();

  return { estado: "ok" };
}

// ────────────────────────────────────────────────────────────────────────────
// Materias
// ────────────────────────────────────────────────────────────────────────────

/**
 * Alta y edición de una materia universitaria.
 *
 * El profesor llega en UN campo, `profesor`, con dos formas posibles: el id de
 * un usuario, o `externo` acompañado de `profesor_externo` con el nombre
 * escrito a mano. Van juntos y no en dos campos independientes porque son
 * excluyentes: con dos campos, un formulario manipulado podría mandar los dos y
 * dejar la fila diciendo que la materia es de un usuario y de otra persona a la
 * vez.
 *
 * En los dos casos se guarda `profesor_nombre` —es lo que se muestra— y solo en
 * el primero se rellena `profesor_usuario_id`, que es lo que decide de quién es
 * la materia en el portal del docente (migración 0019).
 */
export async function guardarMateria(
  _previo: EstadoCatalogo,
  datos: FormData,
): Promise<EstadoCatalogo> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 160);
  const codigo = String(datos.get("codigo") ?? "").trim().slice(0, 30);
  const descripcion = String(datos.get("descripcion") ?? "").trim().slice(0, 600);
  const horario = String(datos.get("horario") ?? "").trim().slice(0, 120);
  const aula = String(datos.get("aula") ?? "").trim().slice(0, 60);
  const estado = String(datos.get("estado") ?? "activa");
  const creditos = Number(datos.get("creditos") ?? 3);
  const periodoId = String(datos.get("periodo") ?? "").trim();
  const profesor = String(datos.get("profesor") ?? "").trim();
  const profesorExterno = String(datos.get("profesor_externo") ?? "")
    .trim()
    .slice(0, 120);

  if (!nombre) return { estado: "nombre_vacio" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };
  if (periodoId && !esUuid(periodoId)) return { estado: "invalido" };

  const estadoOk = ESTADOS_MATERIA.includes(estado) ? estado : "activa";
  const creditosOk =
    Number.isFinite(creditos) && creditos >= 0 ? Math.min(creditos, 20) : 0;

  // Las tres formas del campo de profesor: un usuario, alguien externo, o nadie.
  let profesorUsuarioId: string | null = null;
  let profesorNombre: string | null = null;

  if (profesor === "externo") {
    profesorNombre = profesorExterno || null;
  } else if (profesor) {
    if (!esUuid(profesor)) return { estado: "invalido" };

    // El nombre se copia del usuario y no llega del formulario: si viniera del
    // navegador, la fila podría acabar con el id de una persona y el nombre de
    // otra, y entonces la columna de texto dejaría de servir como registro
    // histórico, que es justo para lo que la 0019 la conservó.
    const elegido = await consultarUna<{ nombre: string }>(
      `SELECT nombre FROM usuario WHERE id = $1 AND activo`,
      [profesor],
    );

    if (!elegido) return { estado: "invalido" };

    profesorUsuarioId = profesor;
    profesorNombre = elegido.nombre;
  }

  try {
    if (id) {
      const editado = await consultarUna<{ id: string }>(
        `UPDATE materia
            SET nombre = $2, codigo = NULLIF($3, ''), descripcion = NULLIF($4, ''),
                horario = NULLIF($5, ''), aula = NULLIF($6, ''), estado = $7,
                creditos = $8, periodo_id = NULLIF($9, '')::uuid,
                profesor_nombre = $10, profesor_usuario_id = $11
          WHERE id = $1
        RETURNING id`,
        [id, nombre, codigo, descripcion, horario, aula, estadoOk, creditosOk,
         periodoId, profesorNombre, profesorUsuarioId],
      );

      if (!editado) return { estado: "no_encontrado" };

      await anotar(usuario.id, "materia", "materia.editada", editado.id, {
        nombre,
        estado: estadoOk,
      });
    } else {
      const creada = await consultarUna<{ id: string }>(
        `INSERT INTO materia
                (nombre, codigo, descripcion, horario, aula, estado, creditos,
                 periodo_id, profesor_nombre, profesor_usuario_id)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''),
                 $6, $7, NULLIF($8, '')::uuid, $9, $10)
         RETURNING id`,
        [nombre, codigo, descripcion, horario, aula, estadoOk, creditosOk,
         periodoId, profesorNombre, profesorUsuarioId],
      );

      if (!creada) return { estado: "error" };

      await anotar(usuario.id, "materia", "materia.creada", creada.id, {
        nombre,
      });
    }
  } catch (error) {
    console.error("[academico] no se pudo guardar la materia", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Borra una materia, y solo si nadie la cursa ni tiene tareas.
 *
 * `inscripcion.materia_id` y `asignacion.materia_id` son ON DELETE CASCADE, y
 * de la asignación cuelgan las entregas: borrar una materia con tareas se
 * llevaría el trabajo entregado por los estudiantes. El historial académico sí
 * sobrevive —`historial_calificacion` guarda el nombre de la materia como
 * texto, no como referencia—, y por eso el aviso de la pantalla lo dice.
 */
export async function eliminarMateria(
  _previo: EstadoCatalogo,
  datos: FormData,
): Promise<EstadoCatalogo> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "academico.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrado" };

  const ocupada = await consultarUna<{ enrollments: number; tasks: number }>(
    `SELECT (SELECT count(*)::int FROM inscripcion WHERE materia_id = $1) AS enrollments,
            (SELECT count(*)::int FROM asignacion  WHERE materia_id = $1) AS tasks`,
    [id],
  );

  const dependencias = soloLoQueTieneAlgo(ocupada);

  if (dependencias) return { estado: "tiene_datos", dependencias };

  const borrada = await consultarUna<{ id: string; nombre: string }>(
    `DELETE FROM materia WHERE id = $1 RETURNING id, nombre`,
    [id],
  );

  if (!borrada) return { estado: "no_encontrado" };

  await anotar(usuario.id, "materia", "materia.eliminada", borrada.id, {
    nombre: borrada.nombre,
  });

  refrescar();

  return { estado: "ok" };
}

// ────────────────────────────────────────────────────────────────────────────
// Ayudantes
// ────────────────────────────────────────────────────────────────────────────

/**
 * Deja solo las dependencias con al menos una fila, o `undefined` si no hay
 * ninguna. Devolver el objeto entero con ceros obligaría a la pantalla a
 * filtrarlos, y un "0 inscripciones" en la lista de motivos para no borrar es
 * exactamente lo contrario de lo que se quiere decir.
 */
function soloLoQueTieneAlgo(
  conteos: Record<string, number> | null,
): Record<string, number> | undefined {
  if (!conteos) return undefined;

  const conAlgo = Object.entries(conteos).filter(([, cuantos]) => cuantos > 0);

  return conAlgo.length > 0 ? Object.fromEntries(conAlgo) : undefined;
}

function anotar(
  usuarioId: string,
  entidad: string,
  accion: string,
  entidadId: string,
  extra?: Record<string, unknown>,
) {
  return registrar({ usuarioId, accion, entidad, entidadId, datos: extra });
}

/**
 * Las pantallas que cambian al tocar el catálogo.
 *
 * Son más de las dos obvias: la prematrícula ofrece el período en un
 * desplegable, y el portal del estudiante lista sus materias con
 * el nombre y el horario que se acaban de editar. Dejarlas fuera haría que un
 * cambio tardara en verse sin ninguna razón visible.
 */
function refrescar() {
  revalidatePath("/[locale]/academico/periodos", "page");
  revalidatePath("/[locale]/academico/materias", "page");
  revalidatePath("/[locale]/academico/clases-360", "page");
  revalidatePath("/[locale]/academico/prematricula", "page");
  revalidatePath("/[locale]/portal/estudiante/prematricula", "page");
  revalidatePath("/[locale]/portal/profesor", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

function esViolacionDeUnico(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}
