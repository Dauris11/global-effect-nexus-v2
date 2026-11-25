"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuario, type UsuarioSesion } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { esFechaIso, esUuid } from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import { contextoDe } from "@/server/contabilidad/sesion";

/*
 * Alta y anulación de los pilares «materiales» y «transporte» del costo por
 * estudiante. Escribir exige `contabilidad.registrar` Y `expedientes.costos.leer`:
 * quien registra tiene que poder ver lo que registra, y la Junta (admin) que lee
 * no escribe. Esconder el botón no basta; se comprueba aquí.
 *
 * Nada se borra: un error se anula con motivo y se vuelve a registrar. Cada
 * movimiento deja su fila en `audit_log` DENTRO de la misma transacción, para
 * que no exista un cambio de costo sin su rastro (la tabla es de `public`, no
 * de `contabilidad`, así que no la cubre el disparador de la bitácora contable).
 */

export type EstadoCosto = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "estudiante_invalido"
    | "concepto_vacio"
    | "cantidad_invalida"
    | "monto_invalido"
    | "fecha_invalida"
    | "dias_invalidos"
    | "periodo_invalido"
    | "duplicado"
    | "motivo_vacio"
    | "no_encontrado"
    | "error";
};

const INICIAL_OK: EstadoCosto = { estado: "ok" };

function puedeEscribir(usuario: UsuarioSesion) {
  return usuarioTienePermiso(usuario, "contabilidad.registrar") && usuarioTienePermiso(usuario, "expedientes.costos.leer");
}

/** Monto >= 0 con hasta 2 decimales; el costo cero es válido (artículo donado). */
function montoDop(texto: FormDataEntryValue | null, tope: number): number | null {
  const limpio = String(texto ?? "").trim().replace(/,/g, "");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(limpio)) return null;
  const n = Number(limpio);
  return n <= tope ? n : null;
}

function revalidar() {
  revalidatePath("/[locale]/contabilidad/reportes/costo-estudiantes", "page");
  revalidatePath("/[locale]/contabilidad/reportes/costo-estudiantes/registro", "page");
  revalidatePath("/[locale]/expedientes/[id]", "page");
}

async function ejecutar(usuario: UsuarioSesion, trabajo: Parameters<typeof enTransaccionComo<EstadoCosto>>[1]) {
  try {
    return await enTransaccionComo<EstadoCosto>(await contextoDe(usuario), trabajo);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { estado: "duplicado" } satisfies EstadoCosto;
    console.error("[costos]", error);
    return { estado: "error" } satisfies EstadoCosto;
  }
}

export async function registrarMaterial(_previo: EstadoCosto, datos: FormData): Promise<EstadoCosto> {
  const usuario = await requerirUsuario();
  if (!puedeEscribir(usuario)) return { estado: "no_permitido" };

  const estudianteId = String(datos.get("estudiante_id") ?? "");
  const concepto = String(datos.get("concepto") ?? "").trim();
  const cantidad = Number(String(datos.get("cantidad") ?? ""));
  const costo = montoDop(datos.get("costo_unitario"), 9_999_999);
  const fecha = String(datos.get("fecha") ?? "");
  const articuloId = String(datos.get("articulo_id") ?? "") || null;

  if (!esUuid(estudianteId) || (articuloId !== null && !esUuid(articuloId))) return { estado: "estudiante_invalido" };
  if (concepto.length === 0 || concepto.length > 150) return { estado: "concepto_vacio" };
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10_000) return { estado: "cantidad_invalida" };
  if (costo === null) return { estado: "monto_invalido" };
  if (!esFechaIso(fecha)) return { estado: "fecha_invalida" };

  const resultado = await ejecutar(usuario, async (cliente) => {
    const { rows: est } = await cliente.query(`SELECT 1 FROM public.estudiante WHERE id = $1`, [estudianteId]);
    if (est.length === 0) return { estado: "estudiante_invalido" };

    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO public.estudiante_material_costo
         (estudiante_id, articulo_id, concepto, cantidad, costo_unitario_dop, fecha, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [estudianteId, articuloId, concepto, cantidad, costo, fecha, usuario.id],
    );
    await cliente.query(
      `INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, datos) VALUES ($1, $2, $3, $4, $5)`,
      [usuario.id, "costo.material.registrado", "estudiante_material_costo", rows[0].id,
        JSON.stringify({ estudiante_id: estudianteId, cantidad, costo_unitario_dop: costo, articulo_id: articuloId })],
    );
    return INICIAL_OK;
  });

  if (resultado.estado === "ok") revalidar();
  return resultado;
}

