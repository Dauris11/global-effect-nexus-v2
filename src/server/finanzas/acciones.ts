"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { esCategoria, esTipoTransaccion } from "@/lib/finanzas";
import { tienePermiso } from "@/lib/rbac";

/**
 * Alta, corrección y borrado de movimientos.
 *
 * Una sola puerta: `finanzas.escribir`, que tienen `contabilidad` y
 * `super_admin`. `admin` (coordinación) **no tiene ni `finanzas.leer`**: no
 * entra a la pantalla, así que aquí no hay ningún caso intermedio de "ve pero
 * no toca" como sí lo hay en patrocinadores.
 *
 * EL MONTO NO SE TOCA EN JAVASCRIPT. Llega como texto del formulario, se
 * comprueba que sea un número mayor que cero —el CHECK de la 0011 lo exige— y
 * se manda como parámetro para que la base lo guarde como NUMERIC. No se
 * redondea, no se multiplica por cien, no se reformatea: cualquiera de esas
 * cosas convierte "1234.56" en un centavo de diferencia que después nadie sabe
 * de dónde salió.
 *
 * SÍ HAY BORRADO, y es la excepción a la costumbre del proyecto. En
 * patrocinadores y en proyectos no se borra porque hay un estado al que
 * retirarlos (`inactivo`, `pausado`) y porque otras filas cuelgan de ellos. Un
 * movimiento no tiene ni una cosa ni la otra: nada le cuelga, y una
 * transacción teclateada dos veces por error no se puede "desactivar" —el
 * duplicado seguiría sumando en el balance—. Lo que se hace en su lugar es
 * guardar la fila entera en `audit_log` ANTES de borrarla, así que el
 * movimiento sale de la contabilidad pero no desaparece del rastro.
 */

export type EstadoTransaccion = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "concepto_vacio"
    | "monto_invalido"
    | "fecha_invalida"
    | "error";
};

