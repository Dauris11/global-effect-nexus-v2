"use server";

import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";

import { registrar } from "@/lib/auditoria";
import { requerirRol, requerirUsuario } from "@/lib/auth";
import { enTransaccion, fijarContexto } from "@/lib/db";
import { contextoDe } from "@/server/contabilidad/sesion";
import type { Permiso } from "@/lib/rbac";
import { borrarDocumento, subirMaterial } from "@/lib/supabase/almacen";
import {
  accionesPermitidas,
  FORMATOS_COTIZACION,
  MAXIMO_COTIZACION_BYTES,
  esAccionSolicitud,
  esTramiteEstudiante,
  estadoTrasAccion,
  HORAS_CITA,
  MAXIMO_TEXTO,
  MAXIMO_TITULO,
  REGLAS,
  type TipoSolicitud,
  tiposQuePuedeCrear,
} from "@/lib/solicitudes";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { solicitudParaFlujo } from "@/server/solicitudes/consultas";

/**
 * Escritura de solicitudes (migración 0031).
 *
 * CADA PASO ES UNA TRANSACCIÓN CON TRES ESCRITURAS: el cambio de estado en
 * `solicitud`, la línea en `solicitud_paso` y el aviso en `notificacion`. Son
 * una sola cosa: un estado sin su paso deja la línea de tiempo mintiendo, y un
 * paso sin aviso deja al solicitante esperando algo que ya se decidió.
 *
 * EL CAMBIO DE ESTADO LLEVA EL ESTADO ANTERIOR EN EL WHERE. Dos revisores con
 * la bandeja abierta pueden pulsar a la vez; el segundo UPDATE no encuentra la
 * fila en el estado que vio y se le responde "ya la movió otra persona", en vez
 * de aprobar dos veces o pisar un rechazo.
 *
 * Los avisos son datos y no interfaz, igual que en tareas: el folio y el
 * título. La campana traduce el `tipo` del aviso, no la frase.
 */

export type EstadoFormularioSolicitud = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "sin_expediente"
    | "invalido"
    | "fecha_invalida"
    | "duplicada"
    | "sin_archivo"
    | "formato_no_admitido"
    | "muy_grande"
    | "error";
};

export type EstadoPasoSolicitud = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "ya_cambio"
    | "falta_comentario"
    | "invalido"
    | "error";
};

/**
 * Trámite pedido por el estudiante desde su portal.
 *
 * El estudiante sale de la sesión, nunca del formulario: si viniera de un campo,
 * cualquiera podría pedir una constancia a nombre de otro.
 *
 * Un trámite abierto del mismo tipo a la vez. Sin ese tope, un doble clic deja
 * dos constancias en la bandeja y quien revisa no sabe cuál vale.
 */
export async function crearTramite(
  _previo: EstadoFormularioSolicitud,
  datos: FormData,
): Promise<EstadoFormularioSolicitud> {
  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const tipo = String(datos.get("tipo") ?? "");
  if (!esTramiteEstudiante(tipo)) return { estado: "invalido" };

  const campos = leerCampos(datos, tipo);
  if (campos === "invalido" || campos === "fecha_invalida") {
    return { estado: campos };
  }

  try {
    const resultado = await enTransaccion(async (cliente) => {
      const abierta = await cliente.query(
        `SELECT 1 FROM solicitud
          WHERE solicitante_id = $1 AND tipo = $2
            AND estado IN ('enviada', 'en_revision', 'pendiente_direccion')
          LIMIT 1`,
        [usuario.id, tipo],
      );

      if (abierta.rowCount) return "duplicada" as const;

      await insertarSolicitud(cliente, {
        tipo,
        ...campos,
        solicitanteId: usuario.id,
        estudianteId: estudiante.id,
        requiereDireccion: false,
      });

      return "ok" as const;
    });

    if (resultado === "duplicada") return { estado: "duplicada" };
  } catch (error) {
    if (error instanceof FechaPasada) return { estado: "fecha_invalida" };
    console.error("[solicitudes] no se pudo registrar el trámite", error);
    return { estado: "error" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "solicitud.creada",
    entidad: "solicitud",
    datos: { tipo },
  });

  refrescar();
  return { estado: "ok" };
}

/**
 * Solicitud interna del personal: alta de expediente, beca o gasto.
 *
 * Quién puede pedir qué lo dice `tiposQuePuedeCrear`, la misma función que
 * decide qué opciones salen en el desplegable. El segundo nivel se calcula aquí
 * y se guarda: `requiere_direccion` no se vuelve a evaluar después.
 */
