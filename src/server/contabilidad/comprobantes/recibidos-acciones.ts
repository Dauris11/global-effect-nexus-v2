"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { notificarUsuario } from "@/server/compartidos/notificaciones";

/**
 * Valida, clasifica y actualiza un comprobante recibido.
 */
export async function validarComprobanteRecibido(datos: {
  id: string;
  estado: "validado" | "observado" | "rechazado";
  proveedorNombre?: string;
  proveedorRnc?: string;
  ncf?: string;
  tipoNcf?: string;
  monto?: number;
  itbis?: number;
  centroCostoId?: string;
  fondoId?: string;
  proyectoId?: string;
  cajaId?: string;
  observaciones?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const usuario = await requerirUsuario();

  return enTransaccion(async (cliente) => {
    const { rows: compRows } = await cliente.query(
      `SELECT cr.id, cr.remitente_id, cr.mensaje_id, cr.concepto
         FROM contabilidad.comprobante_recibido cr
        WHERE cr.id = $1
        FOR UPDATE`,
      [datos.id],
    );

    if (compRows.length === 0) {
      return { ok: false, error: "Comprobante no encontrado" };
    }
    const comp = compRows[0];

    // Actualizar datos del comprobante recibido
    await cliente.query(
      `UPDATE contabilidad.comprobante_recibido
          SET estado = $1,
              proveedor_nombre = coalesce($2, proveedor_nombre),
              proveedor_rnc = coalesce($3, proveedor_rnc),
              ncf = coalesce($4, ncf),
              tipo_ncf = coalesce($5, tipo_ncf),
              monto = coalesce($6, monto),
              itbis = coalesce($7, itbis),
              centro_costo_id = coalesce($8, centro_costo_id),
              fondo_id = coalesce($9, fondo_id),
              proyecto_id = coalesce($10, proyecto_id),
              caja_id = coalesce($11, caja_id),
              observaciones = coalesce($12, observaciones),
              revisado_por = $13,
              revisado_en = now(),
              updated_at = now()
        WHERE id = $14`,
      [
        datos.estado,
        datos.proveedorNombre ?? null,
        datos.proveedorRnc ?? null,
        datos.ncf ?? null,
        datos.tipoNcf ?? null,
        datos.monto ?? null,
        datos.itbis ?? null,
        datos.centroCostoId ?? null,
        datos.fondoId ?? null,
        datos.proyectoId ?? null,
        datos.cajaId ?? null,
        datos.observaciones ?? null,
        usuario.id,
        datos.id,
      ],
    );

    // Si tiene un mensaje de chat vinculado, responder o actualizar el estado en el hilo
    if (comp.mensaje_id) {
      const estadoEtiqueta = {
        validado: "✅ Comprobante validado por Contabilidad",
        observado: `⚠️ Observación en comprobante: ${datos.observaciones || "Requiere revisión"}`,
        rechazado: `❌ Comprobante rechazado: ${datos.observaciones || "No admitido"}`,
      }[datos.estado];

      // Insertar mensaje del sistema en el canal
      const { rows: canalRows } = await cliente.query(
        `SELECT canal_id FROM public.chat_mensaje WHERE id = $1`,
        [comp.mensaje_id],
      );

      if (canalRows.length > 0) {
        await cliente.query(
          `INSERT INTO public.chat_mensaje (
             canal_id, remitente_id, contenido, tipo, datos_extra
           ) VALUES ($1, $2, $3, 'sistema', $4)`,
          [
            canalRows[0].canal_id,
            usuario.id,
            estadoEtiqueta,
            JSON.stringify({
              comprobante_recibido_id: datos.id,
              nuevo_estado: datos.estado,
            }),
          ],
        );
      }
    }

    // Notificar al empleado que envió el comprobante
    await notificarUsuario({
      usuarioId: comp.remitente_id,
      titulo: `Actualización de comprobante (${datos.estado})`,
      mensaje: `Tu comprobante de "${comp.concepto}" fue marcado como ${datos.estado}.`,
      tipo: datos.estado === "validado" ? "info" : "alerta",
      enlace: `/chat`,
    });

    revalidatePath("/contabilidad/comprobantes-recibidos");
    revalidatePath("/chat");
    return { ok: true };
  });
}