/** Alta y corrección. Con `id` vacío, es un alta. */
export async function guardarTransaccion(
  _previo: EstadoTransaccion,
  datos: FormData,
): Promise<EstadoTransaccion> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "finanzas.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const concepto = String(datos.get("concepto") ?? "")
    .trim()
    .slice(0, 200);
  const tipo = String(datos.get("tipo") ?? "ingreso");
  const categoria = String(datos.get("categoria") ?? "otro");
  const fecha = String(datos.get("fecha") ?? "").trim();
  const referencia = String(datos.get("referencia") ?? "")
    .trim()
    .slice(0, 120);
  const notas = String(datos.get("notas") ?? "")
    .trim()
    .slice(0, 900);
  const montoTexto = String(datos.get("monto") ?? "").trim();

  if (!concepto) return { estado: "concepto_vacio" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };

  // El CHECK de la tabla es `monto > 0`: el signo lo lleva el TIPO, no el
  // número. Un egreso de -50 y un ingreso de 50 serían la misma fila con dos
  // significados opuestos, así que se rechaza el negativo aquí en vez de
  // dejar que la base devuelva un error que no dice nada.
  const monto = Number(montoTexto);

  if (!Number.isFinite(monto) || monto <= 0) {
    return { estado: "monto_invalido" };
  }

  // `fecha` es DATE NOT NULL con DEFAULT CURRENT_DATE. Vacía se deja en manos
  // del default; puesta, tiene que ser una fecha real: un "2026-02-31" llegaría
  // a la base como error de sintaxis y rompería la acción.
  if (fecha && !esFechaIso(fecha)) return { estado: "fecha_invalida" };

  const tipoOk = esTipoTransaccion(tipo) ? tipo : "ingreso";
  const categoriaOk = esCategoria(categoria) ? categoria : "otro";

  try {
    const guardado = id
      ? await consultarUna<{ id: string }>(
          `UPDATE transaccion
              SET concepto = $2,
                  tipo = $3::tipo_transaccion,
                  monto = $4,
                  categoria = $5,
                  fecha = coalesce(NULLIF($6, '')::date, fecha),
                  referencia = NULLIF($7, ''),
                  notas = NULLIF($8, '')
            WHERE id = $1
          RETURNING id`,
          [
            id,
            concepto,
            tipoOk,
            monto,
            categoriaOk,
            fecha,
            referencia,
            notas,
          ],
        )
      : await consultarUna<{ id: string }>(
          `INSERT INTO transaccion
                  (concepto, tipo, monto, categoria, fecha, referencia, notas)
           VALUES ($1, $2::tipo_transaccion, $3, $4,
                   coalesce(NULLIF($5, '')::date, CURRENT_DATE),
                   NULLIF($6, ''), NULLIF($7, ''))
           RETURNING id`,
          [concepto, tipoOk, monto, categoriaOk, fecha, referencia, notas],
        );

    if (!guardado) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "transaccion.editada" : "transaccion.creada",
      entidad: "transaccion",
      entidadId: guardado.id,
      // El monto y el tipo van al rastro: son lo que mueve el balance. Las
      // notas no, que es donde se escribe de quién vino una donación.
      datos: { concepto, tipo: tipoOk, monto, categoria: categoriaOk },
    });
  } catch (error) {
    console.error("[finanzas] no se pudo guardar el movimiento", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Borra un movimiento, dejándolo escrito en el rastro.
 *
 * El `RETURNING` trae la fila completa y se anota ANTES de responder: es la
 * única copia que queda. Si el registro de auditoría fallara —`registrar()` no
 * lanza nunca, por diseño— el movimiento ya estaría borrado, y eso es
 * aceptable aquí y no en expedientes: lo que se pierde es una línea de un
 * balance que se puede volver a teclear, no el rastro de quién leyó la ficha
 * de un menor.
 */
export async function eliminarTransaccion(
  _previo: EstadoTransaccion,
  datos: FormData,
): Promise<EstadoTransaccion> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "finanzas.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();

  if (!esUuid(id)) return { estado: "no_encontrado" };

  try {
    const borrado = await consultarUna<{
      id: string;
      concepto: string;
      tipo: string;
      monto: string;
      categoria: string;
      fecha: string;
    }>(
      `DELETE FROM transaccion
             WHERE id = $1
         RETURNING id, concepto, tipo::text AS tipo, monto::text AS monto,
                   categoria, fecha::text AS fecha`,
      [id],
    );

    if (!borrado) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "transaccion.eliminada",
      entidad: "transaccion",
      entidadId: borrado.id,
      // `monto` va como TEXTO, tal como lo devuelve la base. Es la copia de
      // seguridad de la fila: convertirla a número aquí para volver a
      // escribirla en un JSON solo añade una ocasión de perder un centavo.
      datos: {
        concepto: borrado.concepto,
        tipo: borrado.tipo,
        monto: borrado.monto,
        categoria: borrado.categoria,
        fecha: borrado.fecha,
      },
    });
  } catch (error) {
    console.error("[finanzas] no se pudo borrar el movimiento", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Las pantallas que cambian cuando cambia un movimiento.
 *
 * El panel general y el portal de contabilidad enseñan el balance del mes, así
 * que se refrescan los tres. `/reportes` también, que dibuja las mismas cifras
 * en gráficas.
 */
function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "page");
  revalidatePath("/[locale]/portal/contabilidad", "page");
  revalidatePath("/[locale]/reportes", "page");
  revalidatePath("/[locale]/dashboard", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

/**
 * `YYYY-MM-DD` y además existente.
 *
 * El patrón solo no basta: "2026-02-31" lo cumple y no es un día. Se construye
 * la fecha y se comprueba que al volver a escribirla dé el mismo texto, que es
 * lo que descarta los desbordes de mes.
 */
function esFechaIso(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;

  const fecha = new Date(`${valor}T00:00:00Z`);

  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === valor
  );
}