export async function crearSolicitudInterna(
  _previo: EstadoFormularioSolicitud,
  datos: FormData,
): Promise<EstadoFormularioSolicitud> {
  const usuario = await requerirUsuario();

  const tipo = String(datos.get("tipo") ?? "");
  const permitidos: readonly string[] = tiposQuePuedeCrear(usuario);

  if (!permitidos.includes(tipo)) return { estado: "no_permitido" };

  const tipoValido = tipo as TipoSolicitud;
  const campos = leerCampos(datos, tipoValido);
  if (campos === "invalido" || campos === "fecha_invalida") {
    return { estado: campos };
  }

  const regla = REGLAS[tipoValido];
  const estudianteId = String(datos.get("estudiante") ?? "").trim();

  if (regla.estudiante === "obligatorio" && !esUuid(estudianteId)) {
    return { estado: "invalido" };
  }

  try {
    const resultado = await enTransaccion(async (cliente) => {
      if (regla.estudiante !== "no" && esUuid(estudianteId)) {
        const existe = await cliente.query(
          `SELECT 1 FROM estudiante WHERE id = $1`,
          [estudianteId],
        );
        if (!existe.rowCount) return "invalido" as const;
      }

      await insertarSolicitud(cliente, {
        tipo: tipoValido,
        ...campos,
        solicitanteId: usuario.id,
        estudianteId: regla.estudiante !== "no" && esUuid(estudianteId) ? estudianteId : null,
        requiereDireccion: regla.direccion(campos.monto),
      });

      return "ok" as const;
    });

    if (resultado === "invalido") return { estado: "invalido" };
  } catch (error) {
    if (error instanceof FechaPasada) return { estado: "fecha_invalida" };
    console.error("[solicitudes] no se pudo registrar la solicitud", error);
    return { estado: "error" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "solicitud.creada",
    entidad: "solicitud",
    datos: { tipo: tipoValido },
  });

  refrescar();
  return { estado: "ok" };
}

/**
 * Solicitud de compra a contabilidad con cotización adjunta (migración 0070).
 *
 * La puede pedir CUALQUIER usuario con sesión, de cualquier rol: no hay
 * `tiposQuePuedeCrear` aquí a propósito. Lo que protege el flujo es quién
 * DECIDE (`contabilidad.aprobar`, y nunca quien la pidió), no quién pide.
 *
 * La cotización es obligatoria y se valida entera en el servidor —extensión,
 * tipo declarado y tamaño—: el `accept` del input solo es una ayuda. Se sube
 * ANTES de la transacción porque la ruta no depende del id de la solicitud
 * (lleva un UUID propio, nunca el nombre del archivo), y si la transacción
 * falla se borra el archivo para no dejar huérfanos en el bucket.
 */
