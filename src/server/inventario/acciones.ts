"use server";

import { revalidatePath } from "next/cache";

import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import type { CategoriaActivo, EstadoActivo } from "@/lib/inventario";
import { obtenerActivoPorCodigo } from "@/server/inventario/consultas";

interface DatosCrearActivo {
  nombre: string;
  categoria: CategoriaActivo;
  ubicacion: string;
  estado?: EstadoActivo;
  fotoUrl?: string | null;
  responsableId?: string | null;
  valorEstimado?: number | null;
  numeroSerie?: string | null;
  marcaModelo?: string | null;
  notas?: string | null;
}

/**
 * Registra un nuevo activo en el inventario institucional, generando
 * automáticamente su código secuencial (ACT-XXXX) y código QR.
 */
export async function crearActivoAction(datos: DatosCrearActivo) {
  const usuario = await requerirPermiso("inventario.escribir");

  if (!datos.nombre?.trim() || !datos.categoria || !datos.ubicacion?.trim()) {
    throw new Error("Nombre, categoría y ubicación son campos obligatorios.");
  }

  return await enTransaccion(async (cliente) => {
    // Generar código único mediante la secuencia
    const seqRes = await cliente.query<{ codigo: string }>(
      "SELECT public.siguiente_codigo_activo() AS codigo"
    );
    const codigo = seqRes.rows[0]?.codigo ?? `ACT-${Date.now().toString().slice(-4)}`;

    const qrPayload = JSON.stringify({
      codigo,
      nombre: datos.nombre.trim(),
      categoria: datos.categoria,
      ubicacion: datos.ubicacion.trim(),
      institucion: "Fundación Global Effect",
    });

    const insertRes = await cliente.query<{ id: string; codigo: string }>(
      `INSERT INTO public.inventario_activo (
        codigo, nombre, categoria, ubicacion, estado, foto_url,
        codigo_qr, responsable_id, valor_estimado, numero_serie,
        marca_modelo, notas, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, codigo`,
      [
        codigo,
        datos.nombre.trim(),
        datos.categoria,
        datos.ubicacion.trim(),
        datos.estado ?? "operativo",
        datos.fotoUrl ?? null,
        qrPayload,
        datos.responsableId || null,
        datos.valorEstimado ?? null,
        datos.numeroSerie?.trim() || null,
        datos.marcaModelo?.trim() || null,
        datos.notas?.trim() || null,
        usuario.id,
      ]
    );

    const nuevoId = insertRes.rows[0].id;

    // Asentar en la bitácora de trazabilidad
    await cliente.query(
      `INSERT INTO public.inventario_historial (
        activo_id, usuario_id, accion, ubicacion_nueva,
        responsable_nuevo_id, estado_nuevo, notas
      ) VALUES ($1, $2, 'creacion', $3, $4, $5, 'Alta inicial de activo en el sistema')`,
      [nuevoId, usuario.id, datos.ubicacion.trim(), datos.responsableId || null, datos.estado ?? "operativo"]
    );

    revalidatePath("/administrativo/inventario");
    return { ok: true, id: nuevoId, codigo };
  });
}

interface DatosEditarActivo {
  id: string;
  nombre: string;
  categoria: CategoriaActivo;
  ubicacion: string;
  estado: EstadoActivo;
  fotoUrl?: string | null;
  responsableId?: string | null;
  valorEstimado?: number | null;
  numeroSerie?: string | null;
  marcaModelo?: string | null;
  notas?: string | null;
}

/**
 * Modifica los datos de un activo y registra los cambios de ubicación, custodio o estado.
 */