export async function anularMaterial(_previo: EstadoCosto, datos: FormData): Promise<EstadoCosto> {
  const usuario = await requerirUsuario();
  if (!puedeEscribir(usuario)) return { estado: "no_permitido" };

  const id = String(datos.get("id") ?? "");
  const motivo = String(datos.get("motivo") ?? "").trim();
  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (motivo.length === 0 || motivo.length > 300) return { estado: "motivo_vacio" };

  let estudianteId = "";
  const resultado = await ejecutar(usuario, async (cliente) => {
    // `anulado_en IS NULL` en el WHERE: anular dos veces no pisa el primer motivo.
    const { rows } = await cliente.query<{ estudiante_id: string; costo_total_dop: string }>(
      `UPDATE public.estudiante_material_costo
          SET anulado_en = now(), anulado_por = $2, motivo_anulacion = $3
        WHERE id = $1 AND anulado_en IS NULL
        RETURNING estudiante_id, costo_total_dop`,
      [id, usuario.id, motivo],
    );
    if (rows.length === 0) return { estado: "no_encontrado" };
    estudianteId = rows[0].estudiante_id;
    await cliente.query(
      `INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, datos) VALUES ($1, $2, $3, $4, $5)`,
      [usuario.id, "costo.material.anulado", "estudiante_material_costo", id,
        JSON.stringify({ estudiante_id: estudianteId, costo_total_dop: rows[0].costo_total_dop, motivo })],
    );
    return INICIAL_OK;
  });

  if (resultado.estado === "ok") revalidar();
  return resultado;
}

export async function registrarTransporte(_previo: EstadoCosto, datos: FormData): Promise<EstadoCosto> {
  const usuario = await requerirUsuario();
  if (!puedeEscribir(usuario)) return { estado: "no_permitido" };

  const estudianteId = String(datos.get("estudiante_id") ?? "");
  const periodoId = String(datos.get("periodo_id") ?? "");
  const dias = Number(String(datos.get("dias_asignados") ?? ""));
  const costo = montoDop(datos.get("costo_asignado"), 99_999_999);
  const observaciones = String(datos.get("observaciones") ?? "").trim().slice(0, 500) || null;

  if (!esUuid(estudianteId)) return { estado: "estudiante_invalido" };
  if (!esUuid(periodoId)) return { estado: "periodo_invalido" };
  if (!Number.isInteger(dias) || dias < 0 || dias > 366) return { estado: "dias_invalidos" };
  if (costo === null) return { estado: "monto_invalido" };

  const resultado = await ejecutar(usuario, async (cliente) => {
    const { rows: est } = await cliente.query(`SELECT 1 FROM public.estudiante WHERE id = $1`, [estudianteId]);
    if (est.length === 0) return { estado: "estudiante_invalido" };
    const { rows: per } = await cliente.query(`SELECT 1 FROM public.periodo WHERE id = $1 AND tipo = 'cuatrimestre'`, [periodoId]);
    if (per.length === 0) return { estado: "periodo_invalido" };

    // El índice único parcial (0113) impide dos cobros vigentes del mismo
    // cuatrimestre; para corregir uno, primero se anula.
    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO public.estudiante_transporte_costo
         (estudiante_id, periodo_id, dias_asignados, costo_asignado_dop, observaciones, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [estudianteId, periodoId, dias, costo, observaciones, usuario.id],
    );
    await cliente.query(
      `INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, datos) VALUES ($1, $2, $3, $4, $5)`,
      [usuario.id, "costo.transporte.registrado", "estudiante_transporte_costo", rows[0].id,
        JSON.stringify({ estudiante_id: estudianteId, periodo_id: periodoId, dias_asignados: dias, costo_asignado_dop: costo })],
    );
    return INICIAL_OK;
  });

  if (resultado.estado === "ok") revalidar();
  return resultado;
}

export async function anularTransporte(_previo: EstadoCosto, datos: FormData): Promise<EstadoCosto> {
  const usuario = await requerirUsuario();
  if (!puedeEscribir(usuario)) return { estado: "no_permitido" };

  const id = String(datos.get("id") ?? "");
  const motivo = String(datos.get("motivo") ?? "").trim();
  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (motivo.length === 0 || motivo.length > 300) return { estado: "motivo_vacio" };

  let estudianteId = "";
  const resultado = await ejecutar(usuario, async (cliente) => {
    const { rows } = await cliente.query<{ estudiante_id: string; periodo_id: string; costo_asignado_dop: string }>(
      `UPDATE public.estudiante_transporte_costo
          SET anulado_en = now(), anulado_por = $2, motivo_anulacion = $3
        WHERE id = $1 AND anulado_en IS NULL
        RETURNING estudiante_id, periodo_id, costo_asignado_dop`,
      [id, usuario.id, motivo],
    );
    if (rows.length === 0) return { estado: "no_encontrado" };
    estudianteId = rows[0].estudiante_id;
    await cliente.query(
      `INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, datos) VALUES ($1, $2, $3, $4, $5)`,
      [usuario.id, "costo.transporte.anulado", "estudiante_transporte_costo", id,
        JSON.stringify({ estudiante_id: estudianteId, periodo_id: rows[0].periodo_id, costo_asignado_dop: rows[0].costo_asignado_dop, motivo })],
    );
    return INICIAL_OK;
  });

  if (resultado.estado === "ok") revalidar();
  return resultado;
}