export async function crearCompra(
  _previo: EstadoFormularioSolicitud,
  datos: FormData,
): Promise<EstadoFormularioSolicitud> {
  const usuario = await requerirUsuario();

  const campos = leerCampos(datos, "compra");
  if (campos === "invalido" || campos === "fecha_invalida") {
    return { estado: campos };
  }

  const archivo = datos.get("cotizacion");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { estado: "sin_archivo" };
  }

  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(extension in FORMATOS_COTIZACION)) return { estado: "formato_no_admitido" };
  if (archivo.type && archivo.type !== FORMATOS_COTIZACION[extension]) {
    return { estado: "formato_no_admitido" };
  }
  if (archivo.size > MAXIMO_COTIZACION_BYTES) return { estado: "muy_grande" };

  const formato = extension === "jpeg" ? "jpg" : extension;
  const ruta = `compras/${crypto.randomUUID()}.${formato}`;

  const subida = await subirMaterial(ruta, archivo);
  if (!subida.ok) return { estado: "error" };

  try {
    await enTransaccion(async (cliente) => {
      const id = await insertarSolicitud(cliente, {
        tipo: "compra",
        ...campos,
        solicitanteId: usuario.id,
        estudianteId: null,
        requiereDireccion: false,
      });

      await cliente.query(
        `INSERT INTO solicitud_adjunto
           (solicitud_id, ruta, nombre, formato, tamano_bytes, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, ruta, archivo.name.slice(0, 200), formato, archivo.size, usuario.id],
      );
    });
  } catch (error) {
    await borrarDocumento(ruta);
    console.error("[solicitudes] no se pudo registrar la compra", error);
    return { estado: "error" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "solicitud.creada",
    entidad: "solicitud",
    datos: { tipo: "compra" },
  });

  refrescar();
  return { estado: "ok" };
}

/**
 * Un paso del flujo: tomar, aprobar, aprobar en dirección, rechazar, completar
 * o cancelar.
 *
 * Rechazar exige comentario: un "no" sin motivo es la respuesta que más
 * llamadas genera después. El resto lo admite y no lo pide.
 */
export async function avanzarSolicitud(
  _previo: EstadoPasoSolicitud,
  datos: FormData,
): Promise<EstadoPasoSolicitud> {
  const usuario = await requerirUsuario();

  const id = String(datos.get("id") ?? "");
  const accion = String(datos.get("accion") ?? "");
  const comentario = String(datos.get("comentario") ?? "").trim().slice(0, MAXIMO_TEXTO);

  if (!esUuid(id) || !esAccionSolicitud(accion)) return { estado: "invalido" };
  // `rechazar` es la ÚNICA vía de rechazo, también la del segundo nivel
  // (dirección rechaza con esta misma acción), así que este es el único sitio
  // donde hay que exigir el motivo.
  if (accion === "rechazar" && !comentario) return { estado: "falta_comentario" };

  const solicitud = await solicitudParaFlujo(id);
  if (!solicitud) return { estado: "no_encontrado" };

  if (!accionesPermitidas(solicitud, usuario).includes(accion)) {
    return { estado: "no_permitido" };
  }

  const nuevo = estadoTrasAccion(accion, solicitud.requiere_direccion);
  const contexto = await contextoDe(usuario);
  const cierra = nuevo === "rechazada" || nuevo === "completada" || nuevo === "cancelada";

  try {
    const movida = await enTransaccion(async (cliente) => {
      const actualizada = await cliente.query(
        `UPDATE solicitud
            SET estado = $3,
                responsable_id = CASE WHEN $4 THEN $5::uuid ELSE responsable_id END,
                respuesta = coalesce(NULLIF($6, ''), respuesta),
                resuelta_en = CASE WHEN $7 THEN now() ELSE resuelta_en END
          WHERE id = $1 AND estado = $2`,
        [
          id,
          solicitud.estado,
          nuevo,
          // Quien la toma queda como responsable; los pasos siguientes no lo
          // cambian, para que el solicitante sepa siempre con quién habla.
          accion === "tomar",
          usuario.id,
          // Lo que se le dice al solicitante. La cancelación es suya y no es
          // una respuesta para nadie.
          accion === "cancelar" ? "" : comentario,
          cierra,
        ],
      );

      if (!actualizada.rowCount) return false;

      await cliente.query(
        `INSERT INTO solicitud_paso
           (solicitud_id, estado_anterior, estado_nuevo, comentario, usuario_id)
         VALUES ($1, $2, $3, NULLIF($4, ''), $5)`,
        [id, solicitud.estado, nuevo, comentario, usuario.id],
      );

      // Un gasto aprobado en su ÚLTIMO nivel nace como cuenta por pagar en
      // contabilidad (§4.5), en esta misma transacción: si la aprobación se
      // deshace, la deuda también. La bitácora contable exige identidad,
      // así que se fija aquí, dentro de la transacción ya abierta.
      if (nuevo === "aprobada" && solicitud.tipo === "gasto") {
        await fijarContexto(cliente, contexto);
        await cliente.query(`SELECT contabilidad.crear_cxp_desde_solicitud($1)`, [id]);
      }

      const aviso = `#${solicitud.folio} · ${solicitud.titulo}`;

      // Al solicitante, salvo que el paso sea suyo.
      if (solicitud.solicitante_id && solicitud.solicitante_id !== usuario.id) {
        await cliente.query(
          `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
           SELECT u.id, $2, $3, 'solicitud', $4
             FROM usuario u
            WHERE u.id = $1 AND u.activo`,
          [
            solicitud.solicitante_id,
            aviso,
            comentario || nuevo,
            await enlaceDelSolicitante(cliente, solicitud.solicitante_id),
          ],
        );
      }

      // Al pasar a dirección, a quien decide el segundo nivel.
      if (nuevo === "pendiente_direccion") {
        await avisarA(cliente, "solicitudes.direccion", aviso, nuevo, usuario.id);
      }

      return true;
    });

    if (!movida) return { estado: "ya_cambio" };
  } catch (error) {
    console.error("[solicitudes] no se pudo avanzar la solicitud", error);
    return { estado: "error" };
  }

  // Las decisiones van a auditoría. Tomar y cancelar no deciden nada.
  if (accion !== "tomar" && accion !== "cancelar") {
    await registrar({
      usuarioId: usuario.id,
      accion: `solicitud.${nuevo}`,
      entidad: "solicitud",
      entidadId: id,
      datos: { folio: solicitud.folio, tipo: solicitud.tipo, desde: solicitud.estado },
    });
  }

  refrescar();
  return { estado: "ok" };
}

type Campos = {
  titulo: string;
  detalle: string | null;
  monto: number | null;
  fecha: string | null;
  hora: string | null;
};