export async function editarActivoAction(datos: DatosEditarActivo) {
  const usuario = await requerirPermiso("inventario.escribir");

  return await enTransaccion(async (cliente) => {
    // Obtener estado anterior
    const actualRes = await cliente.query<{
      ubicacion: string;
      responsable_id: string | null;
      estado: EstadoActivo;
    }>(
      "SELECT ubicacion, responsable_id, estado FROM public.inventario_activo WHERE id = $1",
      [datos.id]
    );

    const anterior = actualRes.rows[0];
    if (!anterior) {
      throw new Error("El activo solicitado no existe.");
    }

    await cliente.query(
      `UPDATE public.inventario_activo
          SET nombre = $1,
              categoria = $2,
              ubicacion = $3,
              estado = $4,
              foto_url = $5,
              responsable_id = $6,
              valor_estimado = $7,
              numero_serie = $8,
              marca_modelo = $9,
              notas = $10
        WHERE id = $11`,
      [
        datos.nombre.trim(),
        datos.categoria,
        datos.ubicacion.trim(),
        datos.estado,
        datos.fotoUrl ?? null,
        datos.responsableId || null,
        datos.valorEstimado ?? null,
        datos.numeroSerie?.trim() || null,
        datos.marcaModelo?.trim() || null,
        datos.notas?.trim() || null,
        datos.id,
      ]
    );

    // Si hubo cambios en custodio, ubicación o estado, registrar historial
    const cambioUbicacion = anterior.ubicacion !== datos.ubicacion.trim();
    const cambioCustodio = anterior.responsable_id !== (datos.responsableId || null);
    const cambioEstado = anterior.estado !== datos.estado;

    if (cambioUbicacion || cambioCustodio || cambioEstado) {
      let accion: "movimiento_ubicacion" | "cambio_custodio" | "cambio_estado" | "edicion" = "edicion";
      if (cambioUbicacion) accion = "movimiento_ubicacion";
      else if (cambioCustodio) accion = "cambio_custodio";
      else if (cambioEstado) accion = "cambio_estado";

      await cliente.query(
        `INSERT INTO public.inventario_historial (
          activo_id, usuario_id, accion, ubicacion_anterior, ubicacion_nueva,
          responsable_anterior_id, responsable_nuevo_id, estado_anterior, estado_nuevo, notas
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Actualización de ficha patrimonial')`,
        [
          datos.id,
          usuario.id,
          accion,
          anterior.ubicacion,
          datos.ubicacion.trim(),
          anterior.responsable_id,
          datos.responsableId || null,
          anterior.estado,
          datos.estado,
        ]
      );
    }

    revalidatePath("/administrativo/inventario");
    revalidatePath(`/administrativo/inventario/${datos.id}`);
    return { ok: true };
  });
}

/**
 * Registra una lectura y validación de código QR in situ mediante la cámara móvil.
 */
export async function registrarAuditoriaQrAction(codigoOId: string, notas?: string) {
  const usuario = await requerirPermiso("inventario.auditar");

  const activo = await consultarUna<{ id: string; codigo: string; ubicacion: string; estado: string }>(
    "SELECT id, codigo, ubicacion, estado FROM public.inventario_activo WHERE codigo = $1 OR id::text = $1",
    [codigoOId.trim()]
  );

  if (!activo) {
    throw new Error(`No se encontró ningún activo con el código "${codigoOId}".`);
  }

  await enTransaccion(async (cliente) => {
    await cliente.query(
      `INSERT INTO public.inventario_historial (
        activo_id, usuario_id, accion, ubicacion_nueva, estado_nuevo, notas
      ) VALUES ($1, $2, 'auditoria_qr', $3, $4, $5)`,
      [
        activo.id,
        usuario.id,
        activo.ubicacion,
        activo.estado,
        notas?.trim() || "Auditoría física in situ confirmada vía escaneo de código QR móvil",
      ]
    );
  });

  revalidatePath("/administrativo/inventario");
  revalidatePath(`/administrativo/inventario/${activo.id}`);
  return { ok: true, activoId: activo.id, codigo: activo.codigo };
}

/**
 * Elimina o da de baja un activo.
 */
export async function eliminarActivoAction(id: string) {
  await requerirPermiso("inventario.eliminar");

  await enTransaccion(async (cliente) => {
    await cliente.query("DELETE FROM public.inventario_activo WHERE id = $1", [id]);
  });

  revalidatePath("/administrativo/inventario");
  return { ok: true };
}

/**
 * Busca un activo por código (o ID) desde un componente cliente de forma segura.
 */
export async function buscarActivoPorCodigoAction(codigo: string) {
  await requerirUsuario();
  return await obtenerActivoPorCodigo(codigo);
}