/**
 * Lee y valida los campos comunes según las reglas del tipo.
 *
 * Los desplegables y las fechas se vuelven a comprobar aquí: el navegador se
 * puede manipular. La fecha pasada se rechaza en la base, no en Node, para no
 * depender de la zona horaria del proceso; aquí solo se mira el formato.
 */
function leerCampos(
  datos: FormData,
  tipo: TipoSolicitud,
): Campos | "invalido" | "fecha_invalida" {
  const regla = REGLAS[tipo];

  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, MAXIMO_TITULO);
  const detalle = String(datos.get("detalle") ?? "").trim().slice(0, MAXIMO_TEXTO);
  const fecha = String(datos.get("fecha") ?? "").trim();
  const hora = String(datos.get("hora") ?? "").trim();
  const montoTexto = String(datos.get("monto") ?? "").trim();

  if (!titulo) return "invalido";

  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "fecha_invalida";
  if (regla.fecha === "obligatorio" && !fecha) return "fecha_invalida";

  if (hora && !(HORAS_CITA as readonly string[]).includes(hora)) return "invalido";

  let monto: number | null = null;
  if (regla.monto !== "no" && montoTexto) {
    monto = Number(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0 || monto >= 1e10) return "invalido";
    monto = Math.round(monto * 100) / 100;
  }
  if (regla.monto === "obligatorio" && monto === null) return "invalido";

  return {
    titulo,
    detalle: detalle || null,
    monto,
    fecha: regla.fecha === "no" ? null : fecha || null,
    // La hora solo tiene sentido en la cita.
    hora: tipo === "cita_administracion" ? hora || null : null,
  };
}

async function insertarSolicitud(
  cliente: PoolClient,
  datos: Campos & {
    tipo: TipoSolicitud;
    solicitanteId: string;
    estudianteId: string | null;
    requiereDireccion: boolean;
  },
): Promise<string> {
  const fila = await cliente.query<{ id: string; folio: number; pasada: boolean }>(
    `INSERT INTO solicitud
       (tipo, titulo, detalle, solicitante_id, estudiante_id, monto,
        fecha_requerida, hora_preferida, requiere_direccion)
     VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)
     RETURNING id, folio::int AS folio,
               coalesce(fecha_requerida < CURRENT_DATE, FALSE) AS pasada`,
    [
      datos.tipo,
      datos.titulo,
      datos.detalle,
      datos.solicitanteId,
      datos.estudianteId,
      datos.monto,
      datos.fecha,
      datos.hora,
      datos.requiereDireccion,
    ],
  );

  const creada = fila.rows[0];
  if (!creada) throw new Error("la solicitud no devolvió id");

  // Un error lanzado aquí deshace el INSERT de arriba: es la misma transacción.
  if (creada.pasada) throw new FechaPasada();

  await cliente.query(
    `INSERT INTO solicitud_paso (solicitud_id, estado_anterior, estado_nuevo, usuario_id)
     VALUES ($1, NULL, 'enviada', $2)`,
    [creada.id, datos.solicitanteId],
  );

  await avisarA(
    cliente,
    REGLAS[datos.tipo].revisa,
    `#${creada.folio} · ${datos.titulo}`,
    "enviada",
    datos.solicitanteId,
  );

  return creada.id;
}

/** Aviso a todas las cuentas activas cuyo rol tiene el permiso, menos a quien actúa. */
async function avisarA(
  cliente: PoolClient,
  permiso: Permiso,
  titulo: string,
  mensaje: string,
  excepto: string,
) {
  await cliente.query(
    `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
     SELECT u.id, $2, $3, 'solicitud', '/administrativo/solicitudes'
       FROM usuario u
       JOIN rol_permiso rp ON rp.rol_id = u.rol_id
       JOIN permiso p      ON p.id = rp.permiso_id
      WHERE p.codigo = $1 AND u.activo AND u.id <> $4`,
    [permiso, titulo, mensaje, excepto],
  );
}

/** El estudiante sigue sus trámites en su portal; el personal, en la bandeja. */
async function enlaceDelSolicitante(cliente: PoolClient, usuarioId: string) {
  const fila = await cliente.query<{ nombre: string }>(
    `SELECT r.nombre FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1`,
    [usuarioId],
  );

  return fila.rows[0]?.nombre === "estudiante"
    ? "/portal/estudiante/solicitudes"
    : "/administrativo/solicitudes";
}

class FechaPasada extends Error {}

function refrescar() {
  revalidatePath("/[locale]/portal/estudiante/solicitudes", "page");
  revalidatePath("/[locale]/administrativo/solicitudes", "page");
  revalidatePath("/[locale]/portal/administrativo", "page");
  revalidatePath("/[locale]/portal/estudiante", "page");
  // La campana vive en el armazón.
  revalidatePath("/[locale]", "layout");
}

function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    valor,
  );
}
